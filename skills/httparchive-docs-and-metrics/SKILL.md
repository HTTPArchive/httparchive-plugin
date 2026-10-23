---
name: httparchive-docs-and-metrics
description: Retrieve official HTTP Archive documentation and introspect `custom_metrics` JSON sub-columns in BigQuery. Use when the user asks what an HTTP Archive table, field, custom metric, struct or UDF means, needs the crawl release schedule, or wants to know which JSON keys exist in `crawl.pages.custom_metrics`. Treats live INFORMATION_SCHEMA and the httparchive.org docs on GitHub as the sources of truth.
---

# HTTP Archive Documentation & Custom Metrics

This skill guides agents to retrieve authoritative documentation and explore custom metrics directly from live sources without guessing or relying on stale catalogs.

---

## 0. Check the Tech Report First

If the question is about a technology's adoption, Core Web Vitals, Lighthouse scores or page weight over time (for example "how many sites use React", "WordPress CWV pass rate by country"), use the Tech Report MCP tools from this plugin (`search_technologies`, `get_adoption_metrics`, `get_cwv_metrics`, `get_lighthouse_metrics`, `get_page_weight_metrics` and related tools). They return pre-aggregated data with no BigQuery cost. Use BigQuery only for questions the Tech Report doesn't cover.

---

## 1. Official Documentation Lookup

Official HTTP Archive documentation is maintained in markdown within the [`HTTPArchive/httparchive.org`](https://github.com/HTTPArchive/httparchive.org) repository.

### Raw Documentation Base URL
```text
https://raw.githubusercontent.com/HTTPArchive/httparchive.org/main/src/content/docs/docs/
```

### Key Topics & File Paths

| Topic | Category | Relative Path | Purpose |
|---|---|---|---|
| `minimizing-costs` | Guide | `guides/minimizing-costs.md` | Authoritative rules for partition pruning, clustering, and prototyping ladders. |
| `getting-started` | Guide | `guides/getting-started.mdx` | Getting started querying HTTP Archive in BigQuery. |
| `guided-tour` | Guide | `guides/guided-tour.mdx` | Walkthrough of the datasets and example queries. |
| `release-cycle` | Guide | `guides/release-cycle.mdx` | Monthly crawl schedule and dataset release timelines. |
| `pages` | Table Ref | `reference/tables/pages.mdx` | Full field descriptions for `crawl.pages`. |
| `requests` | Table Ref | `reference/tables/requests.mdx` | Field descriptions and MIME types for `crawl.requests`. |
| `custom-metrics` | Struct Ref | `reference/structs/custom-metrics.mdx` | Overview of custom metric categories and extraction. |
| `technology` | Struct Ref | `reference/structs/technology.mdx` | Schema of Wappalyzer technology detections array. |
| `feature` | Struct Ref | `reference/structs/feature.mdx` | Schema of Blink runtime feature detections array. |
| `header` | Struct Ref | `reference/structs/header.mdx` | Schema of request/response header arrays. |
| `blobs` | Blob Ref | `reference/blobs/{lighthouse,page-payload,page-summary,page-metadata,request-payload,request-summary}.mdx` | Structure of the large JSON columns. |
| `capo` | Function Ref | `reference/functions/capo.mdx` | Usage of the CAPO UDF for head element ordering. |
| `get_origin` | Function Ref | `reference/functions/get_origin.mdx` | Origin extraction function reference. |

Docs move occasionally. If a path returns 404, list the current tree:
```bash
gh api 'repos/HTTPArchive/httparchive.org/git/trees/main?recursive=1' \
  --jq '.tree[].path | select(startswith("src/content/docs/docs/") and (endswith(".md") or endswith(".mdx")))'
```

### CLI Retrieval Pattern
Fetch any document directly into your agent context using `curl`:
```bash
curl -sL "https://raw.githubusercontent.com/HTTPArchive/httparchive.org/main/src/content/docs/docs/guides/minimizing-costs.md"
```

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
