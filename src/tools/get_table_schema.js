import { getBigQueryClient } from '../bigquery.js';

const TABLE_QUERY_HINTS = {
  'crawl.pages': {
    partitionColumn: 'date',
    clusterColumns: ['client', 'is_root_page', 'rank', 'page'],
    hints: [
      'Partitioned by `date` (REQUIRED filter on every query).',
      'Clustered by `client`, `is_root_page`, `rank`, `page` in exact order. Always include `client` ("desktop" or "mobile") and `is_root_page` (usually true) to trigger cluster pruning.',
      'To test logic safely without high scan costs, use `httparchive.sample_data.pages_10k` or `TABLESAMPLE SYSTEM (0.01 PERCENT)`.',
      'BigQuery dry-run overestimates bytes when filtering by `rank <= N` due to cluster pruning estimation limitations; actual query execution will scan less.'
    ]
  },
  'crawl.requests': {
    partitionColumn: 'date',
    clusterColumns: ['client', 'is_root_page', 'type', 'rank'],
    hints: [
      'Partitioned by `date` (REQUIRED filter on every query).',
      'Clustered by `client`, `is_root_page`, `type`, `rank`. Filter by `type IN ("html", "script")` to prune requests of unused MIME types.',
      'Avoid selecting `response_body` or `payload` unless filtered to a small subset (e.g. rank <= 1000).',
      'Use `is_main_document = true` to isolate the primary HTML response of each page.'
    ]
  },
  'sample_data.pages_10k': {
    hints: [
      'Fixed 10,000-page subset of `crawl.pages` from the most recent crawl month.',
      'Guaranteed low data scan volume (<100 MB). Use for developing and verifying SQL queries before running against full crawl.pages.'
    ]
  },
  'sample_data.requests_10k': {
    hints: [
      'Fixed subset of `crawl.requests` corresponding to pages_10k.',
      'Ideal for testing request-level joins and aggregations at minimal cost.'
    ]
  }
};

export const getTableSchema = async ({ dataset = 'crawl', table = 'pages' }) => {
  const bq = getBigQueryClient();
  const tableRef = bq.dataset(dataset).table(table);

  const [metadata] = await tableRef.getMetadata();

  const fields = metadata.schema?.fields?.map(f => ({
    name: f.name,
    type: f.type,
    mode: f.mode || 'NULLABLE',
    description: f.description || '',
    fields: f.fields ? f.fields.map(sub => ({ name: sub.name, type: sub.type, mode: sub.mode })) : undefined
  })) || [];

  const tableKey = `${dataset}.${table}`;
  const hints = TABLE_QUERY_HINTS[tableKey] || null;

  return {
    tableId: metadata.id,
    dataset,
    table,
    numRows: metadata.numRows,
    numBytes: metadata.numBytes,
    formattedSize: metadata.numBytes ? `${(Number(metadata.numBytes) / (1024 ** 3)).toFixed(2)} GB` : 'N/A',
    timePartitioning: metadata.timePartitioning || null,
    clustering: metadata.clustering?.fields || null,
    hints,
    fields
  };
};
