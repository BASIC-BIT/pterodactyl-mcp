import { expect, it } from 'vitest';
import { contractHarness } from '../helpers/harness.js';
import { mutationContracts } from '../fixtures/contracts.js';

it('provisions an owned disposable fixture, configures startup, controls power and backups, then removes it', async () => {
  let exists = false;
  let power = 'offline';
  let world = 'initial';
  let backup = false;
  let restored = false;
  const backupId = '00000000-0000-4000-8000-000000000001';
  const routes: Record<
    string,
    (body: Record<string, unknown>) => { status: number; body: unknown }
  > = {
    'POST /api/application/servers': () => {
      exists = true;
      return { status: 201, body: { attributes: { id: 42, identifier: '1234abcd' } } };
    },
    'POST /api/client/servers/1234abcd/power': (body) => {
      power = body.signal === 'start' ? 'running' : 'offline';
      return { status: 204, body: null };
    },
    'PUT /api/client/servers/1234abcd/startup/variable': (body) => {
      world = String(body.value);
      return { status: 204, body: null };
    },
    'GET /api/client/servers/1234abcd/resources': () => ({
      status: 200,
      body: { attributes: { current_state: power } },
    }),
    'POST /api/client/servers/1234abcd/backups': () => {
      backup = true;
      return { status: 201, body: { attributes: { uuid: backupId } } };
    },
    [`POST /api/client/servers/1234abcd/backups/${backupId}/restore`]: (body) => {
      restored = backup && body.truncate === false;
      return { status: 204, body: null };
    },
    [`DELETE /api/client/servers/1234abcd/backups/${backupId}`]: () => {
      backup = false;
      return { status: 204, body: null };
    },
    'DELETE /api/application/servers/42': () => {
      exists = false;
      return { status: 204, body: null };
    },
  };
  const harness = await contractHarness((request) => {
    const key = `${request.method} ${request.url}`;
    const handler = routes[key];
    if (!handler || (!exists && key !== 'POST /api/application/servers'))
      return { status: 404, body: { errors: [{ code: 'NotFound' }] } };
    return handler(JSON.parse(request.body || '{}') as Record<string, unknown>);
  });
  const call = (operationId: string, input: Record<string, unknown>, kind = 'write') =>
    harness.client.callTool({ name: `ptero_${kind}`, arguments: { operationId, input } });
  try {
    const create = mutationContracts.find((row) => row[0] === 'application.servers.create')!;
    const provisioned = await call('application.servers.create', create[3]);
    expect(provisioned.structuredContent).toMatchObject({
      result: { attributes: { id: 42, identifier: '1234abcd' } },
    });
    expect(exists).toBe(true);
    expect(power).toBe('offline');
    const path = { server: '1234abcd' };
    expect(
      (
        await call('client.startup.update_variable', {
          path,
          body: { key: 'WORLD', value: 'fixture-world' },
        })
      ).isError,
    ).toBe(false);
    expect(world).toBe('fixture-world');
    await call('client.servers.power', { path, body: { signal: 'start' } });
    expect(
      (await call('client.servers.resources', { path }, 'read')).structuredContent,
    ).toMatchObject({ result: { attributes: { current_state: 'running' } } });
    await call('client.backups.create', { path, body: { name: 'fixture-only' } });
    expect(backup).toBe(true);
    await call('client.backups.restore', {
      path: { ...path, backup: backupId },
      body: { truncate: false },
    });
    expect(restored).toBe(true);
    await call('client.backups.delete', { path: { ...path, backup: backupId } }, 'delete');
    expect(backup).toBe(false);
    await call('application.servers.delete', { path: { server: 42 } }, 'delete');
    expect(exists).toBe(false);
    const removed = await call('application.servers.get', { path: { server: 42 } }, 'read');
    expect(removed.structuredContent).toMatchObject({ error: { status: 404 } });
    expect(
      harness.requests.filter(
        (request) => request.method === 'POST' && request.url === '/api/application/servers',
      ),
    ).toHaveLength(1);
  } finally {
    await harness.close();
  }
});
