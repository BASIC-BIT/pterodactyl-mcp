import { expect, it } from 'vitest';
import { toolResult } from '../../src/mcp/results.js';

it('bounds oversized tool results and returns an explicit safe error', () => {
  const result = toolResult('fixture', { data: 'x'.repeat(70_000) });
  expect(result.isError).toBe(true);
  expect(result.structuredContent).toMatchObject({ error: { code: 'result_too_large' } });
  expect(JSON.stringify(result).length).toBeLessThan(1024);
});
