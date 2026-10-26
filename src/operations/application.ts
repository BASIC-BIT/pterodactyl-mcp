import * as z from 'zod/v4';
import { define } from './define.js';
import { environment, featureLimits, id, limits, nonnegative, query, text } from './schemas.js';

const user = z
  .object({
    email: z.email().max(191),
    username: text,
    first_name: text,
    last_name: text,
    password: z.string().max(4096).nullable().optional(),
    external_id: text.nullable().optional(),
    language: z.string().max(16).optional(),
    root_admin: z.boolean().optional(),
  })
  .strict();
const node = z
  .object({
    name: z.string().min(1).max(100),
    description: z.string().max(4096).nullable().optional(),
    location_id: id,
    fqdn: text,
    scheme: z.enum(['http', 'https']),
    public: z.boolean().optional(),
    behind_proxy: z.boolean().optional(),
    maintenance_mode: z.boolean().optional(),
    memory: id,
    memory_overallocate: z.number().min(-1),
    disk: id,
    disk_overallocate: z.number().min(-1),
    upload_size: id.optional(),
    daemon_listen: id.max(65535),
    daemon_sftp: id.max(65535),
    daemon_base: z.string().max(4096).startsWith('/').optional(),
  })
  .strict();
const location = z
  .object({ short: z.string().min(1).max(60), long: text.nullable().optional() })
  .strict();
const createServer = z
  .object({
    external_id: text.nullable().optional(),
    name: text,
    description: z.string().max(4096).nullable().optional(),
    user: id,
    egg: id,
    docker_image: text,
    startup: z.string().min(1).max(65536),
    environment,
    skip_scripts: z.boolean().optional(),
    oom_disabled: z.boolean().optional(),
    limits,
    feature_limits: featureLimits,
    allocation: z
      .object({ default: id, additional: z.array(id).max(100).optional() })
      .strict()
      .optional(),
    deploy: z
      .object({
        locations: z.array(id).max(100),
        dedicated_ip: z.boolean(),
        port_range: z.array(z.string().min(1).max(32)).max(100),
      })
      .strict()
      .optional(),
    start_on_completion: z.boolean().optional(),
  })
  .strict()
  .describe(
    'Choose exactly one placement strategy: allocation or deploy. Resource and feature limits are required.',
  )
  .refine(
    (value) => Boolean(value.allocation) !== Boolean(value.deploy),
    'Choose allocation or deploy.',
  );
const build = z
  .object({
    allocation: id,
    oom_disabled: z.boolean().optional(),
    limits: limits.optional(),
    ...limits.partial().shape,
    feature_limits: featureLimits,
    add_allocations: z.array(id).max(100).optional(),
    remove_allocations: z.array(id).max(100).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.limits !== undefined ||
      ['memory', 'swap', 'disk', 'io', 'cpu'].every((key) => key in value),
    'Supply limits or all legacy resource fields.',
  );
const app = (
  name: string,
  method: Parameters<typeof define>[2],
  suffix: string,
  options?: Parameters<typeof define>[4],
) => define('application', name, method, suffix, options);

export const applicationOperations = [
  app('users.list', 'GET', '/users'),
  app('users.get', 'GET', '/users/{user}'),
  app('users.external', 'GET', '/users/external/{external_id}'),
  app('users.create', 'POST', '/users', { body: user }),
  app('users.update', 'PATCH', '/users/{user}', { body: user }),
  app('users.delete', 'DELETE', '/users/{user}'),
  app('nodes.list', 'GET', '/nodes'),
  app('nodes.deployable', 'GET', '/nodes/deployable', {
    query: query.extend({
      memory: nonnegative.int(),
      disk: nonnegative.int(),
      location_ids: z.array(id).max(100).optional(),
    }),
  }),
  app('nodes.get', 'GET', '/nodes/{node}'),
  app('nodes.create', 'POST', '/nodes', { body: node }),
  app('nodes.update', 'PATCH', '/nodes/{node}', { body: node }),
  app('nodes.delete', 'DELETE', '/nodes/{node}'),
  app('nodes.allocations.list', 'GET', '/nodes/{node}/allocations'),
  app('nodes.allocations.create', 'POST', '/nodes/{node}/allocations', {
    body: z
      .object({
        ip: text,
        alias: text.nullable().optional(),
        ports: z.array(z.string().min(1).max(32)).min(1).max(1000),
      })
      .strict(),
  }),
  app('nodes.allocations.delete', 'DELETE', '/nodes/{node}/allocations/{allocation}'),
  app('locations.list', 'GET', '/locations'),
  app('locations.get', 'GET', '/locations/{location}'),
  app('locations.create', 'POST', '/locations', { body: location }),
  app('locations.update', 'PATCH', '/locations/{location}', { body: location }),
  app('locations.delete', 'DELETE', '/locations/{location}'),
  app('servers.list', 'GET', '/servers'),
  app('servers.get', 'GET', '/servers/{server}'),
  app('servers.external', 'GET', '/servers/external/{external_id}'),
  app('servers.details', 'PATCH', '/servers/{server}/details', {
    body: z
      .object({
        external_id: text.nullable().optional(),
        name: text,
        user: id,
        description: z.string().max(4096).nullable().optional(),
      })
      .strict(),
  }),
  app('servers.build', 'PATCH', '/servers/{server}/build', { body: build }),
  app('servers.startup', 'PATCH', '/servers/{server}/startup', {
    body: z
      .object({
        startup: z.string().min(1).max(65536),
        environment,
        egg: id,
        image: text,
        skip_scripts: z.boolean(),
      })
      .strict(),
  }),
  app('servers.create', 'POST', '/servers', { body: createServer }),
  ...(['suspend', 'unsuspend', 'reinstall'] as const).map((action) =>
    app(`servers.${action}`, 'POST', `/servers/{server}/${action}`),
  ),
  app('servers.delete', 'DELETE', '/servers/{server}'),
  app('servers.force_delete', 'DELETE', '/servers/{server}/{force?}'),
  app('servers.databases.list', 'GET', '/servers/{server}/databases'),
  app('servers.databases.get', 'GET', '/servers/{server}/databases/{database}'),
  app('servers.databases.create', 'POST', '/servers/{server}/databases', {
    body: z
      .object({
        database: z.string().regex(/^[A-Za-z0-9_-]{1,48}$/),
        remote: z.string().regex(/^[0-9%.]{1,15}$/),
        host: id,
      })
      .strict(),
  }),
  app(
    'servers.databases.reset_password',
    'POST',
    '/servers/{server}/databases/{database}/reset-password',
  ),
  app('servers.databases.delete', 'DELETE', '/servers/{server}/databases/{database}'),
  app('nests.list', 'GET', '/nests'),
  app('nests.get', 'GET', '/nests/{nest}'),
  app('nests.eggs.list', 'GET', '/nests/{nest}/eggs'),
  app('nests.eggs.get', 'GET', '/nests/{nest}/eggs/{egg}'),
];
