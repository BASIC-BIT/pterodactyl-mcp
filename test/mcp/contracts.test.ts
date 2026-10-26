import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { contracts } from '../fixtures/contracts.js';
import { contractHarness } from '../helpers/harness.js';
import { operations } from '../../src/operations/catalog.js';

describe('SDK to provider mutation contracts', () => {
  let harness: Awaited<ReturnType<typeof contractHarness>>;
  beforeAll(async () => {
    harness = await contractHarness();
  });
  afterAll(async () => {
    await harness.close();
  });
  it.each(contracts)(
    '%s sends the exact provider request through MCP',
    async (operationId, method, path, input) => {
      const result = await harness.client.callTool({
        name:
          method === 'GET' ? 'ptero_read' : method === 'DELETE' ? 'ptero_delete' : 'ptero_write',
        arguments: { operationId, input },
      });
      expect(result.isError).toBe(false);
      const raw = operationId === 'client.files.write';
      const request = harness.requests.at(-1)!;
      expect({
        ...request,
        body: request.body && !raw ? (JSON.parse(request.body) as unknown) : request.body,
      }).toEqual({
        method,
        url: path + (raw ? '?file=%2Fserverconfig.json' : ''),
        auth: `Bearer ${operationId.startsWith('application.') ? 'ptla' : 'ptlc'}_fixture`,
        body: 'body' in input ? input.body : '',
        type: 'body' in input ? (raw ? 'text/plain' : 'application/json') : undefined,
      });
    },
  );
  it('has an independent wire contract for every executable catalogue operation', () => {
    expect(contracts.map((row) => row[0]).sort()).toEqual(
      operations
        .filter((operation) => operation.status === 'implemented')
        .map((operation) => operation.id)
        .sort(),
    );
  });
});
