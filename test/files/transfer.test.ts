import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';
import { PanelClient } from '../../src/api/client.js';
import { FileTransfer } from '../../src/files/transfer.js';

const bytes = new Uint8Array([0x50, 0x4b, 0, 0xff, 0x80, 0x0a]);
const digest = createHash('sha256').update(bytes).digest('hex');
const input = {
  server: '1234abcd',
  directory: '/Mods',
  name: 'fixture.zip',
  file: { download_url: 'https://files.oaiusercontent.com/fixture' },
  sha256: digest,
};

function fixture({
  writes = true,
  source = bytes,
  destination = bytes,
  maxBytes = 64,
  uploadUrl = 'https://wings.example.test/upload/file?token=synthetic',
} = {}) {
  const calls: { url: URL; init: RequestInit }[] = [];
  const config = loadConfig({
    PTERODACTYL_URL: 'https://panel.example.test',
    PTERODACTYL_CLIENT_KEY: 'ptlc_fixture',
    PTERODACTYL_ALLOW_WRITES: String(writes),
    PTERODACTYL_WINGS_ORIGINS: '["https://wings.example.test"]',
  });
  const fetch = async (url: URL, init: RequestInit) => {
    calls.push({ url, init });
    if (url.hostname === 'files.oaiusercontent.com') return new Response(source);
    if (url.hostname === 'panel.example.test')
      return Response.json({
        attributes: {
          url: url.pathname.endsWith('/upload')
            ? uploadUrl
            : 'https://wings.example.test/download/file?token=verify',
        },
      });
    if (url.pathname === '/upload/file') return new Response(null, { status: 204 });
    return new Response(destination);
  };
  const transfer = new FileTransfer(new PanelClient(config, { fetch }), { fetch, maxBytes });
  return { transfer, calls };
}

describe('binary file transfer', () => {
  it('shares its transfer budget between upload and hashing', async () => {
    const { transfer } = fixture();
    const upload = transfer.upload(input);
    try {
      await expect(
        transfer.fileHash({ server: input.server, file: '/Mods/fixture.zip' }),
      ).rejects.toMatchObject({ code: 'transfer_busy' });
    } finally {
      await upload;
    }
  });
  it('preserves binary bytes and destination, sends no panel key to other hosts, and verifies destination hash', async () => {
    const { transfer, calls } = fixture();
    await expect(transfer.upload(input)).resolves.toMatchObject({
      path: '/Mods/fixture.zip',
      bytes: 6,
      sha256: digest,
      verified: true,
    });
    const upload = calls.find((call) => call.init.method === 'POST')!;
    expect(upload.url.searchParams.get('directory')).toBe('/Mods');
    const form = upload.init.body as FormData;
    const file = form.get('files') as File;
    expect(file.name).toBe('fixture.zip');
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes);
    for (const call of calls.filter((call) => call.url.hostname !== 'panel.example.test')) {
      expect(new Headers(call.init.headers).has('authorization')).toBe(false);
      expect(call.init.redirect).toBe('manual');
    }
    expect(
      calls.find((call) => call.url.pathname.endsWith('/download'))?.url.searchParams.get('file'),
    ).toBe('/Mods/fixture.zip');
  });

  it('enforces writes before fetching even an artifact or a signed URL', async () => {
    const { transfer, calls } = fixture({ writes: false });
    await expect(transfer.upload(input)).rejects.toMatchObject({ code: 'writes_disabled' });
    expect(calls).toEqual([]);
  });

  it('rejects a source hash mismatch before uploading', async () => {
    const { transfer, calls } = fixture({ source: new Uint8Array([1]) });
    await expect(transfer.upload(input)).rejects.toMatchObject({ code: 'artifact_hash_mismatch' });
    expect(calls).toHaveLength(1);
  });

  it('reports uncertain completion after destination verification fails', async () => {
    const { transfer } = fixture({ destination: new Uint8Array([1]) });
    await expect(transfer.upload(input)).rejects.toMatchObject({ code: 'completion_unknown' });
  });

  it.each([
    'http://files.oaiusercontent.com/fixture',
    'https://files.oaiusercontent.com.evil.test/x',
    'https://127.0.0.1/private',
    'https://user:pass@files.oaiusercontent.com/x',
  ])('rejects an untrusted artifact source: %s', async (download_url) => {
    const { transfer, calls } = fixture();
    await expect(transfer.upload({ ...input, file: { download_url } })).rejects.toMatchObject({
      code: 'invalid_destination',
    });
    expect(calls).toEqual([]);
  });

  it.each([
    'https://other.example.test/upload/file?token=secret',
    'https://wings.example.test/admin',
    'http://wings.example.test/upload/file',
    'https://user:pass@wings.example.test/upload/file',
  ])('rejects an unexpected Wings destination: %s', async (uploadUrl) => {
    const { transfer, calls } = fixture({ uploadUrl });
    await expect(transfer.upload(input)).rejects.toMatchObject({ code: 'invalid_destination' });
    expect(calls.some((call) => call.init.method === 'POST')).toBe(false);
  });

  it('bounds downloaded bytes before upload', async () => {
    const { transfer, calls } = fixture({ maxBytes: 3 });
    await expect(transfer.upload(input)).rejects.toMatchObject({ code: 'response_too_large' });
    expect(calls).toHaveLength(1);
  });
});
