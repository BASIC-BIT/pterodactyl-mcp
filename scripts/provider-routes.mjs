import Parser from 'php-parser';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const methods = new Set(['get', 'post', 'put', 'patch', 'delete']);

function chain(expression) {
  if (expression?.kind !== 'call') return [];
  const lookup = expression.what;
  if (!['staticlookup', 'propertylookup'].includes(lookup.kind))
    throw new Error('Unsupported route expression');
  const previous = lookup.what.kind === 'call' ? chain(lookup.what) : [];
  if (!previous.length && lookup.what.name !== 'Route') throw new Error('Unexpected route owner');
  return [...previous, { name: lookup.offset.name, arguments: expression.arguments }];
}

function literal(node) {
  if (node?.kind !== 'string') throw new Error('Dynamic provider route requires review');
  return node.value;
}

function groupPrefix(calls) {
  const prefix = calls.find((call) => call.name === 'prefix');
  if (prefix) return literal(prefix.arguments[0]);
  const group = calls.find((call) => call.name === 'group');
  const config = group?.arguments[0];
  if (config?.kind !== 'array') return '';
  const entry = config.items.find((item) => item.key?.value === 'prefix');
  return entry ? literal(entry.value) : '';
}

function routePath(...segments) {
  return segments
    .join('/')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '')
    .replace(/\{([^}:]+):[^}]+\}/g, '{$1}');
}

function visit(statements, prefix, family, routes) {
  for (const statement of statements) {
    if (statement.kind !== 'expressionstatement') continue;
    const calls = chain(statement.expression);
    const group = calls.find((call) => call.name === 'group');
    if (group) {
      const closure = group.arguments.find((argument) => argument.kind === 'closure');
      if (!closure) throw new Error('Missing route group closure');
      visit(closure.body.children, routePath(prefix, groupPrefix(calls)), family, routes);
      continue;
    }
    const route = calls.find((call) => methods.has(call.name));
    if (!route) throw new Error('Unaccounted provider route expression');
    routes.push({
      family,
      method: route.name.toUpperCase(),
      path: routePath(prefix, literal(route.arguments[0])),
    });
  }
}

export function extractRoutes(source, family) {
  const parser = new Parser({ parser: { version: '8.3' } });
  const ast = parser.parseCode(source);
  const routes = [];
  visit(ast.children, `/api/${family}`, family, routes);
  if (!routes.length) throw new Error('Provider route inventory is empty');
  return routes;
}

export function providerRoutes() {
  return ['application', 'client'].flatMap((family) => {
    const path = fileURLToPath(new URL(`../spec/upstream/api-${family}.php`, import.meta.url));
    return extractRoutes(readFileSync(path, 'utf8'), family);
  });
}
import { URL } from 'node:url';
