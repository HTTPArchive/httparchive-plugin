import test from 'node:test';
import assert from 'node:assert/strict';
import { lintQuery } from '../src/tools/analyze_query_cost.js';

test('Cost Linter: catches missing date partition on crawl.pages', () => {
  const query = 'SELECT page FROM `httparchive.crawl.pages` WHERE client = "mobile" AND rank <= 1000';
  const result = lintQuery(query);

  const missingPartition = result.warnings.find(w => w.rule === 'missing-partition-filter');
  assert.ok(missingPartition, 'Should warn about missing date partition');
  assert.equal(missingPartition.severity, 'CRITICAL');
});

test('Cost Linter: warns about clustering order violation when filtering rank without client/is_root_page', () => {
  const query = 'SELECT page FROM `httparchive.crawl.pages` WHERE date = "2024-01-01" AND rank <= 1000';
  const result = lintQuery(query);

  const clusterWarning = result.warnings.find(w => w.rule === 'clustering-order-violation');
  assert.ok(clusterWarning, 'Should warn about clustering order');
});

test('Cost Linter: flags dry-run estimator bug caveat when filtering rank', () => {
  const query = 'SELECT page FROM `httparchive.crawl.pages` WHERE date = "2024-01-01" AND client = "mobile" AND is_root_page AND rank <= 1000';
  const result = lintQuery(query);

  const rankOptimization = result.optimizations.find(o => o.rule === 'rank-dryrun-estimator-bug');
  assert.ok(rankOptimization, 'Should flag rank dry-run estimate overestimation caveat');
  assert.equal(result.warnings.length, 0, 'Should have no warnings for fully pruned query');
});

test('Cost Linter: catches SELECT * anti-pattern', () => {
  const query = 'SELECT * FROM `httparchive.crawl.pages` WHERE date = "2024-01-01" AND client = "mobile" AND is_root_page';
  const result = lintQuery(query);

  const selectStarWarning = result.warnings.find(w => w.rule === 'no-select-star');
  assert.ok(selectStarWarning, 'Should flag SELECT *');
});

test('Cost Linter: catches unpruned custom_metrics projection', () => {
  const query = 'SELECT page, custom_metrics FROM `httparchive.crawl.pages` WHERE date = "2024-01-01" AND client = "mobile" AND is_root_page';
  const result = lintQuery(query);

  const customMetricsWarning = result.warnings.find(w => w.rule === 'unpruned-custom-metrics');
  assert.ok(customMetricsWarning, 'Should warn about selecting entire custom_metrics record');
});

test('Cost Linter: allows dot-notated custom_metrics sub-column', () => {
  const query = 'SELECT page, custom_metrics.a11y FROM `httparchive.crawl.pages` WHERE date = "2024-01-01" AND client = "mobile" AND is_root_page';
  const result = lintQuery(query);

  const customMetricsWarning = result.warnings.find(w => w.rule === 'unpruned-custom-metrics');
  assert.equal(customMetricsWarning, undefined, 'Should not warn when querying specific sub-column');
});

test('Cost Linter: flags LIMIT without partition filter trap', () => {
  const query = 'SELECT page FROM `httparchive.crawl.pages` LIMIT 10';
  const result = lintQuery(query);

  const limitWarning = result.warnings.find(w => w.rule === 'limit-does-not-reduce-cost');
  assert.ok(limitWarning, 'Should flag LIMIT cost trap');
});
