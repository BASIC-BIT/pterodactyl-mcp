import type { McpServer } from '@modelcontextprotocol/server';
import type { PanelClient } from '../api/client.js';
import { FileTransfer } from '../files/transfer.js';
import { hashSchema, uploadSchema } from '../files/schemas.js';
import { consoleSchema, consoleTail } from '../console/tail.js';
import { toolFailure, toolResult } from './results.js';

export function registerFocusedTools(server: McpServer, provider: PanelClient): void {
  const files = new FileTransfer(provider);
  const run = async (action: () => Promise<unknown>) => {
    try {
      return toolResult(provider.config.label, await action());
    } catch (error) {
      return toolFailure(provider.config.label, error);
    }
  };
  server.registerTool(
    'ptero_file_upload',
    {
      description:
        'Upload a ChatGPT artifact to a server directory, then verify its destination SHA-256. Maximum 64 MiB. Requires enabled writes and operator configured HTTPS Wings origins. Unknown completion means inspect the destination before retrying.',
      inputSchema: uploadSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: { 'openai/fileParams': ['file'] },
    },
    (input, context) => run(() => files.upload(input, context.mcpReq.signal)),
  );
  server.registerTool(
    'ptero_file_hash',
    {
      description:
        'Download up to 64 MiB internally to hash a server file. Returns SHA-256 and byte count without exposing the signed URL or file contents. Optionally compare an expected SHA-256.',
      inputSchema: hashSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    (input, context) => run(() => files.fileHash(input, context.mcpReq.signal)),
  );
  server.registerTool(
    'ptero_console_tail',
    {
      description:
        'Capture a bounded console tail through an authenticated Wings WebSocket. Maximum 30 seconds, 200 lines and 24 KiB. Tokens stay internal. Expired authentication closes capture; a fresh call obtains a new token.',
      inputSchema: consoleSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    (input, context) => run(() => consoleTail(provider, input, { signal: context.mcpReq.signal })),
  );
}
