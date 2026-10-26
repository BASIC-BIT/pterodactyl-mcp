#!/usr/bin/env node
import { startStdio } from './runtime.js';
startStdio(process.env)
  .then((session) => session.closed)
  .catch(() => {
    process.stderr.write(
      'Unable to start Pterodactyl MCP. Check the configured origin and credentials.\n',
    );
    process.exitCode = 1;
  });
