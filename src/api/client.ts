import type { PanelConfig } from '../config.js';
import type { ApiFamily, ClientOptions, PanelRequest } from './types.js';
import { PanelError } from './errors.js';
import { readResponse } from './response.js';

function requestUrl(origin: string, request: PanelRequest): URL {
  const url = new URL(request.path, origin);
  const prefix = `/api/${request.family}`;
  if (
    !request.path.startsWith('/') ||
    request.path.startsWith('//') ||
    url.origin !== origin ||
    url.search ||
    url.hash ||
    (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`))
  )
    throw new PanelError('invalid_path');
  for (const [key, value] of Object.entries(request.query ?? {})) {
    if (Array.isArray(value))
      value.forEach((item, index) => url.searchParams.set(`${key}[${index}]`, String(item)));
    else url.searchParams.set(key, String(value));
  }
  return url;
}

function apiKey(config: PanelConfig, family: ApiFamily): string {
  const credentials = config.credentials;
  if (family === 'application' && credentials.kind !== 'client') return credentials.applicationKey;
  if (family === 'client' && credentials.kind !== 'application') return credentials.clientKey;
  throw new PanelError('credential_unavailable');
}

async function rejectProviderError(response: Response): Promise<void> {
  if (response.ok) return;
  await response.body?.cancel().catch(() => undefined);
  if (response.status >= 300 && response.status < 400)
    throw new PanelError('redirect_refused', response.status);
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('retry-after'));
    throw new PanelError(
      'rate_limited',
      429,
      Number.isFinite(retryAfter) && retryAfter >= 0 ? retryAfter : undefined,
    );
  }
  throw new PanelError('provider_error', response.status);
}

export class PanelClient {
  constructor(
    readonly config: PanelConfig,
    readonly options: ClientOptions = {},
  ) {}

  async request(request: PanelRequest, signal?: AbortSignal): Promise<unknown> {
    const url = requestUrl(this.config.origin, request);
    const key = apiKey(this.config, request.family);
    const writes = request.method !== 'GET';
    if (writes && !this.config.allowWrites) throw new PanelError('writes_disabled');
    const headers = new Headers({
      Authorization: `Bearer ${key}`,
      Accept: 'Application/vnd.pterodactyl.v1+json',
      'User-Agent': 'pterodactyl-mcp/0.1.0',
    });
    const body =
      request.body === undefined
        ? undefined
        : request.encoding === 'text'
          ? String(request.body)
          : JSON.stringify(request.body);
    if (body !== undefined)
      headers.set('Content-Type', request.encoding === 'text' ? 'text/plain' : 'application/json');
    const init: RequestInit = {
      method: request.method,
      headers,
      redirect: 'manual',
      signal: AbortSignal.any([
        AbortSignal.timeout(this.options.timeoutMs ?? 15_000),
        ...[this.options.signal, signal].filter(
          (value): value is AbortSignal => value !== undefined,
        ),
      ]),
      ...(body === undefined ? {} : { body }),
    };
    try {
      const response = await (this.options.fetch ?? fetch)(url, init);
      await rejectProviderError(response);
      return await readResponse(response, this.options.maxResponseBytes ?? 2 * 1024 * 1024);
    } catch (error) {
      if (error instanceof PanelError) throw error;
      throw new PanelError(writes ? 'completion_unknown' : 'request_failed');
    }
  }
}
