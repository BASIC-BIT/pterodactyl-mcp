import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const base = { PTERODACTYL_URL: 'https://panel.example.test', PTERODACTYL_LABEL: 'test-panel' };

describe('panel configuration', () => {
  it('keeps Application and Client credentials distinct and disables writes by default', () => {
    const config = loadConfig({
      ...base,
      PTERODACTYL_APPLICATION_KEY: 'ptla_synthetic_application',
      PTERODACTYL_CLIENT_KEY: 'ptlc_synthetic_client',
    });
    expect(config.origin).toBe('https://panel.example.test');
    expect(config.label).toBe('test-panel');
    expect(config.credentials).toEqual({
      kind: 'both',
      applicationKey: 'ptla_synthetic_application',
      clientKey: 'ptlc_synthetic_client',
    });
    expect(config.allowWrites).toBe(false);
  });

  it('supports admin-only operation without a Client key', () => {
    expect(
      loadConfig({ ...base, PTERODACTYL_APPLICATION_KEY: 'ptla_fixture' }).credentials,
    ).toEqual({
      kind: 'application',
      applicationKey: 'ptla_fixture',
    });
  });

  it('supports client-only operation without an Application key', () => {
    expect(loadConfig({ ...base, PTERODACTYL_CLIENT_KEY: 'ptlc_fixture' }).credentials).toEqual({
      kind: 'client',
      clientKey: 'ptlc_fixture',
    });
  });

  it('rejects labels containing arbitrary log or protocol text', () => {
    expect(() =>
      loadConfig({
        ...base,
        PTERODACTYL_LABEL: 'bad\nlabel',
        PTERODACTYL_CLIENT_KEY: 'ptlc_fixture',
      }),
    ).toThrow(/label/i);
  });

  it.each([
    { PTERODACTYL_APPLICATION_KEY: 'ptlc_wrong_kind' },
    { PTERODACTYL_CLIENT_KEY: 'ptla_wrong_kind' },
    {},
  ])('rejects unavailable or mismatched key kinds without echoing keys: %j', (keys) => {
    expect(() => loadConfig({ ...base, ...keys })).toThrow(/credential/i);
    try {
      loadConfig({ ...base, ...keys });
    } catch (error) {
      expect(String(error)).not.toContain('wrong_kind');
    }
  });

  it.each([
    'http://panel.example.test',
    'https://user:password@panel.example.test',
    'https://panel.example.test/api',
    'https://panel.example.test?token=hidden',
    'https://panel.example.test#fragment',
    'not a URL',
  ])('rejects an insecure or non-origin panel address: %s', (url) => {
    expect(() =>
      loadConfig({ ...base, PTERODACTYL_URL: url, PTERODACTYL_CLIENT_KEY: 'ptlc_fixture' }),
    ).toThrow(/origin/i);
  });

  it('requires exact operator opt-in for writes', () => {
    expect(
      loadConfig({
        ...base,
        PTERODACTYL_CLIENT_KEY: 'ptlc_fixture',
        PTERODACTYL_ALLOW_WRITES: 'true',
      }).allowWrites,
    ).toBe(true);
    expect(() =>
      loadConfig({
        ...base,
        PTERODACTYL_CLIENT_KEY: 'ptlc_fixture',
        PTERODACTYL_ALLOW_WRITES: 'yes',
      }),
    ).toThrow(/writes/i);
  });

  it('does not accept an origin from a different panel profile implicitly', () => {
    expect(() =>
      loadConfig({ PTERO_BASE_URL: base.PTERODACTYL_URL, PTERODACTYL_CLIENT_KEY: 'ptlc_fixture' }),
    ).toThrow(/origin/i);
  });
});
