import * as z from 'zod/v4';
import { define } from './define.js';
import { filePath, filename, id, nonnegative, power, query, scalar, text } from './schemas.js';

const path = '/servers/{server}';
const client = (
  name: string,
  method: Parameters<typeof define>[2],
  suffix: string,
  options?: Parameters<typeof define>[4],
) => define('client', name, method, suffix, options);
const schedule = z
  .object({
    name: text,
    minute: text,
    hour: text,
    day_of_month: text,
    month: text,
    day_of_week: text,
    is_active: z.boolean().optional(),
    only_when_online: z.boolean().optional(),
  })
  .strict();
const taskOptions = {
  time_offset: nonnegative.max(900),
  sequence_id: id.optional(),
  continue_on_failure: z.boolean().optional(),
};
const task = z.discriminatedUnion('action', [
  z.object({ action: z.literal('power'), payload: power, ...taskOptions }).strict(),
  z
    .object({ action: z.literal('command'), payload: z.string().min(1).max(65536), ...taskOptions })
    .strict(),
  z
    .object({
      action: z.literal('backup'),
      payload: z.string().max(65536).nullable().optional(),
      ...taskOptions,
    })
    .strict(),
]);
const fileSet = z
  .object({ root: filePath.nullable().optional(), files: z.array(filePath).min(1).max(1000) })
  .strict();

export const clientOperations = [
  client('servers.list', 'GET', ''),
  client('permissions', 'GET', '/permissions'),
  client('account.get', 'GET', '/account'),
  client('account.activity', 'GET', '/account/activity'),
  client('servers.get', 'GET', path),
  client('servers.resources', 'GET', `${path}/resources`),
  client('servers.activity', 'GET', `${path}/activity`),
  client('servers.command', 'POST', `${path}/command`, {
    body: z.object({ command: z.string().min(1).max(65536) }).strict(),
  }),
  client('servers.power', 'POST', `${path}/power`, { body: z.object({ signal: power }).strict() }),
  client('databases.list', 'GET', `${path}/databases`),
  client('databases.create', 'POST', `${path}/databases`, {
    body: z
      .object({
        database: z.string().regex(/^[A-Za-z0-9_-]{3,48}$/),
        remote: z
          .string()
          .min(1)
          .max(191)
          .regex(/^[\w\-/.%:]+$/),
      })
      .strict(),
  }),
  client('databases.rotate_password', 'POST', `${path}/databases/{database}/rotate-password`),
  client('databases.delete', 'DELETE', `${path}/databases/{database}`),
  client('files.list', 'GET', `${path}/files/list`, {
    query: query.extend({ directory: filePath.optional() }).optional(),
  }),
  client('files.contents', 'GET', `${path}/files/contents`, {
    query: query.extend({ file: filePath }),
  }),
  client('files.rename', 'PUT', `${path}/files/rename`, {
    body: z
      .object({
        root: filePath.nullable(),
        files: z
          .array(z.object({ from: filePath, to: filePath }).strict())
          .min(1)
          .max(1000),
      })
      .strict(),
  }),
  client('files.copy', 'POST', `${path}/files/copy`, {
    body: z.object({ location: filePath }).strict(),
  }),
  client('files.write', 'POST', `${path}/files/write`, {
    query: z.object({ file: filePath }).strict(),
    body: z.string().max(1024 * 1024),
    encoding: 'text',
  }),
  client('files.compress', 'POST', `${path}/files/compress`, { body: fileSet }),
  client('files.decompress', 'POST', `${path}/files/decompress`, {
    body: z.object({ root: filePath.nullable().optional(), file: filePath }).strict(),
  }),
  client('files.delete', 'POST', `${path}/files/delete`, { body: fileSet }),
  client('files.create_folder', 'POST', `${path}/files/create-folder`, {
    body: z.object({ root: filePath.nullable().optional(), name: filename }).strict(),
  }),
  client('files.chmod', 'POST', `${path}/files/chmod`, {
    body: z
      .object({
        root: filePath.nullable(),
        files: z
          .array(z.object({ file: filePath, mode: z.string().regex(/^[0-7]{3,4}$/) }).strict())
          .min(1)
          .max(1000),
      })
      .strict(),
  }),
  client('schedules.list', 'GET', `${path}/schedules`),
  client('schedules.create', 'POST', `${path}/schedules`, { body: schedule }),
  client('schedules.get', 'GET', `${path}/schedules/{schedule}`),
  client('schedules.update', 'POST', `${path}/schedules/{schedule}`, { body: schedule }),
  client('schedules.execute', 'POST', `${path}/schedules/{schedule}/execute`),
  client('schedules.delete', 'DELETE', `${path}/schedules/{schedule}`),
  client('schedules.tasks.create', 'POST', `${path}/schedules/{schedule}/tasks`, { body: task }),
  client('schedules.tasks.update', 'POST', `${path}/schedules/{schedule}/tasks/{task}`, {
    body: task,
  }),
  client('schedules.tasks.delete', 'DELETE', `${path}/schedules/{schedule}/tasks/{task}`),
  client('allocations.list', 'GET', `${path}/network/allocations`),
  client('allocations.create', 'POST', `${path}/network/allocations`),
  client('allocations.update', 'POST', `${path}/network/allocations/{allocation}`, {
    body: z.object({ notes: z.string().max(4096).nullable() }).strict(),
  }),
  client('allocations.primary', 'POST', `${path}/network/allocations/{allocation}/primary`),
  client('allocations.delete', 'DELETE', `${path}/network/allocations/{allocation}`),
  client('users.list', 'GET', `${path}/users`),
  client('users.get', 'GET', `${path}/users/{user}`),
  client('users.create', 'POST', `${path}/users`, {
    body: z.object({ email: z.email().max(191), permissions: z.array(text).max(100) }).strict(),
  }),
  client('users.update', 'POST', `${path}/users/{user}`, {
    body: z.object({ permissions: z.array(text).max(100) }).strict(),
  }),
  client('users.delete', 'DELETE', `${path}/users/{user}`),
  client('backups.list', 'GET', `${path}/backups`),
  client('backups.create', 'POST', `${path}/backups`, {
    body: z
      .object({
        name: text.nullable().optional(),
        is_locked: z.boolean().nullable().optional(),
        ignored: z.string().max(65536).nullable().optional(),
      })
      .strict(),
  }),
  client('backups.get', 'GET', `${path}/backups/{backup}`),
  client('backups.lock', 'POST', `${path}/backups/{backup}/lock`),
  client('backups.restore', 'POST', `${path}/backups/{backup}/restore`, {
    body: z.object({ truncate: z.boolean() }).strict(),
  }),
  client('backups.delete', 'DELETE', `${path}/backups/{backup}`),
  client('startup.list', 'GET', `${path}/startup`),
  client('startup.update_variable', 'PUT', `${path}/startup/variable`, {
    body: z.object({ key: text, value: scalar.nullable() }).strict(),
  }),
  client('settings.rename', 'POST', `${path}/settings/rename`, {
    body: z
      .object({ name: text, description: z.string().max(4096).nullable().optional() })
      .strict(),
  }),
  client('settings.reinstall', 'POST', `${path}/settings/reinstall`),
  client('settings.docker_image', 'PUT', `${path}/settings/docker-image`, {
    body: z.object({ docker_image: text }).strict(),
  }),
];
