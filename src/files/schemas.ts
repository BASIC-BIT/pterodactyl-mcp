import * as z from 'zod/v4';
import { filename, filePath, serverIdentifier } from '../operations/schemas.js';

export const uploadSchema = z
  .object({
    server: serverIdentifier,
    directory: filePath.startsWith('/'),
    name: filename,
    file: z
      .object({
        download_url: z.url().max(8192),
        file_id: z.string().max(512).optional(),
        name: z.string().max(255).optional(),
        mime_type: z.string().max(191).optional(),
      })
      .strict(),
    sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  })
  .strict();
export type UploadInput = z.infer<typeof uploadSchema>;
export const hashSchema = z
  .object({
    server: serverIdentifier,
    file: filePath,
    sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  })
  .strict();
export const signedUrlSchema = z.object({ attributes: z.object({ url: z.string() }) });
