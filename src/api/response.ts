import { PanelError } from './errors.js';

export async function readBytes(response: Response, maxBytes: number): Promise<Buffer> {
  if (response.body === null) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) throw new PanelError('response_too_large');
      chunks.push(chunk.value);
    }
    return Buffer.concat(chunks);
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function readResponse(response: Response, maxBytes: number): Promise<unknown> {
  const text = (await readBytes(response, maxBytes)).toString('utf8');
  if (!text) return null;
  if ((response.headers.get('content-type') ?? '').includes('json')) {
    const value: unknown = JSON.parse(text);
    return value;
  }
  return text;
}
