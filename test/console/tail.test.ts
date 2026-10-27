import { WebSocketServer, WebSocket } from 'ws';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';
import { PanelClient } from '../../src/api/client.js';
import { consoleTail } from '../../src/console/tail.js';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanups.splice(0)) await close();
});
async function fixture(
  events = [JSON.stringify({ event: 'console output', args: ['ready\nlistening'] })],
) {
  const received: unknown[] = [];
  const ws = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await new Promise<void>((resolve) => ws.once('listening', resolve));
  const address = ws.address();
  if (typeof address === 'string' || address === null) throw new Error('Expected TCP socket');
  ws.on('connection', (socket) =>
    socket.on('message', (data) => {
      const message: unknown = JSON.parse(data.toString());
      received.push(message);
      if (received.length === 1) socket.send(JSON.stringify({ event: 'auth success', args: [] }));
      else for (const event of events) socket.send(event);
    }),
  );
  cleanups.push(async () => {
    for (const socket of ws.clients) socket.terminate();
    await new Promise<void>((resolve) => ws.close(() => resolve()));
  });
  const config = loadConfig({
    PTERODACTYL_URL: 'https://panel.example.test',
    PTERODACTYL_CLIENT_KEY: 'ptlc_fixture',
    PTERODACTYL_WINGS_ORIGINS: '["https://wings.example.test"]',
  });
  const provider = new PanelClient(config, {
    fetch: async () =>
      Response.json({
        data: {
          token: 'synthetic_ws_token',
          socket: 'wss://wings.example.test/api/servers/1234abcd-1234-4123-8123-123456789abc/ws',
        },
      }),
  });
  return { provider, received, ws, connect: () => new WebSocket(`ws://127.0.0.1:${address.port}`) };
}

describe('bounded console tail over a real WebSocket', () => {
  it('authenticates, requests logs, respects the line cap and closes the connection without leaking the token', async () => {
    const { provider, received, connect, ws } = await fixture();
    const result = await consoleTail(
      provider,
      { server: '1234abcd', maxLines: 2, durationMs: 1000 },
      { connect },
    );
    expect(received).toEqual([
      { event: 'auth', args: ['synthetic_ws_token'] },
      { event: 'send logs', args: [] },
    ]);
    expect(result).toMatchObject({ lines: ['ready', 'listening'], truncated: true });
    expect(JSON.stringify(result)).not.toContain('synthetic_ws_token');
    await expect.poll(() => ws.clients.size).toBe(0);
  });
  it('ends at the duration bound even when the daemon is silent after authentication', async () => {
    const { provider, connect } = await fixture([]);
    await expect(
      consoleTail(provider, { server: '1234abcd', durationMs: 30 }, { connect }),
    ).resolves.toMatchObject({ lines: [], truncated: false });
  });
  it.each(['jwt error', 'token expired', 'token expiring'])(
    'fails safely and closes for token lifecycle event %s',
    async (event) => {
      const { provider, connect } = await fixture([
        JSON.stringify({ event, args: ['private token detail'] }),
      ]);
      await expect(
        consoleTail(provider, { server: '1234abcd', durationMs: 1000 }, { connect }),
      ).rejects.toMatchObject({ code: 'console_auth_failed' });
    },
  );
  it('rejects an untrusted socket before opening a connection', async () => {
    const { provider } = await fixture();
    let opened = false;
    const untrusted = new PanelClient({ ...provider.config, wingsOrigins: [] }, provider.options);
    await expect(
      consoleTail(
        untrusted,
        { server: '1234abcd' },
        {
          connect: () => {
            opened = true;
            throw new Error('Must not connect');
          },
        },
      ),
    ).rejects.toMatchObject({ code: 'invalid_destination' });
    expect(opened).toBe(false);
  });
  it('cancels an in-flight capture and closes the socket', async () => {
    const { provider, connect, received, ws } = await fixture([]);
    const controller = new AbortController();
    const capture = consoleTail(
      provider,
      { server: '1234abcd', durationMs: 1000 },
      { connect, signal: controller.signal },
    );
    const assertion = expect(capture).rejects.toMatchObject({ code: 'request_failed' });
    await expect.poll(() => received.length).toBe(2);
    controller.abort();
    await assertion;
    await expect.poll(() => ws.clients.size).toBe(0);
  });
});
