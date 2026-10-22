import test from 'node:test';
import assert from 'node:assert/strict';
import { createMcpServer } from '../src/index.js';
import { listCustomMetrics } from '../src/tools/list_custom_metrics.js';
import { checkPrecomputedReports } from '../src/tools/check_precomputed_reports.js';

test('MCP Server: registers all 5 tools correctly', () => {
  const server = createMcpServer();
  assert.ok(server);
  assert.equal(server.server._instructions, undefined);
});

test('Custom Metrics: retrieves specific category and searches', async () => {
  const a11y = await listCustomMetrics({ category: 'a11y' });
  assert.equal(a11y.category, 'a11y');
  assert.ok(a11y.exampleFields.length > 0);

  const searchResults = await listCustomMetrics({ search: 'dom' });
  assert.ok(searchResults.matchCount > 0);
});

test('Precomputed Reports: matches CWV and adoption queries', async () => {
  const cwv = await checkPrecomputedReports({ topic: 'cwv' });
  assert.equal(cwv.found, true);
  assert.ok(cwv.precomputedTables.length > 0);

  const unknown = await checkPrecomputedReports({ topic: 'non-existent-topic-xyz' });
  assert.equal(unknown.found, false);
});
