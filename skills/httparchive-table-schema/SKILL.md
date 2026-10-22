---
name: httparchive-table-schema
description: Deep architectural reference for HTTP Archive BigQuery tables (`crawl.pages`, `crawl.requests`, `sample_data`, `reports`). Use when writing advanced queries involving nested arrays (`technologies`, `features`), record sub-columns (`custom_metrics`), request types, and table joins.
---

# HTTP Archive BigQuery Table Schemas

This skill documents the exact schema design, column types, nested structures, and relationships across HTTP Archive datasets.

## Core Datasets & Tables

| Dataset | Table | Granularity | Partitioning | Clustering | Typical Use |
|---|---|---|---|---|---|
| `crawl` | `pages` | 1 row per tested page per month | `date` | `client`, `is_root_page`, `rank`, `page` | Page-level metrics, CWV, custom metrics, technologies |
| `crawl` | `requests` | 1 row per HTTP request | `date` | `client`, `is_root_page`, `type`, `rank` | Asset weights, MIME types, headers, third-party requests |
| `sample_data` | `pages_10k` | 10k pages subset | `date` | `client`, `is_root_page`, `rank`, `page` | Fast, zero-risk prototyping (<100 MB scan) |
| `sample_data` | `requests_10k` | Requests for 10k pages | `date` | `client`, `is_root_page`, `type`, `rank` | Request-level prototyping |
| `reports` | `*_timeseries` / `*_histogram` | Aggregated percentiles & distributions | `date` | `lens` | Pre-computed metrics over time ($0 / negligible scan) |

---

## 1. `httparchive.crawl.pages`

Contains one row per page tested in the HTTP Archive monthly crawl. Since April 2022, both the home/root page (`is_root_page = TRUE`) and one secondary page (`is_root_page = FALSE`) are tested per origin.

### Critical Columns & Types

- **`date` (DATE)**: Monthly crawl snapshot (e.g. `'2024-01-01'`). Mandatory partition filter.
- **`client` (STRING)**: `'desktop'` (Chrome on desktop) or `'mobile'` (Chrome on emulated Moto G4). First clustering key.
- **`is_root_page` (BOOLEAN)**: `TRUE` for origin landing pages (`https://example.com/`), `FALSE` for secondary internal pages. Second clustering key.
- **`rank` (INTEGER)**: Popularity bucket from Chrome UX Report (CrUX): 1,000, 10,000, 100,000, 1,000,000, 10,000,000. Third clustering key.
- **`page` (STRING)**: Exact URL of tested page. Fourth clustering key.
- **`root_page` (STRING)**: Origin URL with trailing slash.
- **`wptid` (STRING)**: WebPageTest result identifier (format: `YYMMDD_D...` or `YYMMDD_M...`). View in browser at `https://webpagetest.httparchive.org/result/<wptid>/`.

### Complex & Nested Structures

#### `technologies` (`ARRAY<STRUCT<technology STRING, categories ARRAY<STRING>, info ARRAY<STRING>>>`)
Detected technologies via Wappalyzer. Unnest to filter or group:

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
ORDER BY origins_count DESC
LIMIT 20;
```

#### `features` (`ARRAY<STRUCT<feature STRING, id INTEGER>>`)
Blink runtime features detected by Chromium during test (references ChromeStatus.com features):

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
GROUP BY f.feature
ORDER BY total DESC;
```

#### `custom_metrics` (`RECORD` of 20 `JSON` fields)
`custom_metrics` is a structured `RECORD` whose members are individual `JSON` columns:
`a11y`, `cms`, `cookies`, `css_variables`, `ecommerce`, `element_count`, `javascript`, `markup`, `media`, `origin_trials`, `performance`, `privacy`, `responsive_images`, `robots_txt`, `security`, `structured_data`, `third_parties`, `well_known`, `wpt_bodies`, `other`.

**Capacitor Storage Rule**: Querying `custom_metrics.a11y` only scans that sub-column. Querying `custom_metrics` without dot notation scans all 20 categories.

Extract properties with `JSON_VALUE` (scalars) or `JSON_QUERY` (arrays/objects):

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

#### Large JSON Blobs
- `summary` (`JSON`): High-level WebPageTest metrics (`summary.bytesTotal`, `summary.reqTotal`, `summary.TTFB`, etc.).
- `lighthouse` (`JSON`): Complete raw Lighthouse audit report.
- `payload` (`JSON`): Complete WebPageTest test dump. Very large (>100 KB/row). Project only when necessary.

---

## 2. `httparchive.crawl.requests`

Contains one row per individual HTTP request made by pages tested in HTTP Archive.

### Critical Columns & Types

- **`date` (DATE)**: Monthly partition key.
- **`client` (STRING)**: `'desktop'` or `'mobile'`.
- **`is_root_page` (BOOLEAN)**: `TRUE` for root page requests.
- **`type` (STRING)**: Simplified asset MIME type: `'script'`, `'html'`, `'css'`, `'image'`, `'font'`, `'text'`, `'video'`, `'wasm'`, `'other'`. Third clustering key.
- **`rank` (INTEGER)**: CrUX popularity rank of host page.
- **`url` (STRING)**: Request URL.
- **`page` (STRING)**: Host page URL.
- **`is_main_document` (BOOLEAN)**: `TRUE` for the primary HTML response (first HTML request after redirects).
- **`index` (INTEGER)**: Sequential 1-based order of the request in the waterfall.
- **`request_headers` / `response_headers` (`ARRAY<STRUCT<name STRING, value STRING>>`)**: Request and response headers.
- **`response_body` (STRING)**: Text response body (HTML, JS, CSS, JSON, text). Binary bodies (images, fonts, video) are NOT stored.

### Request Filtering Pattern

Always filter by `type` to prune unused asset data blocks:

```sql
SELECT
  page,
  url,
  resp_header.value AS content_encoding
FROM `httparchive.crawl.requests`,
  UNNEST(response_headers) AS resp_header
WHERE date = '2024-01-01'
  AND client = 'mobile'
  AND is_root_page
  AND rank <= 1000
  AND type = 'script'
  AND LOWER(resp_header.name) = 'content-encoding';
```

---

## 3. Joining Pages and Requests

When joining `crawl.pages` and `crawl.requests`:
1. Always join on `date`, `client`, and `page` (or `wptid`).
2. Include the partition and clustering filters on **BOTH** sides of the join.

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
  SELECT page, url, type
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
GROUP BY p.page, p.rank
ORDER BY script_requests_count DESC;
```
