import type { PanelRequest } from '../api/types.js';
import type { Operation } from './types.js';
import * as z from 'zod/v4';
import { definedOperations } from './definitions.js';
import { inventory } from './inventory.js';

export const operations: readonly Operation[] = inventory(definedOperations);

export function getOperation(id: string): Operation {
  const operation = operations.find((op) => op.id === id);
  if (!operation) throw new Error('Unknown operation. Discover available operations first.');
  return operation;
}

export function operationDetails(id: string): Record<string, unknown> {
  const operation = getOperation(id);
  if (operation.status !== 'implemented') return { ...operation };
  const { inputSchema, ...metadata } = operation;
  return { ...metadata, inputSchema: z.toJSONSchema(inputSchema) };
}

export function prepareOperation(id: string, input: unknown): PanelRequest {
  const operation = getOperation(id);
  if (operation.status !== 'implemented')
    throw new Error(`Operation is ${operation.status}: ${operation.reason}`);
  const parsed = operation.inputSchema.safeParse(input);
  if (!parsed.success)
    throw new Error('Invalid operation input. Inspect the operation input schema.');
  const args = parsed.data;
  const path = operation.path.replace(/\{([^}]+)\}/g, (_match, name: string) => {
    const value = args.path?.[name.replace(/\?$/, '')];
    if (value === undefined) throw new Error('A required provider path parameter is missing.');
    return encodeURIComponent(String(value));
  });
  return {
    family: operation.family,
    method: operation.method,
    path,
    ...(operation.encoding ? { encoding: operation.encoding } : {}),
    ...(args.query === undefined ? {} : { query: args.query }),
    ...(args.body === undefined ? {} : { body: args.body }),
  };
}
