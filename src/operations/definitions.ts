import { applicationOperations } from './application.js';
import { clientOperations } from './client.js';
import type { Operation } from './types.js';

export const definedOperations: readonly Operation[] = [
  ...applicationOperations,
  ...clientOperations,
  ...(
    [
      ['websocket', 'ptero_console_tail', 'servers/{server}/websocket'],
      ['files.download', 'ptero_file_hash', 'servers/{server}/files/download'],
      ['files.upload', 'ptero_file_upload', 'servers/{server}/files/upload'],
    ] as const
  ).map(
    ([name, tool, suffix]): Operation => ({
      id: `client.${name}`,
      family: 'client',
      method: 'GET',
      path: `/api/client/${suffix}`,
      status: 'workflow',
      tool,
      reason:
        'Signed credentials stay inside the focused tool instead of being returned to the model.',
    }),
  ),
  {
    id: 'client.files.pull',
    family: 'client',
    method: 'POST',
    path: '/api/client/servers/{server}/files/pull',
    status: 'excluded',
    reason:
      'Arbitrary URL fetching by Wings bypasses artifact and destination policy. Use the verified upload tool.',
  },
  ...(
    [
      ['GET', '/account/two-factor'],
      ['POST', '/account/two-factor'],
      ['POST', '/account/two-factor/disable'],
      ['PUT', '/account/email'],
      ['PUT', '/account/password'],
      ['POST', '/account/api-keys'],
      ['DELETE', '/account/api-keys/{identifier}'],
      ['GET', '/account/ssh-keys'],
      ['POST', '/account/ssh-keys'],
      ['POST', '/account/ssh-keys/remove'],
    ] as const
  ).map(
    ([method, suffix]): Operation => ({
      id: `client.account.${method.toLowerCase()}.${suffix.slice('/account/'.length).replaceAll('/', '.')}`,
      family: 'client',
      method,
      path: `/api/client${suffix}`,
      status: 'excluded',
      reason:
        'Account authentication and credential management are outside the server operating capability.',
    }),
  ),
  {
    id: 'application.nodes.configuration',
    family: 'application',
    method: 'GET',
    path: '/api/application/nodes/{node}/configuration',
    status: 'excluded',
    reason:
      'Wings configuration includes daemon credentials. Install it through the private deployment secret channel.',
  },
  {
    id: 'client.account.api_keys.list',
    family: 'client',
    method: 'GET',
    path: '/api/client/account/api-keys',
    status: 'excluded',
    reason: 'Account credential management is outside the game-server operating capability.',
  },
];
