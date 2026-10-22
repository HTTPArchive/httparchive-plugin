import { getBigQueryClient } from '../bigquery.js';
import { fetchDoc } from '../docs.js';

export const getTableSchema = async ({ dataset = 'crawl', table = 'pages' }) => {
  const bq = getBigQueryClient();
  const tableRef = bq.dataset(dataset).table(table);

  // 1. Live schema and metadata directly from BigQuery
  const [metadata] = await tableRef.getMetadata();

  const fields = metadata.schema?.fields?.map(f => ({
    name: f.name,
    type: f.type,
    mode: f.mode || 'NULLABLE',
    description: f.description || '',
    fields: f.fields ? f.fields.map(sub => ({
      name: sub.name,
      type: sub.type,
      mode: sub.mode,
      description: sub.description || ''
    })) : undefined
  })) || [];

  // 2. Fetch official documentation from HTTP Archive docs
  const docInfo = await fetchDoc(table);

  return {
    source: 'bigquery-live-api',
    tableId: metadata.id,
    dataset,
    table,
    numRows: metadata.numRows,
    numBytes: metadata.numBytes,
    formattedSize: metadata.numBytes ? `${(Number(metadata.numBytes) / (1024 ** 3)).toFixed(2)} GB` : 'N/A',
    timePartitioning: metadata.timePartitioning || null,
    clustering: metadata.clustering?.fields || null,
    documentation: {
      url: docInfo.url || `https://httparchive.org/docs/reference/tables/${table}`,
      title: docInfo.title || `${table} table docs`,
      hasFullDoc: Boolean(docInfo.content)
    },
    fields
  };
};
