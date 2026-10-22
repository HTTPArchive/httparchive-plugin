import { BigQuery } from '@google-cloud/bigquery';

export const getBigQueryClient = () => {
  const projectId = process.env.BIGQUERY_PROJECT || 'httparchive';
  const location = process.env.BIGQUERY_LOCATION || 'US';

  return new BigQuery({
    projectId,
    location,
  });
};
