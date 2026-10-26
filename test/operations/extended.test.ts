import { describe, expect, it } from 'vitest';
import { prepareOperation } from '../../src/operations/catalog.js';

import {
  mutationContracts as contracts,
  clientServer,
  limits,
  featureLimits,
} from '../fixtures/contracts.js';

describe('provider input contracts', () => {
  it.each(contracts)(
    '%s prepares the independently specified method, path and body',
    (id, method, path, input) => {
      const request = prepareOperation(id, input);
      expect(request).toMatchObject({
        method,
        path,
        ...('body' in input ? { body: input.body } : {}),
      });
    },
  );

  it('requires a deliberate allocation strategy when provisioning', () => {
    const body = {
      name: 'Fixture',
      user: 7,
      egg: 2,
      docker_image: 'image',
      startup: './start',
      environment: {},
      limits,
      feature_limits: featureLimits,
    };
    expect(() => prepareOperation('application.servers.create', { body })).toThrow();
    expect(() =>
      prepareOperation('application.servers.create', {
        body: { ...body, deploy: { locations: [1], dedicated_ip: false, port_range: [] } },
      }),
    ).not.toThrow();
  });

  it.each([
    ['application.users.update', { path: { user: 7 }, body: { email: 'updated@example.test' } }],
    ['application.nodes.update', { path: { node: 3 }, body: { maintenance_mode: true } }],
    [
      'application.servers.startup',
      { path: { server: 42 }, body: { environment: {}, skip_scripts: false } },
    ],
    [
      'client.schedules.tasks.create',
      {
        path: { ...clientServer, schedule: 2 },
        body: { action: 'power', payload: 'erase', time_offset: 0 },
      },
    ],
    [
      'client.backups.restore',
      { path: { ...clientServer, backup: '00000000-0000-4000-8000-000000000001' }, body: {} },
    ],
    ['client.files.write', { path: clientServer, query: { file: '../outside' }, body: 'bad' }],
  ])('rejects invalid required provider inputs: %s', (id, input) => {
    expect(() => prepareOperation(id, input)).toThrow();
  });
});
