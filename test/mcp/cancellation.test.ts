import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';
import { createServer } from '../../src/mcp/server.js';

it('forwards SDK request cancellation to the provider without replaying the request', async () => {
  const started = Promise.withResolvers<void>();
  let aborted = false;
  let calls = 0;
  const server = createServer(
    loadConfig({
      PTERODACTYL_URL: 'https://panel.example.test',
      PTERODACTYL_CLIENT_KEY: 'ptlc_fixture',
    }),
    {
      fetch: (_url, init) =>
        new Promise((_resolve, reject) => {
          calls++;
          started.resolve();
          init.signal?.addEventListener(
            'abort',
            () => {
              aborted = true;
              reject(new Error('private aborted transport'));
            },
            { once: true },
          );
        }),
    },
  );
  const client = new Client({ name: 'cancellation-fixture', version: '0' });
  const [downstream, upstream] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(upstream);
    await client.connect(downstream);
    const controller = new AbortController();
    const result = client.callTool(
      { name: 'ptero_read', arguments: { operationId: 'client.servers.list', input: {} } },
      { signal: controller.signal },
    );
    const assertion = expect(result).rejects.toThrow();
    await started.promise;
    controller.abort();
    await assertion;
    await expect.poll(() => aborted).toBe(true);
    expect(calls).toBe(1);
  } finally {
    await client.close();
    await server.close();
  }
});
