import { getBigQueryClient } from '../bigquery.js';

export const previewTableRows = async ({
  dataset = 'crawl',
  table = 'pages',
  maxResults = 3,
  selectedFields
}) => {
  const limit = Math.min(Math.max(1, Number(maxResults) || 3), 10);
  const bq = getBigQueryClient();
  const tableRef = bq.dataset(dataset).table(table);

  const options = {
    maxResults: limit,
  };

  if (selectedFields && typeof selectedFields === 'string') {
    options.selectedFields = selectedFields.trim();
  }

  const [rows] = await tableRef.getRows(options);

  return {
    table: `${dataset}.${table}`,
    costNotice: '$0.00 (Tabledata API preview does NOT run a query and scans 0 bytes)',
    previewRowsCount: rows.length,
    rows
  };
};
