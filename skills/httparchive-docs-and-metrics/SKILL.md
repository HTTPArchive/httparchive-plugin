---
name: httparchive-docs-and-metrics
description: Retrieve official HTTP Archive documentation and introspect `custom_metrics` JSON sub-columns in BigQuery. Use when the user asks what an HTTP Archive table, field, custom metric, struct or UDF means, needs the crawl release schedule, or wants to know which JSON keys exist in `crawl.pages.custom_metrics`. Treats live INFORMATION_SCHEMA and the docs at httparchive.org/docs as the sources of truth.
---

# HTTP Archive Documentation & Custom Metrics

This skill guides agents to retrieve authoritative documentation and explore custom metrics directly from live sources without guessing or relying on stale catalogs.

---

## 0. Check the Tech Report First

If the question is about a technology's adoption, Core Web Vitals, Lighthouse scores or page weight over time (for example "how many sites use React", "WordPress CWV pass rate by country"), use the Tech Report MCP tools from this plugin (`search_technologies`, `get_adoption_metrics`, `get_cwv_metrics`, `get_lighthouse_metrics`, `get_page_weight_metrics` and related tools). They return pre-aggregated data with no BigQuery cost. Use BigQuery only for questions the Tech Report doesn't cover.

---

## 1. Official Documentation Lookup

Official HTTP Archive documentation is published at [httparchive.org/docs](https://httparchive.org/docs).

### How to Fetch a Page
Append `.md` to any docs URL (for example `https://httparchive.org/docs/guides/minimizing-costs.md`) to get the page as clean Markdown, and fetch that with your built-in web fetch tool. If the `.md` URL returns 404, fetch the HTML page instead; the fetch tool converts it to readable text. If you have no web fetch tool, use `curl -sL "<url>"` (on Windows use `curl.exe`, which ships with Windows 10 and later; in Windows PowerShell 5.1, plain `curl` is an alias for `Invoke-WebRequest`).

### Key Pages

| Topic | URL | Purpose |
|---|---|---|
| Minimizing costs | https://httparchive.org/docs/guides/minimizing-costs | Partition pruning, clustering, and prototyping with `rank`, `TABLESAMPLE` and `sample_data`. |
| Getting started | https://httparchive.org/docs/guides/getting-started | Getting started querying HTTP Archive in BigQuery. |
| Guided tour | https://httparchive.org/docs/guides/guided-tour | Walkthrough of the datasets and example queries. |
| Release cycle | https://httparchive.org/docs/guides/release-cycle | Monthly crawl schedule and dataset release timelines. |
| `pages` table | https://httparchive.org/docs/reference/tables/pages | Full field descriptions for `crawl.pages`. |
| `requests` table | https://httparchive.org/docs/reference/tables/requests | Field descriptions and MIME types for `crawl.requests`. |
| `custom_metrics` struct | https://httparchive.org/docs/reference/structs/custom-metrics | Overview of custom metric categories and extraction. |
| `technologies` struct | https://httparchive.org/docs/reference/structs/technology | Schema of the Wappalyzer technology detections array. |
| `features` struct | https://httparchive.org/docs/reference/structs/feature | Schema of the Blink runtime feature detections array. |
| Header struct | https://httparchive.org/docs/reference/structs/header | Schema of request and response header arrays. |
| JSON blobs | https://httparchive.org/docs/reference/blobs/lighthouse (also `page-payload`, `page-summary`, `page-metadata`, `request-payload`, `request-summary`) | Structure of the large JSON columns. |
| `capo` UDF | https://httparchive.org/docs/reference/functions/capo | Head element ordering. |
| `get_origin` UDF | https://httparchive.org/docs/reference/functions/get_origin | Origin extraction. |

### Finding Other Pages
Pages are added and moved over time. For the current list, fetch the sitemap and keep the `/docs/` URLs:

```text
https://httparchive.org/sitemap.xml
```

To search across all docs at once, fetch `https://httparchive.org/llms-small.txt`, a plain-text dump of the whole documentation. It is large, so prefer individual pages when you know which one you need.

---

## 2. Introspecting `custom_metrics` Live

`custom_metrics` in `httparchive.crawl.pages` is a structured `RECORD` column of `JSON` sub-columns, one per custom metric category; categories are added over time. Under BigQuery's Capacitor columnar storage, **each sub-column is stored independently**.

### Discover All Active Categories
Query BigQuery's metadata catalog to inspect all registered sub-columns without scanning table data (INFORMATION_SCHEMA queries bill the 10 MB minimum):

```bash
bq query --use_legacy_sql=false --format=prettyjson \
"SELECT field_path, data_type 
FROM \`httparchive.crawl.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS\` 
WHERE table_name = 'pages' AND column_name = 'custom_metrics'"
```

Standard sub-columns include:
`a11y`, `cms`, `cookies`, `css_variables`, `ecommerce`, `element_count`, `javascript`, `markup`, `media`, `origin_trials`, `performance`, `privacy`, `responsive_images`, `robots_txt`, `security`, `structured_data`, `third_parties`, `well_known`, `wpt_bodies`, and `other`.

---

## 3. Sampling Real JSON Keys from `sample_data`

To inspect the actual keys present in any `custom_metrics` category without scanning production tables, query `sample_data.pages_10k` (it holds only the latest crawl month):

```bash
bq query --use_legacy_sql=false --format=prettyjson \
"SELECT JSON_KEYS(custom_metrics.a11y) AS keys 
FROM \`httparchive.sample_data.pages_10k\` 
WHERE custom_metrics.a11y IS NOT NULL 
LIMIT 1"
```

Replace `.a11y` with `.media`, `.privacy`, `.security`, or whichever sub-column is needed.

---

## 4. Querying & Extracting `custom_metrics` Correctly

### Capacitor Storage Rule: Dot Notation Only
- **CORRECT**: `SELECT custom_metrics.a11y FROM ...` — BigQuery only reads the `a11y` sub-column.
- **WRONG**: `SELECT custom_metrics FROM ...` — BigQuery reads every JSON sub-column, which costs many times more. Dry-run both forms to see the current difference.

### Extracting Values
- Use `JSON_VALUE` for scalar values (strings, numbers, booleans):
  ```sql
  JSON_VALUE(custom_metrics.other, '$.avg_dom_depth') AS dom_depth
  ```
- Use `JSON_QUERY` for arrays or complex objects:
  ```sql
  JSON_QUERY(custom_metrics.a11y, '$.tables') AS tables_summary
  ```
- Unnesting JSON arrays:
  ```sql
  SELECT
    page,
    JSON_VALUE(link) AS crawl_link
  FROM `httparchive.crawl.pages`,
    UNNEST(JSON_QUERY_ARRAY(custom_metrics.other, '$.crawl_links')) AS link
  WHERE date = '2024-01-01'
    AND client = 'mobile'
    AND is_root_page
    AND rank <= 1000;
  ```
