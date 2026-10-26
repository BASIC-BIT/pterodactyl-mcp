import { describe, expect, it } from 'vitest';
import { PanelClient } from '../../src/api/client.js';
import { loadConfig } from '../../src/config.js';
import { createServer } from 'node:http';

const config = loadConfig({
  PTERODACTYL_URL: 'https://panel.example.test',
  PTERODACTYL_LABEL: 'fixture',
  PTERODACTYL_APPLICATION_KEY: 'ptla_fixture',
  PTERODACTYL_CLIENT_KEY: 'ptlc_fixture',
});

function overflowingStream(onCancel: () => void) {
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new Uint8Array(16));
    },
    cancel: onCancel,
  });
}

describe('provider HTTP boundary', () => {
  it.each([
    ['application', '/api/application/servers', 'Bearer ptla_fixture'],
    ['client', '/api/client', 'Bearer ptlc_fixture'],
  ] as const)(
    'uses only the %s credential and preserves query parameters',
    async (family, path, key) => {
      const sent: { url: string; auth: string | null }[] = [];
      const client = new PanelClient(config, {
        fetch: async (url, init) => {
          sent.push({ url: String(url), auth: new Headers(init?.headers).get('authorization') });
          return Response.json({
            data: [],
            meta: { pagination: { current_page: 2, total_pages: 3 } },
          });
        },
      });
      const result = await client.request({
        family,
        method: 'GET',
        path,
        query: { page: 2, 'filter[name]': 'Synthetic server' },
      });
      expect(result).toEqual({
        data: [],
        meta: { pagination: { current_page: 2, total_pages: 3 } },
      });
      expect(sent).toEqual([
        {
          url: `https://panel.example.test${path}?page=2&filter%5Bname%5D=Synthetic+server`,
          auth: key,
        },
      ]);
    },
  );

  it('rejects an unavailable credential before contacting the provider', async () => {
    let calls = 0;
    const client = new PanelClient(
      loadConfig({ PTERODACTYL_URL: config.origin, PTERODACTYL_APPLICATION_KEY: 'ptla_fixture' }),
      {
        fetch: async () => {
          calls += 1;
          return Response.json({});
        },
      },
    );
    await expect(
      client.request({ family: 'client', method: 'GET', path: '/api/client' }),
    ).rejects.toMatchObject({ code: 'credential_unavailable' });
    expect(calls).toBe(0);
  });

  it.each([
    'https://other.example.test/api/client',
    '//other.example.test/api/client',
    '/api/application/users',
    '/api/client/../../admin',
    '/api/client?token=secret',
  ])('rejects a path outside the configured API boundary: %s', async (path) => {
    const client = new PanelClient(config, {
      fetch: async () => {
        throw new Error('Provider must not be reached');
      },
    });
    await expect(client.request({ family: 'client', method: 'GET', path })).rejects.toMatchObject({
      code: 'invalid_path',
    });
  });

  it('refuses writes without operator enablement, even if callers bypass the tool registry', async () => {
    let calls = 0;
    const client = new PanelClient(config, {
      fetch: async () => {
        calls += 1;
        return new Response(null, { status: 204 });
      },
    });
    await expect(
      client.request({
        family: 'client',
        method: 'POST',
        path: '/api/client/servers/12345678/power',
        body: { signal: 'restart' },
      }),
    ).rejects.toMatchObject({ code: 'writes_disabled' });
    expect(calls).toBe(0);
  });

  it('does not follow a credential-redirecting provider response', async () => {
    let redirectMode: RequestRedirect | undefined;
    const client = new PanelClient(config, {
      fetch: async (_url, init) => {
        redirectMode = init?.redirect;
        return new Response(null, {
          status: 302,
          headers: { location: 'https://other.example.test' },
        });
      },
    });
    await expect(
      client.request({ family: 'client', method: 'GET', path: '/api/client' }),
    ).rejects.toMatchObject({ code: 'redirect_refused', status: 302 });
    expect(redirectMode).toBe('manual');
  });

  it.each([false, true])(
    'bounds streamed responses even when cancellation fails: %s',
    async (cancelFails) => {
      let cancelled = false;
      const body = overflowingStream(() => {
        cancelled = true;
        if (cancelFails) throw new Error('private cleanup detail');
      });
      const client = new PanelClient(config, {
        maxResponseBytes: 8,
        fetch: async () => new Response(body),
      });
      await expect(
        client.request({ family: 'client', method: 'GET', path: '/api/client' }),
      ).rejects.toMatchObject({ code: 'response_too_large' });
      expect(cancelled).toBe(true);
    },
  );

  it('redacts provider errors instead of returning arbitrary response content', async () => {
    const client = new PanelClient(config, {
      fetch: async () => new Response('authorization ptla_fixture private config', { status: 403 }),
    });
    await expect(
      client.request({ family: 'application', method: 'GET', path: '/api/application/servers' }),
    ).rejects.toMatchObject({ code: 'provider_error', status: 403 });
    await expect(
      client.request({ family: 'application', method: 'GET', path: '/api/application/servers' }),
    ).rejects.not.toThrow(/ptla_fixture|private config/);
  });

  it('returns rate-limit metadata without replaying the request', async () => {
    let calls = 0;
    const client = new PanelClient(config, {
      fetch: async () => {
        calls += 1;
        return new Response(null, { status: 429, headers: { 'retry-after': '12' } });
      },
    });
    await expect(
      client.request({ family: 'client', method: 'GET', path: '/api/client' }),
    ).rejects.toMatchObject({ code: 'rate_limited', retryAfterSeconds: 12 });
    expect(calls).toBe(1);
  });

  it('reports unknown completion without replaying a write after a transport failure', async () => {
    let calls = 0;
    const client = new PanelClient(
      { ...config, allowWrites: true },
      {
        fetch: async () => {
          calls += 1;
          throw new Error('private transport failure');
        },
      },
    );
    await expect(
      client.request({
        family: 'client',
        method: 'POST',
        path: '/api/client/servers/12345678/power',
        body: { signal: 'restart' },
      }),
    ).rejects.toMatchObject({ code: 'completion_unknown' });
    expect(calls).toBe(1);
  });

  it('aborts stalled reads at the configured request deadline', async () => {
    const client = new PanelClient(config, {
      timeoutMs: 10,
      fetch: async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true,
          });
        }),
    });
    await expect(
      client.request({ family: 'client', method: 'GET', path: '/api/client' }),
    ).rejects.toMatchObject({ code: 'request_failed' });
  });

  it('accepts a body-free provider 204 response', async () => {
    const client = new PanelClient(
      { ...config, allowWrites: true },
      { fetch: async () => new Response(null, { status: 204 }) },
    );
    await expect(
      client.request({
        family: 'client',
        method: 'POST',
        path: '/api/client/servers/12345678/power',
        body: { signal: 'restart' },
      }),
    ).resolves.toBeNull();
  });

  it('uses the native HTTP client against a controlled provider and reads text bodies', async () => {
    const requests: {
      method: string | undefined;
      path: string | undefined;
      auth: string | undefined;
      body: string;
    }[] = [];
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      requests.push({
        method: request.method,
        path: request.url,
        auth: request.headers.authorization,
        body: Buffer.concat(chunks).toString(),
      });
      response.writeHead(200, { 'content-type': 'text/plain' });
      response.end('Synthetic game log\nready');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('Expected a TCP fixture');
    try {
      const client = new PanelClient({
        ...config,
        origin: `http://127.0.0.1:${address.port}`,
        allowWrites: true,
      });
      await expect(
        client.request({
          family: 'client',
          method: 'POST',
          path: '/api/client/servers/12345678/command',
          body: { command: 'status' },
        }),
      ).resolves.toBe('Synthetic game log\nready');
      expect(requests).toEqual([
        {
          method: 'POST',
          path: '/api/client/servers/12345678/command',
          auth: 'Bearer ptlc_fixture',
          body: '{"command":"status"}',
        },
      ]);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('preserves a provider rejection when disposing of its body fails', async () => {
    const body = new ReadableStream({
      cancel() {
        throw new Error('private disposal');
      },
    });
    const client = new PanelClient(config, {
      fetch: async () => new Response(body, { status: 403 }),
    });
    await expect(
      client.request({ family: 'client', method: 'GET', path: '/api/client' }),
    ).rejects.toMatchObject({ code: 'provider_error', status: 403 });
  });
});
