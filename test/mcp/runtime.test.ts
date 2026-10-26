import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { expect, it } from 'vitest';
import { startStdio } from '../../src/runtime.js';

it('speaks the real wire protocol and cleans up repeated shutdown signals and EOF', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const signals = new EventEmitter();
  let wire = '';
  output.on('data', (chunk: Buffer) => {
    wire += chunk.toString();
  });
  const session = await startStdio(
    {
      PTERODACTYL_URL: 'https://panel.example.test',
      PTERODACTYL_CLIENT_KEY: 'ptlc_fixture',
    },
    { input, output, signals },
  );
  input.write(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'wire-fixture', version: '0' },
      },
    }) + '\n',
  );
  await expect.poll(() => wire).toContain('"id":1');
  expect(JSON.parse(wire.trim())).toMatchObject({
    result: { serverInfo: { name: 'pterodactyl-mcp' } },
  });
  signals.emit('SIGTERM');
  signals.emit('SIGINT');
  input.end();
  await session.close();
  await session.close();
  expect(signals.listenerCount('SIGTERM')).toBe(0);
  expect(signals.listenerCount('SIGINT')).toBe(0);
  expect(input.listenerCount('end')).toBe(0);
});

it('rejects invalid startup configuration before owning streams or signal handlers', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const signals = new EventEmitter();
  await expect(startStdio({}, { input, output, signals })).rejects.toThrow(/origin/i);
  expect(signals.eventNames()).toEqual([]);
});
