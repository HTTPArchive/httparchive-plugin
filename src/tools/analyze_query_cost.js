import { getBigQueryClient } from '../bigquery.js';

/**
 * Pure linting function for HTTP Archive BigQuery queries.
 * Evaluates partition keys, clustering hierarchy, projection discipline, and known cost traps.
 */
export const lintQuery = (query) => {
  const warnings = [];
  const optimizations = [];
  const upper = query.toUpperCase();

  const isPages = upper.includes('CRAWL.PAGES') || upper.includes('`CRAWL.PAGES`') || upper.includes('`HTTPARCHIVE.CRAWL.PAGES`');
  const isRequests = upper.includes('CRAWL.REQUESTS') || upper.includes('`CRAWL.REQUESTS`') || upper.includes('`HTTPARCHIVE.CRAWL.REQUESTS`');
  const isCrawlTable = isPages || isRequests;

  // 1. Partition Check (date)
  if (isCrawlTable) {
    const hasDateFilter = /\bDATE\s*(=|IN|BETWEEN|>|<|>=|<=)/i.test(query);
    if (!hasDateFilter) {
      warnings.push({
        severity: 'CRITICAL',
        rule: 'missing-partition-filter',
        message: 'Missing partition filter on `date`. HTTP Archive crawl tables are partitioned by monthly crawl `date`. Omitting `date` scans all historical crawl partitions (multi-TB scan!).'
      });
    }
  }

  // 2. Clustering Hierarchy Check
  if (isPages) {
    const hasClient = /\bCLIENT\s*(=|IN)/i.test(query);
    const hasIsRootPage = /\bIS_ROOT_PAGE\b/i.test(query);
    const hasRank = /\bRANK\s*(=|IN|BETWEEN|>|<|>=|<=)/i.test(query);

    if (hasRank && (!hasClient || !hasIsRootPage)) {
      warnings.push({
        severity: 'WARNING',
        rule: 'clustering-order-violation',
        message: 'Clustering order for `crawl.pages` is `client` -> `is_root_page` -> `rank` -> `page`. Filtering by `rank` without `client` and `is_root_page` degrades BigQuery block pruning efficiency. Include `client = "desktop"` (or "mobile") and `is_root_page = TRUE`.'
      });
    }

    if (hasRank) {
      optimizations.push({
        rule: 'rank-dryrun-estimator-bug',
        message: 'BigQuery dry-run estimation does NOT account for cluster pruning on `rank`. The estimated bytes processed is an over-estimate; actual billed scan volume will be lower. For guaranteed small test scans, use `httparchive.sample_data.pages_10k` or `TABLESAMPLE SYSTEM (0.01 PERCENT)`.'
      });
    }
  }

  if (isRequests) {
    const hasType = /\bTYPE\s*(=|IN)/i.test(query);
    if (!hasType) {
      optimizations.push({
        rule: 'filter-request-type',
        message: '`crawl.requests` is clustered by `client`, `is_root_page`, `type`, `rank`. Filter by `type IN ("html", "script")` to prune requests of unused MIME types (images, fonts, css).'
      });
    }
  }

  // 3. Projection Checks (SELECT *)
  if (/\bSELECT\s+\*/i.test(query)) {
    warnings.push({
      severity: 'HIGH',
      rule: 'no-select-star',
      message: '`SELECT *` detected. HTTP Archive tables contain massive JSON and string blobs (`payload`, `summary`, `lighthouse`, `response_body`). Never use `SELECT *`; explicitly select only required columns.'
    });
  }

  // 4. Unpruned custom_metrics check
  if (/\bSELECT\s+([^,]+,)*\s*CUSTOM_METRICS\s*(,|$|\bFROM\b)/i.test(query) && !/\bCUSTOM_METRICS\.[a-zA-Z0-9_]+/i.test(query)) {
    warnings.push({
      severity: 'WARNING',
      rule: 'unpruned-custom-metrics',
      message: 'Selecting parent `custom_metrics` RECORD scans all 20+ nested JSON categories. Select specific sub-records (e.g. `custom_metrics.a11y` or `custom_metrics.privacy`) to scan only those columns in columnar storage.'
    });
  }

  // 5. Heavy Blob Projections (payload, response_body)
  if (/\b(RESPONSE_BODY|PAYLOAD)\b/i.test(query)) {
    warnings.push({
      severity: 'MEDIUM',
      rule: 'heavy-blob-projection',
      message: 'Query references `payload` or `response_body`. These fields account for over 80% of total table bytes. Ensure strict filters (e.g. `rank <= 1000`) or test logic against `sample_data.requests_10k`.'
    });
  }

  // 6. The LIMIT Trap
  if (/\bLIMIT\s+\d+/i.test(query) && isCrawlTable) {
    const hasDate = /\bDATE\s*(=|IN|BETWEEN|>|<|>=|<=)/i.test(query);
    if (!hasDate) {
      warnings.push({
        severity: 'HIGH',
        rule: 'limit-does-not-reduce-cost',
        message: '`LIMIT` does NOT reduce the bytes scanned by BigQuery! BigQuery scans the entire partition/table before applying the limit. Use `TABLESAMPLE` or `httparchive.sample_data` to sample data cheaply.'
      });
    }
  }

  return { warnings, optimizations };
};

export const analyzeQueryCost = async ({ query }) => {
  if (!query || typeof query !== 'string') {
    throw new Error('Query parameter must be a non-empty SQL string');
  }

  const bq = getBigQueryClient();
  const location = process.env.BIGQUERY_LOCATION || 'US';

  // 1. Live BigQuery dry run
  const [job] = await bq.createQueryJob({
    query,
    dryRun: true,
    location,
  });

  const totalBytesProcessed = Number(job.metadata.statistics?.totalBytesProcessed || 0);
  const bytesInMb = (totalBytesProcessed / (1024 ** 2)).toFixed(2);
  const bytesInGb = (totalBytesProcessed / (1024 ** 3)).toFixed(3);
  const bytesInTb = (totalBytesProcessed / (1024 ** 4)).toFixed(4);

  // BigQuery on-demand pricing: $6.25 per TB (first 1 TB free per month per billing account)
  const estimatedCostUsd = ((totalBytesProcessed / (10 ** 12)) * 6.25).toFixed(4);

  const referencedTables = job.metadata.statistics?.query?.referencedTables?.map(t =>
    `${t.projectId}.${t.datasetId}.${t.tableId}`
  ) || [];

  // 2. Domain-specific cost linting
  const lintResults = lintQuery(query);

  return {
    dryRunSuccess: true,
    bytesProcessed: {
      rawBytes: totalBytesProcessed,
      megabytes: `${bytesInMb} MB`,
      gigabytes: `${bytesInGb} GB`,
      terabytes: `${bytesInTb} TB`
    },
    estimatedCost: {
      onDemandRateUsd: `$6.25 / TB`,
      estimatedCostUsd: `$${estimatedCostUsd}`,
      freeTierNote: 'BigQuery includes 1 TB of free query processing per month per account.'
    },
    referencedTables,
    linting: lintResults
  };
};
