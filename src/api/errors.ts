export type ApiErrorCode =
  | 'invalid_path'
  | 'credential_unavailable'
  | 'writes_disabled'
  | 'redirect_refused'
  | 'response_too_large'
  | 'result_too_large'
  | 'invalid_destination'
  | 'artifact_hash_mismatch'
  | 'transfer_busy'
  | 'console_auth_failed'
  | 'provider_error'
  | 'rate_limited'
  | 'request_failed'
  | 'completion_unknown';

export class PanelError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly status?: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(
      code === 'completion_unknown'
        ? 'Provider write completion is unknown. Inspect provider state before another attempt.'
        : `Panel request failed: ${code}${status === undefined ? '' : ` (HTTP ${status})`}.`,
    );
    this.name = 'PanelError';
  }
}
