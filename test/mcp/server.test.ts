import { createServer as createHttpServer } from 'node:http';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from '../../src/mcp/server.js';
import { loadConfig } from '../../src/config.js';
import * as z from 'zod/v4';
import { mutationContracts } from '../fixtures/contracts.js';

const cleanups: (() => Promise<void>)[] = [];
const powerArguments = {
  operationId: 'client.servers.power',
  input: { path: { server: '1234abcd' }, body: { signal: 'restart' } },
};
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function fixture(allowWrites = false) {
  const requests: {
    path: string | undefined;
    key: string | undefined;
    method: string | undefined;
  }[] = [];
  const provider = createHttpServer((request, response) => {
    requests.push({
      path: request.url,
      key: request.headers.authorization,
      method: request.method,
    });
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        data: [
          {
            object: 'server',
            attributes: {
              id: 42,
              identifier: '1234abcd',
              name: 'Synthetic VS',
              container: { environment: { ADMIN_PASSWORD: 'synthetic_hidden' } },
            },
          },
        ],
        meta: { pagination: { current_page: 1, total_pages: 2 } },
      }),
    );
  });
  await new Promise<void>((resolve) => provider.listen(0, '127.0.0.1', resolve));
  cleanups.push(async () => {
    provider.closeAllConnections();
    await new Promise<void>((resolve) => provider.close(() => resolve()));
  });
  const address = provider.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP fixture');
  const parsed = loadConfig({
    PTERODACTYL_URL: 'https://panel.example.test',
    PTERODACTYL_LABEL: 'synthetic-panel',
    PTERODACTYL_APPLICATION_KEY: 'ptla_fixture',
    PTERODACTYL_CLIENT_KEY: 'ptlc_fixture',
  });
  const server = createServer({
    ...parsed,
    origin: `http://127.0.0.1:${address.port}`,
    allowWrites,
  });
  const client = new Client({ name: 'controlled-acceptance', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  cleanups.push(async () => {
    await client.close();
    await server.close();
  });
  return { client, requests };
}

describe('actual MCP SDK client/server', () => {
  it.each([
    ['application.servers.create', ['environment']],
    ['application.servers.startup', ['environment']],
    ['application.users.create', ['password']],
  ])('advertises usable, complete input schemas for %s', async (operationId, properties) => {
    const { client } = await fixture();
    const response = await client.callTool({
      name: 'ptero_operation_details',
      arguments: { operationId },
    });
    const parsed = z
      .object({ result: z.object({ inputSchema: z.record(z.string(), z.unknown()) }) })
      .parse(response.structuredContent);
    const schema = parsed.result.inputSchema;
    const body = z
      .object({
        properties: z.object({
          body: z.object({
            properties: z.record(z.string(), z.unknown()),
            required: z.array(z.string()),
          }),
        }),
      })
      .parse(schema).properties.body;
    for (const property of properties) expect(body.properties).toHaveProperty(property);
    for (const property of body.required) expect(body.properties).toHaveProperty(property);
    const contract = mutationContracts.find((row) => row[0] === operationId)!;
    expect(z.fromJSONSchema(schema).safeParse(contract[3]).success).toBe(true);
  });
  it('discovers separate read and mutation tools with accurate annotations', async () => {
    const { client, requests } = await fixture();
    const result = await client.listTools();
    expect(result.tools.find((tool) => tool.name === 'ptero_read')?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
    });
    expect(result.tools.find((tool) => tool.name === 'ptero_write')?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
    });
    expect(result.tools.find((tool) => tool.name === 'ptero_file_upload')).toMatchObject({
      annotations: { readOnlyHint: false },
      _meta: { 'openai/fileParams': ['file'] },
    });
    expect(
      result.tools.find((tool) => tool.name === 'ptero_console_tail')?.annotations,
    ).toMatchObject({ readOnlyHint: true });
    expect(requests).toEqual([]);
    const inventory = await client.callTool({ name: 'ptero_operations', arguments: {} });
    expect(inventory.isError).toBe(false);
    expect(inventory.structuredContent).toMatchObject({ result: expect.any(Array) });
    const missing = await client.callTool({
      name: 'ptero_operation_details',
      arguments: { operationId: 'invented.endpoint' },
    });
    expect(missing.isError).toBe(true);
    expect(requests).toEqual([]);
  });

  it('calls an Application inventory route over the real HTTP boundary and preserves pagination', async () => {
    const { client, requests } = await fixture();
    const result = await client.callTool({
      name: 'ptero_read',
      arguments: { operationId: 'application.servers.list', input: { query: { page: 1 } } },
    });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      panel: 'synthetic-panel',
      result: {
        data: [{ attributes: { id: 42, identifier: '1234abcd', name: 'Synthetic VS' } }],
        meta: { pagination: { total_pages: 2 } },
      },
    });
    expect(requests).toEqual([
      { path: '/api/application/servers?page=1', key: 'Bearer ptla_fixture', method: 'GET' },
    ]);
    expect(JSON.stringify(result)).not.toContain('synthetic_hidden');
    expect(JSON.stringify(result)).not.toContain('ptla_fixture');
  });

  it('cannot invoke a write through the read tool, even with a valid operation', async () => {
    const { client, requests } = await fixture(true);
    const result = await client.callTool({
      name: 'ptero_read',
      arguments: powerArguments,
    });
    expect(result.isError).toBe(true);
    expect(requests).toEqual([]);
  });

  it('enforces write disablement after the SDK accepts valid tool input', async () => {
    const { client, requests } = await fixture();
    const result = await client.callTool({
      name: 'ptero_write',
      arguments: powerArguments,
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ error: { code: 'writes_disabled' } });
    expect(requests).toEqual([]);
  });

  it('executes an explicitly enabled valid write with the Client key', async () => {
    const { client, requests } = await fixture(true);
    const result = await client.callTool({
      name: 'ptero_write',
      arguments: powerArguments,
    });
    expect(result.isError).not.toBe(true);
    expect(requests).toEqual([
      { path: '/api/client/servers/1234abcd/power', key: 'Bearer ptlc_fixture', method: 'POST' },
    ]);
  });

  it('returns operation input schemas over MCP and blocks unknown or excluded operations', async () => {
    const { client, requests } = await fixture();
    const details = await client.callTool({
      name: 'ptero_operation_details',
      arguments: { operationId: 'client.servers.power' },
    });
    expect(details.isError).not.toBe(true);
    expect(details.structuredContent).toMatchObject({
      panel: 'synthetic-panel',
      result: { method: 'POST', inputSchema: { type: 'object' } },
    });
    for (const operationId of ['invented.endpoint', 'client.account.api_keys.list']) {
      const result = await client.callTool({
        name: 'ptero_read',
        arguments: { operationId, input: {} },
      });
      expect(result.isError).toBe(true);
    }
    expect(requests).toEqual([]);
  });
});
