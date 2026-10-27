import { createServer as httpServer } from 'node:http';
import { createHash } from 'node:crypto';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';
import { createServer } from '../../src/mcp/server.js';

it('uploads a native-file-shaped artifact over SDK and real HTTP, then independently checks destination bytes', async () => {
  const source = new Uint8Array([0x50, 0x4b, 0xff, 0x80, 0, 10]);
  let destination = new Uint8Array();
  const seen: { url: string | undefined; auth: string | undefined }[] = [];
  const provider = httpServer(async (request, response) => {
    seen.push({ url: request.url, auth: request.headers.authorization });
    const url = new URL(request.url!, 'http://fixture');
    if (url.pathname.startsWith('/files.oaiusercontent.com/')) {
      response.end(source);
      return;
    }
    if (url.pathname.startsWith('/panel.example.test/')) {
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          attributes: {
            url: url.pathname.endsWith('/upload')
              ? 'https://wings.example.test/upload/file?token=secret'
              : 'https://wings.example.test/download/file?token=verify',
          },
        }),
      );
      return;
    }
    if (url.pathname.endsWith('/upload/file')) {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const form = await new Response(Buffer.concat(chunks), {
        headers: { 'content-type': request.headers['content-type']! },
      }).formData();
      const file = form.get('files') as File;
      expect(file.name).toBe('fixture.zip');
      expect(url.searchParams.get('directory')).toBe('/Mods');
      destination = new Uint8Array(await file.arrayBuffer());
      response.writeHead(204).end();
      return;
    }
    response.end(destination);
  });
  await new Promise<void>((resolve) => provider.listen(0, '127.0.0.1', resolve));
  const address = provider.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP fixture');
  const config = loadConfig({
    PTERODACTYL_URL: 'https://panel.example.test',
    PTERODACTYL_CLIENT_KEY: 'ptlc_fixture',
    PTERODACTYL_ALLOW_WRITES: 'true',
    PTERODACTYL_WINGS_ORIGINS: '["https://wings.example.test"]',
  });
  const server = createServer(config, {
    fetch: (url, init) =>
      fetch(`http://127.0.0.1:${address.port}/${url.hostname}${url.pathname}${url.search}`, init),
  });
  const client = new Client({ name: 'native-file-contract', version: '0' });
  const [downstream, upstream] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(upstream);
    await client.connect(downstream);
    const result = await client.callTool({
      name: 'ptero_file_upload',
      arguments: {
        server: '1234abcd',
        directory: '/Mods',
        name: 'fixture.zip',
        file: {
          download_url: 'https://files.oaiusercontent.com/fixture',
          file_id: 'synthetic-file',
        },
      },
    });
    const sha256 = createHash('sha256').update(source).digest('hex');
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({
      result: { path: '/Mods/fixture.zip', sha256, verified: true },
    });
    expect(destination).toEqual(source);
    expect(JSON.stringify(result)).not.toMatch(/token=|ptlc_/);
    const checked = await client.callTool({
      name: 'ptero_file_hash',
      arguments: { server: '1234abcd', file: '/Mods/fixture.zip', sha256 },
    });
    expect(checked.structuredContent).toMatchObject({ result: { verified: true, bytes: 6 } });
    for (const request of seen.filter(
      (request) => !request.url?.startsWith('/panel.example.test/'),
    ))
      expect(request.auth).toBeUndefined();
    const unavailable = await client.callTool({
      name: 'ptero_console_tail',
      arguments: { server: '1234abcd', durationMs: 25 },
    });
    expect(unavailable.isError).toBe(true);
  } finally {
    await client.close();
    await server.close();
    provider.closeAllConnections();
    await new Promise<void>((resolve) => provider.close(() => resolve()));
  }
});
