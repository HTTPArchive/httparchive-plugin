---
name: httparchive-table-schema
description: Architectural guide for querying HTTP Archive BigQuery tables (`crawl.pages`, `crawl.requests`, `sample_data`). Use live BigQuery tools and official docs as the sources of truth for nested structures (`technologies`, `features`), record sub-columns (`custom_metrics`), and joins.
---

# HTTP Archive BigQuery Table Schemas

Always use live BigQuery metadata and official HTTP Archive documentation as the sources of truth for schemas, column types, and custom metrics.

- **Official Documentation**: [https://httparchive.org/docs/reference/tables/pages/](https://httparchive.org/docs/reference/tables/pages/)
- **Live MCP Introspection Tools** (provided via remote Streamable HTTP MCP at `https://cdn.httparchive.org/mcp`):
  - `get_table_schema({ dataset, table })`: Introspects live BigQuery table schemas, partition columns, clustering fields, and column descriptions.
  - `list_custom_metrics({ category })`: Introspects the live `custom_metrics` record in BigQuery and samples real JSON properties from `sample_data.pages_10k`.
  - `preview_table_rows({ dataset, table, maxResults, selectedFields })`: Previews live rows at $0.00 cost via the BigQuery Tabledata API.
  - `get_documentation({ topic })`: Fetches official docs (`pages`, `requests`, `custom-metrics`, `technology`, `capo`, etc.) directly from the docs repository.

---

## Datasets & Tables Overview

| Dataset | Table | Granularity | Partitioning | Clustering | Official Docs |
|---|---|---|---|---|---|
| `crawl` | `pages` | 1 row per tested page per month | `date` | `client`, `is_root_page`, `rank`, `page` | [pages doc](https://httparchive.org/docs/reference/tables/pages/) |
| `crawl` | `requests` | 1 row per HTTP request | `date` | `client`, `is_root_page`, `type`, `rank` | [requests doc](https://httparchive.org/docs/reference/tables/requests/) |
| `sample_data` | `pages_10k` | 10k pages subset | `date` | `client`, `is_root_page`, `rank`, `page` | [sample_data guide](https://httparchive.org/docs/guides/minimizing-costs/#use-the-sample_data-dataset) |
| `sample_data` | `requests_10k` | Requests for 10k pages | `date` | `client`, `is_root_page`, `type`, `rank` | Same as above |

---

## Working with Complex & Nested Columns

Always verify current types with `get_table_schema`. The primary nested types in `crawl.pages` are:

### 1. `technologies` (`ARRAY<STRUCT<technology STRING, categories ARRAY<STRING>, info ARRAY<STRING>>>`)
Detected technologies via Wappalyzer. Unnest the array to filter or aggregate:

```sql
SELECT
  t.technology,
  COUNT(1) AS origins_count
FROM `httparchive.crawl.pages`,
  UNNEST(technologies) AS t
WHERE date = '2024-01-01'
  AND client = 'mobile'
  AND is_root_page
  AND rank <= 10000
GROUP BY t.technology
ORDER BY origins_count DESC;
```

### 2. `features` (`ARRAY<STRUCT<feature STRING, id INTEGER>>`)
Blink runtime features detected by Chromium during page crawl (maps to ChromeStatus.com features):

```sql
SELECT
  f.feature,
  COUNT(1) AS total
FROM `httparchive.crawl.pages`,
  UNNEST(features) AS f
WHERE date = '2024-01-01'
  AND client = 'mobile'
  AND is_root_page
  AND rank <= 1000
GROUP BY f.feature;
```

### 3. `custom_metrics` (`RECORD` of JSON fields)
`custom_metrics` is a structured `RECORD` column where each subfield is an independent `JSON` column in BigQuery Capacitor storage.
- **Source of Truth**: Call `list_custom_metrics` to retrieve the current list of categories directly from BigQuery schema.
- **Capacitor Storage Rule**: Querying `custom_metrics.<category>` only scans bytes for that specific column. Querying `custom_metrics` without dot notation scans all 20+ JSON columns.
- **Extraction Syntax**: Use `JSON_VALUE` for scalar values (strings, numbers) and `JSON_QUERY` for arrays/objects.

```sql
SELECT
  page,
  JSON_VALUE(custom_metrics.a11y, '$.axe.violations[0].id') AS axe_violation,
  CAST(JSON_VALUE(custom_metrics.other, '$.avg_dom_depth') AS FLOAT64) AS dom_depth
FROM `httparchive.crawl.pages`
WHERE date = '2024-01-01'
  AND client = 'mobile'
  AND is_root_page
  AND rank <= 1000;
```

---

## Querying `crawl.requests`

Contains one row per individual HTTP request.
- **Key Fields**: `type` (`'script'`, `'html'`, `'css'`, `'image'`, `'font'`, etc.), `is_main_document` (`TRUE` for the primary HTML response), `url`, `page`, `request_headers`, `response_headers`, `response_body` (text-only, binary assets are omitted).
- **MIME Type Pruning**: Because `requests` is clustered by `client, is_root_page, type, rank`, always filter `type IN ('html', 'script')` to avoid scanning unused asset blocks.

---

## Joining Pages and Requests

When joining `crawl.pages` and `crawl.requests`:
1. Always join on `date`, `client`, and `page` (or `wptid`).
2. Repeat partition (`date`) and clustering filters on **BOTH** sides of the join to ensure BigQuery prunes both tables before joining.

```sql
WITH pages AS (
  SELECT page, rank
  FROM `httparchive.crawl.pages`
  WHERE date = '2024-01-01'
    AND client = 'mobile'
    AND is_root_page
    AND rank <= 1000
),
requests AS (
  SELECT page, url
  FROM `httparchive.crawl.requests`
  WHERE date = '2024-01-01'
    AND client = 'mobile'
    AND is_root_page
    AND rank <= 1000
    AND type = 'script'
)
SELECT
  p.page,
  p.rank,
  COUNT(r.url) AS script_requests_count
FROM pages p
JOIN requests r ON p.page = r.page
GROUP BY p.page, p.rank;
```
