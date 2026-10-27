import * as z from 'zod/v4';

export const id = z.number().int().positive();
export const nonnegative = z.number().finite().min(0);
export const text = z.string().min(1).max(191);
export const identifier = z
  .string()
  .min(1)
  .max(191)
  .regex(/^[A-Za-z0-9_-]+$/);
export const serverIdentifier = z
  .string()
  .regex(/^(?:[a-f0-9]{8}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/);
export const uuid = z.uuid();
export const power = z.enum(['start', 'stop', 'restart', 'kill']);
export const scalar = z.union([z.string().max(4096), z.number().finite(), z.boolean()]);
export const query = z
  .object({ page: id.optional(), per_page: id.max(100).optional() })
  .catchall(z.union([scalar, z.array(scalar).max(100)]));
export const filePath = z
  .string()
  .min(1)
  .max(4096)
  .refine(
    (value) =>
      !value.includes('\\') && [...value].every((character) => character.charCodeAt(0) >= 32),
  )
  .refine(
    (value) => !value.split('/').some((segment) => segment === '..' || segment === '.'),
    'Use a normalized path inside the server root.',
  );
export const filename = z
  .string()
  .min(1)
  .max(255)
  .refine(
    (value) =>
      !value.includes('/') &&
      !value.includes('\\') &&
      [...value].every((character) => character.charCodeAt(0) >= 32),
  )
  .refine((value) => value !== '.' && value !== '..');
export const environment = z.record(z.string().min(1).max(191), scalar.nullable());
export const limits = z
  .object({
    memory: nonnegative,
    swap: z.number().finite().min(-1),
    disk: nonnegative,
    io: z.number().min(10).max(1000),
    cpu: nonnegative,
    threads: z
      .string()
      .regex(/^[0-9,-]+$/)
      .nullable()
      .optional(),
  })
  .strict();
export const featureLimits = z
  .object({
    databases: nonnegative.int().nullable(),
    allocations: nonnegative.int().nullable().optional(),
    backups: nonnegative.int().nullable(),
  })
  .strict();
