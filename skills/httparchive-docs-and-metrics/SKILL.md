---
name: httparchive-docs-and-metrics
description: Retrieval guide for official HTTP Archive documentation and live introspection of `custom_metrics` JSON sub-columns in BigQuery. Use live INFORMATION_SCHEMA and GitHub raw documentation as the definitive sources of truth.
---

# HTTP Archive Documentation & Custom Metrics

This skill guides agents to retrieve authoritative documentation and explore custom metrics directly from live sources without guessing or relying on stale catalogs.

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
| `getting-started` | Guide | `guides/getting-started.md` | Getting started querying HTTP Archive in BigQuery. |
| `release-cycle` | Guide | `guides/release-cycle.md` | Monthly crawl schedule and dataset release timelines. |
| `pages` | Table Ref | `reference/tables/pages.md` | Full field descriptions for `crawl.pages`. |
| `requests` | Table Ref | `reference/tables/requests.md` | Field descriptions and MIME types for `crawl.requests`. |
| `custom-metrics` | Struct Ref | `reference/structs/custom-metrics.md` | Overview of custom metric categories and extraction. |
| `technologies` | Struct Ref | `reference/structs/technologies.md` | Schema of Wappalyzer technology detections array. |
| `features` | Struct Ref | `reference/structs/features.md` | Schema of Blink runtime feature detections array. |
| `capo` | Function Ref | `reference/functions/capo.md` | Usage of the CAPO UDF for head element ordering. |
| `get_origin` | Function Ref | `reference/functions/get_origin.md` | Origin extraction function reference. |

### CLI Retrieval Pattern
Fetch any document directly into your agent context using `curl`:
```bash
curl -sL "https://raw.githubusercontent.com/HTTPArchive/httparchive.org/main/src/content/docs/docs/guides/minimizing-costs.md"
```

---

## 2. Introspecting `custom_metrics` Live

`custom_metrics` in `httparchive.crawl.pages` is a structured `RECORD` column containing 20+ distinct `JSON` sub-columns. Under BigQuery's Capacitor columnar storage, **each sub-column is stored independently**.

### Discover All Active Categories (Zero Cost)
Query BigQuery's metadata catalog to inspect all registered sub-columns without scanning any table data:

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

To inspect the actual keys present in any `custom_metrics` category without scanning production tables, query `sample_data.pages_10k`:

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
- **CORRECT**: `SELECT custom_metrics.a11y FROM ...` — BigQuery only reads the `a11y` sub-column (~10 MB for top 1k).
- **WRONG**: `SELECT custom_metrics FROM ...` — BigQuery reads all 20+ JSON columns (>350 MB for top 1k).

### Extracting Values
- Use `JSON_VALUE` for scalar values (strings, numbers, booleans):
  ```sql
  JSON_VALUE(custom_metrics.other, '$.avg_dom_depth') AS dom_depth
  ```
- Use `JSON_QUERY` for arrays or complex objects:
  ```sql
  JSON_QUERY(custom_metrics.a11y, '$.axe.violations') AS violations_array
  ```
- Unnesting JSON arrays:
  ```sql
  SELECT
    page,
    JSON_VALUE(violation, '$.id') AS violation_id
  FROM `httparchive.crawl.pages`,
    UNNEST(JSON_QUERY_ARRAY(custom_metrics.a11y, '$.axe.violations')) AS violation
  WHERE date = '2024-01-01'
    AND client = 'mobile'
    AND is_root_page
    AND rank <= 1000;
  ```
