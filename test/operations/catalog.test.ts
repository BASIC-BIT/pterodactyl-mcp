import { describe, expect, it } from 'vitest';
import { operations, operationDetails, prepareOperation } from '../../src/operations/catalog.js';
import { providerRoutes } from '../../scripts/provider-routes.mjs';

describe('operation catalogue', () => {
  it('describes provider routes, input schemas and explicit availability without making calls', () => {
    const details = operationDetails('application.servers.list');
    expect(details).toMatchObject({
      id: 'application.servers.list',
      family: 'application',
      method: 'GET',
      path: '/api/application/servers',
      status: 'implemented',
    });
    expect(details.inputSchema).toHaveProperty('type', 'object');
    expect(new Set(operations.map((op) => op.id)).size).toBe(operations.length);
  });

  it('builds a validated admin inventory request preserving pagination and filters', () => {
    expect(
      prepareOperation('application.servers.list', {
        query: {
          page: 2,
          per_page: 50,
          'filter[name]': 'Synthetic VS',
          include: 'node,allocations',
        },
      }),
    ).toEqual({
      family: 'application',
      method: 'GET',
      path: '/api/application/servers',
      query: { page: 2, per_page: 50, 'filter[name]': 'Synthetic VS', include: 'node,allocations' },
    });
  });

  it('substitutes the correct numeric Application ID and rejects Client identifiers', () => {
    expect(prepareOperation('application.servers.get', { path: { server: 42 } })).toMatchObject({
      path: '/api/application/servers/42',
    });
    expect(() =>
      prepareOperation('application.servers.get', { path: { server: '12345678' } }),
    ).toThrow();
  });

  it('validates a Client server identifier and refuses path injection', () => {
    expect(
      prepareOperation('client.servers.resources', { path: { server: '1234abcd' } }),
    ).toMatchObject({ path: '/api/client/servers/1234abcd/resources' });
    expect(() =>
      prepareOperation('client.servers.resources', { path: { server: '../other' } }),
    ).toThrow();
  });

  it('requires the actual power-action body and rejects unsupported parameters', () => {
    expect(
      prepareOperation('client.servers.power', {
        path: { server: '1234abcd' },
        body: { signal: 'restart' },
      }),
    ).toMatchObject({ method: 'POST', body: { signal: 'restart' } });
    expect(() =>
      prepareOperation('client.servers.power', {
        path: { server: '1234abcd' },
        body: { signal: 'erase' },
      }),
    ).toThrow();
    expect(() =>
      prepareOperation('client.servers.power', {
        path: { server: '1234abcd' },
        body: { signal: 'restart', surprise: true },
      }),
    ).toThrow();
  });

  it('makes excluded credential operations discoverable with a reason, but never executable', () => {
    expect(operationDetails('client.account.api_keys.list')).toMatchObject({
      status: 'excluded',
      reason: expect.any(String),
    });
    expect(() => prepareOperation('client.account.api_keys.list', {})).toThrow(/excluded/i);
  });

  it('refuses unknown operations and attempts to override the configured target', () => {
    expect(() => operationDetails('invented.endpoint')).toThrow(/unknown/i);
    expect(() =>
      prepareOperation('application.servers.list', { origin: 'https://other.example.test' }),
    ).toThrow();
  });

  it('accounts for every independently parsed provider route with explicit status', () => {
    const signature = (route: { method: string; path: string }) => `${route.method} ${route.path}`;
    expect(operations.map(signature).sort()).toEqual(providerRoutes().map(signature).sort());
    const route = operations.find(
      (operation) => operation.path === '/api/client/servers/{server}/backups/{backup}/download',
    );
    expect(route).toMatchObject({ status: 'pending', reason: expect.any(String) });
    expect(() => prepareOperation(route?.id ?? '', {})).toThrow(/pending/i);
  });
});
