import { getBigQueryClient } from '../bigquery.js';
import { fetchDoc } from '../docs.js';

export const listCustomMetrics = async ({ category, search }) => {
  const bq = getBigQueryClient();
  const pagesTable = bq.dataset('crawl').table('pages');

  // 1. Fetch live custom_metrics schema directly from BigQuery
  const [metadata] = await pagesTable.getMetadata();
  const customMetricsField = metadata.schema?.fields?.find(f => f.name === 'custom_metrics');

  if (!customMetricsField || !customMetricsField.fields) {
    throw new Error('custom_metrics field not found in crawl.pages schema');
  }

  const bqCategories = customMetricsField.fields.map(f => ({
    name: f.name,
    type: f.type,
    description: f.description || ''
  }));

  // 2. Specific category inspection
  if (category) {
    const normalized = category.toLowerCase().trim();
    const found = bqCategories.find(c => c.name.toLowerCase() === normalized);

    if (!found) {
      return {
        error: `Category '${category}' not found in crawl.pages schema. Available categories in BigQuery: ${bqCategories.map(c => c.name).join(', ')}`
      };
    }

    // Inspect live JSON structure by sampling 1 row from sample_data.pages_10k via zero-cost Tabledata API
    let livePropertyKeys = [];
    let sampleSnippet = null;
    try {
      const sampleTable = bq.dataset('sample_data').table('pages_10k');
      const [rows] = await sampleTable.getRows({
        maxResults: 1,
        selectedFields: `custom_metrics.${found.name}`
      });

      if (rows.length > 0 && rows[0].custom_metrics?.[found.name]) {
        const rawJson = rows[0].custom_metrics[found.name];
        const parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
        if (parsed && typeof parsed === 'object') {
          livePropertyKeys = Object.keys(parsed);
          sampleSnippet = JSON.stringify(parsed, null, 2).slice(0, 500) + '...';
        }
      }
    } catch {
      // Graceful fallback if sample_data is unreachable
    }

    return {
      source: 'bigquery-crawl-pages-schema',
      category: found.name,
      type: found.type,
      description: found.description,
      liveSampleProperties: livePropertyKeys,
      sampleDataSnippet: sampleSnippet,
      queryPattern: `SELECT page, JSON_VALUE(custom_metrics.${found.name}, '$.property') FROM \`httparchive.crawl.pages\` WHERE date = 'YYYY-MM-01' AND client = 'mobile' AND is_root_page`,
      costNotice: `Querying custom_metrics.${found.name} scans only that column in Capacitor storage. Never select the parent custom_metrics record.`
    };
  }

  // 3. Search across BigQuery field descriptions
  if (search) {
    const query = search.toLowerCase().trim();
    const matches = bqCategories.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.description.toLowerCase().includes(query)
    );

    return {
      source: 'bigquery-crawl-pages-schema',
      searchQuery: search,
      matchCount: matches.length,
      categories: matches
    };
  }

  // 4. Return all categories directly from BigQuery
  const docRef = await fetchDoc('custom-metrics');

  return {
    source: 'bigquery-crawl-pages-schema',
    description: customMetricsField.description || 'Custom metrics from WebPageTest',
    totalCategories: bqCategories.length,
    documentationUrl: docRef.url || 'https://httparchive.org/docs/reference/structs/custom-metrics/',
    categories: bqCategories
  };
};
