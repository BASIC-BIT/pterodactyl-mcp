import { createHash } from 'node:crypto';
import type { PanelClient } from '../api/client.js';
import type { PanelFetch } from '../api/types.js';
import { PanelError } from '../api/errors.js';
import { readBytes } from '../api/response.js';
import { artifactUrl, wingsUrl } from './destinations.js';
import { hashSchema, signedUrlSchema, uploadSchema } from './schemas.js';

interface TransferOptions {
  fetch?: PanelFetch;
  maxBytes?: number;
}
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

export class FileTransfer {
  private busy = false;
  constructor(
    private readonly provider: PanelClient,
    private readonly options: TransferOptions = {},
  ) {}

  private deadline(signal?: AbortSignal): AbortSignal {
    return AbortSignal.any([
      AbortSignal.timeout(120_000),
      ...[signal, this.provider.options.signal].filter(
        (value): value is AbortSignal => value !== undefined,
      ),
    ]);
  }

  private async send(url: URL, init: RequestInit): Promise<Response> {
    const response = await (this.options.fetch ?? this.provider.options.fetch ?? fetch)(url, {
      ...init,
      redirect: 'manual',
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new PanelError(
        response.status >= 300 && response.status < 400 ? 'redirect_refused' : 'provider_error',
        response.status,
      );
    }
    return response;
  }

  private async destinationHash(server: string, file: string, signal: AbortSignal) {
    const result = signedUrlSchema.parse(
      await this.provider.request(
        {
          family: 'client',
          method: 'GET',
          path: `/api/client/servers/${server}/files/download`,
          query: { file },
        },
        signal,
      ),
    );
    const url = wingsUrl(
      result.attributes.url,
      this.provider.config.wingsOrigins,
      '/download/file',
    );
    const bytes = await readBytes(
      await this.send(url, { method: 'GET', signal }),
      this.options.maxBytes ?? 64 * 1024 * 1024,
    );
    return { bytes: bytes.length, sha256: hash(bytes) };
  }

  async fileHash(value: unknown, signal?: AbortSignal) {
    const input = hashSchema.parse(value);
    if (this.busy) throw new PanelError('transfer_busy');
    this.busy = true;
    try {
      const actual = await this.destinationHash(input.server, input.file, this.deadline(signal));
      return {
        path: input.file,
        ...actual,
        ...(input.sha256 ? { verified: actual.sha256 === input.sha256 } : {}),
      };
    } finally {
      this.busy = false;
    }
  }

  async upload(value: unknown, signal?: AbortSignal) {
    const input = uploadSchema.parse(value);
    if (!this.provider.config.allowWrites) throw new PanelError('writes_disabled');
    if (this.busy) throw new PanelError('transfer_busy');
    this.busy = true;
    let submitted = false;
    try {
      const deadline = this.deadline(signal);
      const bytes = await readBytes(
        await this.send(artifactUrl(input.file.download_url), { method: 'GET', signal: deadline }),
        this.options.maxBytes ?? 64 * 1024 * 1024,
      );
      const digest = hash(bytes);
      if (input.sha256 && input.sha256 !== digest) throw new PanelError('artifact_hash_mismatch');
      const result = signedUrlSchema.parse(
        await this.provider.request(
          {
            family: 'client',
            method: 'GET',
            path: `/api/client/servers/${input.server}/files/upload`,
          },
          deadline,
        ),
      );
      const url = wingsUrl(
        result.attributes.url,
        this.provider.config.wingsOrigins,
        '/upload/file',
      );
      url.searchParams.set('directory', input.directory);
      const body = new FormData();
      body.set('files', new Blob([new Uint8Array(bytes)]), input.name);
      submitted = true;
      const response = await this.send(url, { method: 'POST', body, signal: deadline });
      await response.body?.cancel();
      const path = `${input.directory.replace(/\/$/, '')}/${input.name}`;
      const actual = await this.destinationHash(input.server, path, deadline);
      if (actual.sha256 !== digest) throw new PanelError('artifact_hash_mismatch');
      return { path, ...actual, verified: true };
    } catch (error) {
      if (submitted) throw new PanelError('completion_unknown');
      if (error instanceof PanelError) throw error;
      throw new PanelError('request_failed');
    } finally {
      this.busy = false;
    }
  }
}
