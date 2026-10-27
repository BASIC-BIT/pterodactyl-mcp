import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import type { EventEmitter } from 'node:events';
import type { Readable, Writable } from 'node:stream';
import { loadConfig } from './config.js';
import { createServer } from './mcp/server.js';

interface StdioOptions {
  input: Readable;
  output: Writable;
  signals: EventEmitter;
}

export async function startStdio(
  env: Readonly<Record<string, string | undefined>>,
  { input, output, signals }: StdioOptions = {
    input: process.stdin,
    output: process.stdout,
    signals: process,
  },
) {
  const controller = new AbortController();
  const server = createServer(loadConfig(env), { signal: controller.signal });
  await server.connect(new StdioServerTransport(input, output));
  const settled = Promise.withResolvers<void>();
  let closing: Promise<void> | undefined;
  const close = (): Promise<void> => {
    if (closing) return closing;
    signals.removeListener('SIGINT', shutdown);
    signals.removeListener('SIGTERM', shutdown);
    input.removeListener('end', shutdown);
    controller.abort();
    closing = server.close();
    void closing.then(settled.resolve, settled.reject);
    return closing;
  };
  const shutdown = () => {
    void close().catch(() => undefined);
  };
  signals.once('SIGINT', shutdown);
  signals.once('SIGTERM', shutdown);
  input.once('end', shutdown);
  return { close, closed: settled.promise };
}
