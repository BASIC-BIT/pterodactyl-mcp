export type ApiFamily = 'application' | 'client';
export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface PanelRequest {
  readonly family: ApiFamily;
  readonly method: ApiMethod;
  readonly path: string;
  readonly query?: Readonly<
    Record<string, string | number | boolean | (string | number | boolean)[]>
  >;
  readonly encoding?: 'text';
  readonly body?: unknown;
}

export type PanelFetch = (url: URL, init: RequestInit) => Promise<Response>;

export interface ClientOptions {
  readonly signal?: AbortSignal;
  readonly fetch?: PanelFetch;
  readonly timeoutMs?: number;
  readonly maxResponseBytes?: number;
}
