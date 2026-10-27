import { describe, expect, it } from 'vitest';
import { extractRoutes, providerRoutes } from '../../scripts/provider-routes.mjs';

describe('independent provider route evidence', () => {
  it('handles nested prefixes, Laravel bindings, middleware chains and optional suffixes', () => {
    const source = `<?php
      Route::group(['prefix' => '/nodes'], function () {
        Route::get('/{node:id}', 'Controller');
        Route::prefix('/{node:id}/allocations')->group(function () {
          Route::middleware(['limit'])->post('/', 'Controller');
          Route::delete('/{allocation}/{force?}', 'Controller');
        });
      });`;
    expect(extractRoutes(source, 'application')).toEqual([
      { family: 'application', method: 'GET', path: '/api/application/nodes/{node}' },
      { family: 'application', method: 'POST', path: '/api/application/nodes/{node}/allocations' },
      {
        family: 'application',
        method: 'DELETE',
        path: '/api/application/nodes/{node}/allocations/{allocation}/{force?}',
      },
    ]);
  });

  it('fails closed for unsupported dynamic routes instead of silently omitting them', () => {
    expect(() => extractRoutes('<?php Route::get($dynamic, "Controller");', 'client')).toThrow(
      /dynamic/i,
    );
  });

  it('includes routes missed by the community wrapper, including chained middleware routes', () => {
    expect(providerRoutes()).toEqual(
      expect.arrayContaining([
        { family: 'application', method: 'GET', path: '/api/application/nodes/deployable' },
        { family: 'client', method: 'GET', path: '/api/client/servers/{server}/websocket' },
        { family: 'client', method: 'POST', path: '/api/client/servers/{server}/files/chmod' },
        {
          family: 'client',
          method: 'POST',
          path: '/api/client/servers/{server}/schedules/{schedule}/tasks/{task}',
        },
      ]),
    );
  });
});
