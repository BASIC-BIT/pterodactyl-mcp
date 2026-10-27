import type * as z from 'zod/v4';
import type { ApiFamily, ApiMethod } from '../api/types.js';

export interface OperationInput {
  path?: Record<string, string | number> | undefined;
  query?: Record<string, string | number | boolean | (string | number | boolean)[]> | undefined;
  body?: unknown;
}

interface Route {
  readonly encoding?: 'text';
  readonly id: string;
  readonly family: ApiFamily;
  readonly method: ApiMethod;
  readonly path: string;
}

export type Operation = Route &
  (
    | { readonly status: 'implemented'; readonly inputSchema: z.ZodType<OperationInput> }
    | { readonly status: 'excluded' | 'pending'; readonly reason: string }
    | { readonly status: 'workflow'; readonly reason: string; readonly tool: string }
  );
