import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { providerRoutes } from './provider-routes.mjs';

const target = fileURLToPath(new URL('../src/generated/provider-routes.json', import.meta.url));
const content = JSON.stringify(providerRoutes(), null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== content)
    throw new Error(
      'Provider route evidence changed. Review and regenerate the catalogue inventory.',
    );
} else {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}
import process from 'node:process';
import { URL } from 'node:url';
