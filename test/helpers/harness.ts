import { createServer as createHttpServer } from 'node:http';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { createServer } from '../../src/mcp/server.js';
import { loadConfig } from '../../src/config.js';

export async function contractHarness(
  respond?: (request: { method: string | undefined; url: string | undefined; body: string }) => {
    status: number;
    body: unknown;
  },
) {
  const requests: {
    method: string | undefined;
    url: string | undefined;
    body: string;
    auth: string | undefined;
    type: string | undefined;
  }[] = [];
  const provider = createHttpServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    requests.push({
      method: request.method,
      url: request.url,
      body: Buffer.concat(chunks).toString(),
      auth: request.headers.authorization,
      type: request.headers['content-type'],
    });
    const result = respond?.(requests.at(-1)!) ?? {
      status: 200,
      body: { object: 'fixture', attributes: { id: 42 } },
    };
    response.writeHead(result.status, { 'content-type': 'application/json' });
    response.end(result.status === 204 ? undefined : JSON.stringify(result.body));
  });
  await new Promise<void>((resolve) => provider.listen(0, '127.0.0.1', resolve));
  const address = provider.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP fixture');
  const config = loadConfig({
    PTERODACTYL_URL: 'https://panel.example.test',
    PTERODACTYL_APPLICATION_KEY: 'ptla_fixture',
    PTERODACTYL_CLIENT_KEY: 'ptlc_fixture',
    PTERODACTYL_ALLOW_WRITES: 'true',
  });
  const server = createServer({ ...config, origin: `http://127.0.0.1:${address.port}` });
  const client = new Client({ name: 'provider-contracts', version: '0.0.0' });
  const [downstream, upstream] = InMemoryTransport.createLinkedPair();
  await server.connect(upstream);
  await client.connect(downstream);
  return {
    requests,
    client,
    async close() {
      await client.close();
      await server.close();
      provider.closeAllConnections();
      await new Promise<void>((resolve) => provider.close(() => resolve()));
    },
  };
}
