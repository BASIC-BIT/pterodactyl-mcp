import * as z from 'zod/v4';
import type { ApiFamily, ApiMethod } from '../api/types.js';
import type { Operation, OperationInput } from './types.js';
import { filename, id, identifier, query, serverIdentifier, uuid } from './schemas.js';

interface DefinitionOptions {
  body?: z.ZodType;
  query?: z.ZodType;
  encoding?: 'text';
}

function parameter(name: string, family: ApiFamily): z.ZodType<string | number> {
  if (name === 'force?') return z.literal('force');
  if (name === 'external_id') return filename.max(191);
  if (family === 'application') return id;
  if (name === 'server') return serverIdentifier;
  if (name === 'backup' || name === 'user') return uuid;
  if (name === 'database') return identifier;
  return id;
}

export function define(
  family: ApiFamily,
  name: string,
  method: ApiMethod,
  suffix: string,
  options: DefinitionOptions = {},
): Operation {
  const params = Object.fromEntries(
    [...suffix.matchAll(/\{([^}]+)\}/g)].map((match) => {
      const name = match[1]!;
      return [name.replace(/\?$/, ''), parameter(name, family)];
    }),
  );
  const shape: Record<string, z.ZodType> = {};
  if (Object.keys(params).length) shape.path = z.object(params).strict();
  if (method === 'GET' || options.query) shape.query = options.query ?? query.optional();
  if (options.body) shape.body = options.body;
  return {
    id: `${family}.${name}`,
    family,
    method,
    path: `/api/${family}${suffix}`,
    status: 'implemented',
    inputSchema: z.object(shape).strict() as z.ZodType<OperationInput>,
    ...(options.encoding ? { encoding: options.encoding } : {}),
  };
}
