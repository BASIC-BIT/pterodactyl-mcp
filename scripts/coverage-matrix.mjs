import process from 'node:process';
import { readFile, writeFile } from 'node:fs/promises';
import { operations } from '../dist/operations/catalog.js';

const counts = Object.fromEntries(
  ['implemented', 'workflow', 'excluded', 'pending'].map((status) => [
    status,
    operations.filter((operation) => operation.status === status).length,
  ]),
);
const lines = [
  '# API coverage',
  '',
  `Pinned provider routes: ${operations.length}. Executable catalogue operations: ${counts.implemented}. Workflow-owned routes: ${counts.workflow}. Exclusions: ${counts.excluded}. Pending: ${counts.pending}.`,
  '',
  'This inventory compares the pinned Application and Client route files. Implemented means verified against controlled provider contracts, not accepted against every deployed panel version. It does not cover admin web-only features such as egg import/export, mounts and transfers.',
  '',
  'Each executable operation has an independent SDK-to-HTTP wire contract. Workflow routes keep signed URLs and WebSocket tokens internal. Exclusions and pending routes cannot execute through the generic tools.',
  '',
  '| Operation | Method and route | Status | Reason or focused tool |',
  '| --- | --- | --- | --- |',
  ...operations.map(
    (operation) =>
      `| ${operation.id} | ${operation.method} ${operation.path} | ${operation.status} | ${operation.status === 'implemented' ? '' : operation.reason + ('tool' in operation ? ` Use ${operation.tool}.` : '')} |`,
  ),
  '',
];
const expected = lines.join('\n');
if (process.argv.includes('--check')) {
  if ((await readFile('docs/coverage.md', 'utf8')) !== expected)
    throw new Error('Coverage matrix is stale. Run npm run generate:coverage.');
} else await writeFile('docs/coverage.md', expected);
