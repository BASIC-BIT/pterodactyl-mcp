import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const execute = promisify(execFile);
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run through npm run smoke:package.');
const cache = resolve('.cache');
await mkdir(cache, { recursive: true });
const directory = await mkdtemp(join(cache, 'package-'));
async function cleanup() {
  if (dirname(directory) !== cache || !basename(directory).startsWith('package-'))
    throw new Error('Unsafe temporary directory.');
  await rm(directory, { recursive: true, force: true });
}
try {
  const packed = await execute(
    process.execPath,
    [npm, 'pack', '--json', '--pack-destination', directory],
    { timeout: 30_000 },
  );
  const pack = JSON.parse(packed.stdout)[0];
  const files = pack.files.map((file) => file.path);
  if (
    !files.includes('dist/index.js') ||
    !files.includes('docs/coverage.md') ||
    files.some(
      (path) => !/^(?:dist\/|docs\/coverage\.md$|README\.md$|LICENSE$|package\.json$)/.test(path),
    )
  )
    throw new Error('Unexpected package contents.');
  const prefix = join(directory, 'installed');
  await execute(
    process.execPath,
    [
      npm,
      'install',
      '--prefix',
      prefix,
      '--ignore-scripts',
      '--omit=dev',
      '--no-audit',
      '--no-fund',
      '--cache',
      join(cache, 'npm'),
      join(directory, pack.filename),
    ],
    { timeout: 120_000, maxBuffer: 2 * 1024 * 1024 },
  );
  const installed = join(prefix, 'node_modules', '@basicbit', 'pterodactyl-mcp');
  const manifest = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(installed, manifest.bin['pterodactyl-mcp'])],
    cwd: prefix,
    stderr: 'pipe',
    env: {
      PATH: process.env.PATH ?? '',
      ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
      PTERODACTYL_URL: 'https://panel.example.test',
      PTERODACTYL_CLIENT_KEY: 'ptlc_package_fixture',
    },
  });
  const client = new Client({ name: 'installed-package-smoke', version: '0' });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    if (tools.tools.length !== 8) throw new Error('Installed package catalogue mismatch.');
    const details = await client.callTool({
      name: 'ptero_operation_details',
      arguments: { operationId: 'application.servers.create' },
    });
    if (details.isError) throw new Error('Installed package operation discovery failed.');
  } finally {
    await client.close();
  }
  process.stdout.write(
    'Installed production package passed STDIO discovery and operation details.\n',
  );
} finally {
  await cleanup();
}
