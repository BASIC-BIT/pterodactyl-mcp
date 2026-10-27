import * as z from 'zod/v4';
import routes from '../generated/provider-routes.json' with { type: 'json' };
import type { Operation } from './types.js';

const routeSchema = z
  .object({
    family: z.enum(['application', 'client']),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
    path: z.string().startsWith('/api/'),
  })
  .strict();

export function inventory(implemented: readonly Operation[]): readonly Operation[] {
  const byRoute = new Map(
    implemented.map((operation) => [`${operation.method} ${operation.path}`, operation]),
  );
  return z
    .array(routeSchema)
    .parse(routes)
    .map((route): Operation => {
      const known = byRoute.get(`${route.method} ${route.path}`);
      if (known) return known;
      return {
        ...route,
        id: `${route.family}.${route.method.toLowerCase()}.${route.path
          .replace(/^\/api\/(application|client)\/?/, '')
          .replace(/[^A-Za-z0-9]+/g, '.')
          .replace(/\.$/, '')}`,
        status: 'pending',
        reason:
          'Provider route identified. Implementation and parameter/response contract validation are pending.',
      };
    });
}
