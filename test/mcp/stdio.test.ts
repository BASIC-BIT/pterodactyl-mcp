import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { expect, it } from 'vitest';

it('starts the built CLI over STDIO with protocol-only stdout and discovers the catalogue', async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['dist/index.js'],
    cwd: process.cwd(),
    stderr: 'pipe',
    env: {
      PATH: process.env.PATH ?? '',
      ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
      PTERODACTYL_URL: 'https://panel.example.test',
      PTERODACTYL_APPLICATION_KEY: 'ptla_synthetic_stdio',
      PTERODACTYL_LABEL: 'stdio-fixture',
    },
  });
  let stderr = '';
  transport.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  const client = new Client({ name: 'stdio-package-smoke', version: '0.0.0' });
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name)).toContain('ptero_read');
    const result = await client.callTool({
      name: 'ptero_operation_details',
      arguments: { operationId: 'application.servers.list' },
    });
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({
      panel: 'stdio-fixture',
      result: { method: 'GET' },
    });
    expect(stderr).not.toContain('ptla_synthetic_stdio');
  } finally {
    await client.close();
  }
});
