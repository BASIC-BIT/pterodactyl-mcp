import { PanelError } from '../api/errors.js';

function secureUrl(value: string): URL {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash)
      throw new Error('Invalid URL');
    return url;
  } catch {
    throw new PanelError('invalid_destination');
  }
}

export function artifactUrl(value: string): URL {
  const url = secureUrl(value);
  if (!url.hostname.endsWith('.oaiusercontent.com') || url.port)
    throw new PanelError('invalid_destination');
  return url;
}

export function wingsUrl(value: string, origins: readonly string[], path: string): URL {
  const url = secureUrl(value);
  if (!origins.includes(url.origin) || url.pathname !== path)
    throw new PanelError('invalid_destination');
  return url;
}
