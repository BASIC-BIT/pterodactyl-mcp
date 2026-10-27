export interface ProviderRoute {
  family: 'application' | 'client';
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
}

export function extractRoutes(source: string, family: 'application' | 'client'): ProviderRoute[];
export function providerRoutes(): ProviderRoute[];
