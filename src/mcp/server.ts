import { McpServer } from '@modelcontextprotocol/server';
import type { PanelConfig } from '../config.js';
import * as z from 'zod/v4';
import { PanelClient } from '../api/client.js';
import type { ClientOptions } from '../api/types.js';
import {
  operations,
  operationDetails,
  getOperation,
  prepareOperation,
} from '../operations/catalog.js';
import { toolResult, toolFailure } from './results.js';
import { registerFocusedTools } from './focused.js';

const readAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const writeAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
};

export function createServer(config: PanelConfig, options: ClientOptions = {}): McpServer {
  const server = new McpServer({ name: 'pterodactyl-mcp', version: '0.1.0' });
  const provider = new PanelClient(config, options);
  registerFocusedTools(server, provider);
  server.registerTool(
    'ptero_operations',
    {
      description:
        'Discover implemented, excluded and pending Pterodactyl operations. No provider request is made.',
      inputSchema: z.object({}).strict(),
      annotations: readAnnotations,
    },
    async () =>
      toolResult(
        config.label,
        operations.map(({ id, family, method, path, status }) => ({
          id,
          family,
          method,
          path,
          status,
        })),
      ),
  );
  server.registerTool(
    'ptero_operation_details',
    {
      description:
        'Inspect a Pterodactyl operation input schema, method and availability before calling it.',
      inputSchema: z.object({ operationId: z.string().min(1).max(120) }).strict(),
      annotations: readAnnotations,
    },
    async ({ operationId }) => {
      try {
        return toolResult(config.label, operationDetails(operationId));
      } catch (error) {
        return toolFailure(config.label, error);
      }
    },
  );
  for (const kind of ['read', 'write', 'delete'] as const) {
    server.registerTool(
      `ptero_${kind}`,
      {
        description: `${kind} a validated Pterodactyl operation. Discover operation IDs and input schemas first. Writes require operator enablement; failed writes may have unknown completion.`,
        inputSchema: z
          .object({
            operationId: z.string().min(1).max(120),
            input: z.record(z.string(), z.unknown()).default({}),
          })
          .strict(),
        annotations: kind === 'read' ? readAnnotations : writeAnnotations,
      },
      async ({ operationId, input }, extra) => {
        try {
          const operation = getOperation(operationId);
          const actualKind =
            operation.method === 'GET'
              ? 'read'
              : operation.method === 'DELETE'
                ? 'delete'
                : 'write';
          if (kind !== actualKind) throw new Error('Operation kind mismatch');
          return toolResult(
            config.label,
            await provider.request(prepareOperation(operationId, input), extra.mcpReq.signal),
          );
        } catch (error) {
          return toolFailure(config.label, error);
        }
      },
    );
  }
  return server;
}
