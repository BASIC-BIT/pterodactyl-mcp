export type PanelCredentials =
  | { kind: 'application'; applicationKey: string }
  | { kind: 'client'; clientKey: string }
  | { kind: 'both'; applicationKey: string; clientKey: string };

export interface PanelConfig {
  readonly label: string;
  readonly origin: string;
  readonly credentials: PanelCredentials;
  readonly allowWrites: boolean;
  readonly wingsOrigins: readonly string[];
}

function panelOrigin(value: string | undefined): string {
  try {
    const url = new URL(value ?? '');
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error('Invalid origin');
    return url.origin;
  } catch {
    throw new Error(
      'Panel origin must be an HTTPS origin without credentials, path, query or fragment.',
    );
  }
}

function credentials(env: Readonly<Record<string, string | undefined>>): PanelCredentials {
  const applicationKey = env.PTERODACTYL_APPLICATION_KEY;
  const clientKey = env.PTERODACTYL_CLIENT_KEY;
  if (
    (applicationKey !== undefined && !/^ptla_[A-Za-z0-9_-]+$/.test(applicationKey)) ||
    (clientKey !== undefined && !/^ptlc_[A-Za-z0-9_-]+$/.test(clientKey))
  )
    throw new Error('Panel credentials have an invalid API key kind or format.');
  if (applicationKey && clientKey) return { kind: 'both', applicationKey, clientKey };
  if (applicationKey) return { kind: 'application', applicationKey };
  if (clientKey) return { kind: 'client', clientKey };
  throw new Error('At least one panel API credential is required.');
}

export function loadConfig(env: Readonly<Record<string, string | undefined>>): PanelConfig {
  const origin = panelOrigin(env.PTERODACTYL_URL);
  const writes = env.PTERODACTYL_ALLOW_WRITES ?? 'false';
  if (writes !== 'true' && writes !== 'false')
    throw new Error('Writes require an exact true or false setting.');
  const label = env.PTERODACTYL_LABEL ?? 'panel';
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(label))
    throw new Error('Panel label must be 1-64 letters, digits, underscores, dots or hyphens.');
  let wingsOrigins: string[];
  try {
    const value: unknown = JSON.parse(env.PTERODACTYL_WINGS_ORIGINS ?? '[]');
    if (
      !Array.isArray(value) ||
      value.length > 32 ||
      !value.every((item) => typeof item === 'string')
    )
      throw new Error('Invalid origins');
    wingsOrigins = value.map(panelOrigin);
  } catch {
    throw new Error('Wings origins must be a JSON array of HTTPS origins.');
  }
  return {
    label,
    origin,
    credentials: credentials(env),
    allowWrites: writes === 'true',
    wingsOrigins,
  };
}
