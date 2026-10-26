import WebSocket from 'ws';
import type { RawData } from 'ws';
import { stripVTControlCharacters } from 'node:util';
import * as z from 'zod/v4';
import type { PanelClient } from '../api/client.js';
import { PanelError } from '../api/errors.js';
import { wingsUrl } from '../files/destinations.js';
import { serverIdentifier } from '../operations/schemas.js';

export const consoleSchema = z
  .object({
    server: serverIdentifier,
    durationMs: z.number().int().min(25).max(30_000).default(3000),
    maxLines: z.number().int().min(1).max(200).default(100),
  })
  .strict();
const credentialsSchema = z.object({
  data: z.object({ token: z.string().min(1).max(16384), socket: z.string() }),
});
const eventSchema = z.object({ event: z.string(), args: z.array(z.unknown()).default([]) });
interface ConsoleOptions {
  signal?: AbortSignal;
  connect?: (url: string) => WebSocket;
}
interface CaptureResult {
  lines: string[];
  truncated: boolean;
}

function socketUrl(value: string, server: string, origins: readonly string[]): string {
  if (!value.startsWith('wss://')) throw new PanelError('invalid_destination');
  const url = new URL(value);
  const match = /^\/api\/servers\/([a-f0-9-]{36})\/ws$/.exec(url.pathname);
  if (!match?.[1]?.startsWith(server)) throw new PanelError('invalid_destination');
  wingsUrl(value.replace(/^wss:/, 'https:'), origins, url.pathname);
  return value;
}

function appendLines(result: CaptureResult, args: unknown[], maxLines: number): void {
  for (const value of args) {
    if (typeof value !== 'string') continue;
    for (const line of stripVTControlCharacters(value).split(/\r?\n/)) {
      const clean = [...line]
        .filter((character) => character.charCodeAt(0) >= 32 || character === '\t')
        .join('');
      const remaining = 24 * 1024 - Buffer.byteLength(result.lines.join('\n'));
      result.lines.push(Buffer.from(clean).subarray(0, Math.max(0, remaining)).toString('utf8'));
      if (result.lines.length >= maxLines || Buffer.byteLength(clean) >= remaining) {
        result.truncated = true;
        return;
      }
    }
  }
}

function capture(
  socket: WebSocket,
  token: string,
  input: z.infer<typeof consoleSchema>,
  signal: AbortSignal,
): Promise<CaptureResult> {
  return new Promise((resolve, reject) => {
    const result: CaptureResult = { lines: [], truncated: false };
    let done = false;
    let authenticated = false;
    const finish = (error?: PanelError) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      socket.removeListener('message', message);
      socket.removeListener('open', open);
      socket.terminate();
      if (error) reject(error);
      else resolve(result);
    };
    const abort = () => finish(new PanelError('request_failed'));
    const open = () => socket.send(JSON.stringify({ event: 'auth', args: [token] }));
    const message = (data: RawData) => {
      try {
        const value: unknown = JSON.parse(data.toString());
        const event = eventSchema.parse(value);
        if (['jwt error', 'token expired', 'token expiring'].includes(event.event))
          throw new PanelError('console_auth_failed');
        if (event.event === 'auth success' && !authenticated) {
          authenticated = true;
          socket.send(JSON.stringify({ event: 'send logs', args: [] }));
        }
        if (event.event === 'console output' && authenticated) {
          appendLines(result, event.args, input.maxLines);
          if (result.truncated) finish();
        }
      } catch (error) {
        finish(error instanceof PanelError ? error : new PanelError('request_failed'));
      }
    };
    const error = () => finish(new PanelError('request_failed'));
    const close = () => {
      if (!done) finish(authenticated ? undefined : new PanelError('request_failed'));
      socket.removeListener('error', error);
      socket.removeListener('close', close);
    };
    const timer = setTimeout(
      () => finish(authenticated ? undefined : new PanelError('request_failed')),
      input.durationMs,
    );
    socket.on('error', error);
    socket.on('close', close);
    socket.on('open', open);
    socket.on('message', message);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

export async function consoleTail(
  provider: PanelClient,
  value: unknown,
  options: ConsoleOptions = {},
): Promise<CaptureResult> {
  const input = consoleSchema.parse(value);
  const signal = AbortSignal.any(
    [options.signal, provider.options.signal].filter(
      (value): value is AbortSignal => value !== undefined,
    ),
  );
  const result = credentialsSchema.parse(
    await provider.request(
      { family: 'client', method: 'GET', path: `/api/client/servers/${input.server}/websocket` },
      signal,
    ),
  );
  const url = socketUrl(result.data.socket, input.server, provider.config.wingsOrigins);
  const connect =
    options.connect ??
    ((url: string) =>
      new WebSocket(url, {
        followRedirects: false,
        rejectUnauthorized: true,
        handshakeTimeout: 10_000,
        maxPayload: 64 * 1024,
      }));
  return capture(connect(url), result.data.token, input, signal);
}
