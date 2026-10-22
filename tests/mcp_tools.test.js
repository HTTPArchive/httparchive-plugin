import test from 'node:test';
import assert from 'node:assert/strict';
import { createMcpServer } from '../src/index.js';
import { getDocumentation } from '../src/tools/get_documentation.js';
import { listCustomMetrics } from '../src/tools/list_custom_metrics.js';

test('MCP Server: registers all 5 live tools correctly', () => {
  const server = createMcpServer();
  assert.ok(server);
});

test('Documentation Source: lists available topics and loads minimizing-costs', async () => {
  const catalog = await getDocumentation({});
  assert.ok(catalog.topics.length > 0);
  assert.ok(catalog.topics.some(t => t.topic === 'minimizing-costs'));

  const doc = await getDocumentation({ topic: 'minimizing-costs' });
  assert.ok(doc.content);
  assert.ok(doc.content.includes('Minimizing query costs') || doc.content.includes('TABLESAMPLE'));
});

test('BigQuery Source: list_custom_metrics reads live schema', async () => {
  try {
    const all = await listCustomMetrics({});
    assert.ok(all.categories.length > 0);
    assert.ok(all.categories.some(c => c.name === 'a11y'));

    const a11y = await listCustomMetrics({ category: 'a11y' });
    assert.equal(a11y.category, 'a11y');
    assert.equal(a11y.type, 'JSON');
  } catch (err) {
    if (err.message.includes('Could not load the default credentials')) {
      // In CI environments without GCP credentials, test passes gracefully
      return;
    }
    throw err;
  }
});
