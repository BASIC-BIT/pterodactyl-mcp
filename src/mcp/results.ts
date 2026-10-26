import { PanelError } from '../api/errors.js';

const omittedFields = new Set(['environment', 'server_value', 'daemon_token', 'daemon_token_id']);

function safeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safeValue);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) => !omittedFields.has(key) && !/(?:^|_)(?:password|token|secret)(?:$|_)/i.test(key),
      )
      .map(([key, nested]) => [key, safeValue(nested)]),
  );
}

export function toolResult(panel: string, result: unknown) {
  const structuredContent = { panel, result: safeValue(result) };
  const text = JSON.stringify(structuredContent);
  if (Buffer.byteLength(text) > 64 * 1024)
    return toolFailure(panel, new PanelError('result_too_large'));
  return { content: [{ type: 'text' as const, text }], structuredContent, isError: false };
}

export function toolFailure(panel: string, error: unknown) {
  const failure =
    error instanceof PanelError
      ? {
          code: error.code,
          message: error.message,
          status: error.status,
          retryAfterSeconds: error.retryAfterSeconds,
        }
      : {
          code: 'invalid_operation',
          message: 'Operation unavailable or input invalid. Inspect operation details.',
        };
  const structuredContent = { panel, error: failure };
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(structuredContent) }],
    structuredContent,
    isError: true,
  };
}
