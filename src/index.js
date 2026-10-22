import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getTableSchema } from './tools/get_table_schema.js';
import { listCustomMetrics } from './tools/list_custom_metrics.js';
import { previewTableRows } from './tools/preview_table_rows.js';
import { analyzeQueryCost } from './tools/analyze_query_cost.js';
import { checkPrecomputedReports } from './tools/check_precomputed_reports.js';

export const createMcpServer = () => {
  const server = new McpServer({
    name: 'httparchive',
    version: '1.0.0',
  });

  server.tool(
    'get_table_schema',
    'Get detailed schema, partitioning, clustering metadata, and query hints for HTTP Archive BigQuery tables (e.g. crawl.pages, crawl.requests, sample_data.pages_10k).',
    {
      dataset: z.string().default('crawl').describe('Dataset name: "crawl", "sample_data", or "reports"'),
      table: z.string().default('pages').describe('Table name: "pages", "requests", "pages_10k", "requests_10k", etc.')
    },
    async ({ dataset, table }) => {
      try {
        const result = await getTableSchema({ dataset, table });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }], isError: true };
      }
    }
  );

  server.tool(
    'list_custom_metrics',
    'List or search HTTP Archive custom_metrics categories (a11y, seo, markup, etc.), their internal JSON fields, and BigQuery query examples.',
    {
      category: z.string().optional().describe('Specific custom metrics category to inspect (e.g. "a11y", "seo", "markup", "performance")'),
      search: z.string().optional().describe('Search keyword across all custom metrics descriptions and example fields')
    },
    async ({ category, search }) => {
      try {
        const result = await listCustomMetrics({ category, search });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }], isError: true };
      }
    }
  );

  server.tool(
    'preview_table_rows',
    'Preview actual live table rows at ZERO query cost using BigQuery Tabledata API (does not scan bytes or incur query fees).',
    {
      dataset: z.string().default('crawl').describe('Dataset name, e.g. "crawl" or "sample_data"'),
      table: z.string().default('pages').describe('Table name, e.g. "pages" or "requests"'),
      maxResults: z.number().min(1).max(10).default(3).describe('Number of preview rows (1-10)'),
      selectedFields: z.string().optional().describe('Optional comma-separated list of column names to project')
    },
    async ({ dataset, table, maxResults, selectedFields }) => {
      try {
        const result = await previewTableRows({ dataset, table, maxResults, selectedFields });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }], isError: true };
      }
    }
  );

  server.tool(
    'analyze_query_cost',
    'Run a live BigQuery dry-run to estimate query bytes processed, USD cost, and evaluate HTTP Archive domain cost optimization rules (partitioning, clustering order, SELECT * traps, LIMIT traps).',
    {
      query: z.string().describe('The SQL query to analyze and estimate')
    },
    async ({ query }) => {
      try {
        const result = await analyzeQueryCost({ query });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }], isError: true };
      }
    }
  );

  server.tool(
    'check_precomputed_reports',
    'Check if a desired metric or web vitals breakdown is already available in pre-aggregated tables (httparchive.reports.*) or Tech Report APIs, avoiding expensive raw crawl queries.',
    {
      topic: z.string().optional().describe('Metric or topic to check (e.g. "cwv", "lcp", "inp", "page-weight", "requests", "adoption", "lighthouse")')
    },
    async ({ topic }) => {
      try {
        const result = await checkPrecomputedReports({ topic });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }], isError: true };
      }
    }
  );

  return server;
};
