---
name: httparchive-query-optimizer
description: Playbook for writing cost-safe BigQuery SQL against HTTP Archive (`httparchive.crawl.pages`, `crawl.requests`, `sample_data`). Use whenever writing, reviewing, or running an HTTP Archive query, inspecting its table schemas, previewing rows, or estimating scan cost — covers free `bq head` previews, dry runs, partition and cluster pruning, and safe pages/requests joins.
---

# HTTP Archive Query Optimizer & Schema Guide

HTTP Archive stores petabytes of monthly web crawl data, and every month adds more. BigQuery on-demand analysis costs $6.25 per TiB scanned, billed to the user's own GCP project.

Before writing SQL, check whether the Tech Report MCP tools from this plugin (`get_adoption_metrics`, `get_cwv_metrics`, `get_lighthouse_metrics`, `get_page_weight_metrics` and related tools) already answer the question. They are free and pre-aggregated per technology.

This skill equips agents with the exact CLI commands and domain optimization rules needed to inspect schemas, preview rows for free, run dry-runs, and structure production queries safely.

---

## 1. Inspect Table Schemas Live

Instead of assuming column names, inspect live schema metadata directly from BigQuery:

```bash
# Full schema with column types, modes, and descriptions
bq show --schema --format=prettyjson httparchive:crawl.pages

# View table details (partitioning column, clustering fields, row count)
bq show --format=prettyjson httparchive:crawl.pages
```

### Key Table Architecture

| Dataset | Table | Granularity | Partitioning | Clustering Hierarchy |
|---|---|---|---|---|
| `crawl` | `pages` | 1 row per crawled page per month | `date` | `client`, `is_root_page`, `rank`, `page` |
| `crawl` | `requests` | 1 row per HTTP request | `date` | `client`, `is_root_page`, `type`, `rank` |
| `sample_data` | `pages_10k` | 10k pages subset | `date` | `client`, `is_root_page`, `rank`, `page` |
| `sample_data` | `requests_10k` | Requests for 10k pages | `date` | `client`, `is_root_page`, `type`, `rank` |

`sample_data` is rebuilt every crawl and holds only the most recent month. Find it with `bq head -n 1 --selected_fields=date httparchive:sample_data.pages_10k`.

Table sizes change every month. Never quote byte counts from memory; dry-run the query (section 3) for the current number.

---

## 2. Preview Live Rows at $0.00 Cost

> [!IMPORTANT]
> **NEVER use `SELECT * FROM crawl.pages LIMIT 10` to preview data.**
> BigQuery evaluates `LIMIT` *after* reading data from disk, so `SELECT * ... LIMIT 10` bills every byte of every selected column in the partition, which for one `crawl.pages` month is tens of terabytes.

### Zero-Cost Tabledata Preview
Use `bq head`, which calls the BigQuery Tabledata API. It reads stored rows directly without executing a query job and scans **0 bytes**:

```bash
bq head -n 5 --format=prettyjson \
  --selected_fields="date,client,page,rank,root_page" \
  httparchive:sample_data.pages_10k
```

---

## 3. Dry-Run Query Cost Check

Always dry-run queries before running them to verify syntax and get the bytes the query will process. Dry runs are free:

```bash
bq query --use_legacy_sql=false --dry_run "
SELECT page, rank
FROM \`httparchive.crawl.pages\`
WHERE date = '2024-01-01'
  AND client = 'mobile'
  AND is_root_page
  AND rank <= 1000
"
```

To calculate USD cost from bytes (on-demand pricing; each query bills at least 10 MB):
$$\text{Cost (USD)} = \frac{\text{Bytes Processed}}{2^{40}} \times \$6.25$$

For HTTP Archive tables the dry-run figure includes partition and cluster pruning, including filters on `rank`, and matches the bytes the run actually processes. Use it to compare query variants before running any of them.

---

## 4. The 5 Core Optimization Rules

### 1. Mandatory `date` Partition Pruning
Both `crawl.pages` and `crawl.requests` are partitioned by month on the `date` column.
- Always include `WHERE date = 'YYYY-MM-01'` (or a narrow date range).
- Both tables set `require_partition_filter`, so a query without a `date` filter is rejected. A wide range (`date >= '2016-01-01'`) is accepted and multiplies the scan by the number of months.

### 2. Follow Clustering Column Order Left-to-Right
Clustering prunes most effectively when `WHERE` filters cover the clustering columns in declared order, left to right. Filters on later columns alone still prune, just less:
- **`crawl.pages`**: `client` → `is_root_page` → `rank` → `page`
  - Filter `client = 'mobile'` (or `'desktop'`) and `is_root_page` alongside `rank <= 1000` for the best pruning.
- **`crawl.requests`**: `client` → `is_root_page` → `type` → `rank`
  - Filter `type` (for example `type IN ('html', 'script')`) whenever the question concerns specific resource types, to skip image, font and media blocks.

### 3. Trust the Dry Run, Including `rank` Filters
Older guidance warns that dry runs overestimate queries filtered on `rank` ([issue 176795805](https://issuetracker.google.com/issues/176795805)). Dry runs now account for clustered `rank` filters on both `crawl.pages` and `crawl.requests`, so you no longer need `sample_data` or `TABLESAMPLE` to get a believable estimate.
- Prefer `rank <= N` over `TABLESAMPLE` for prototyping: it returns the same pages every run and works for any month.
- BigQuery still [doesn't guarantee](https://cloud.google.com/bigquery/docs/clustered-tables#clustered_table_pricing) estimates on clustered tables. If a run's billed bytes differ noticeably from the dry run, check `bq show -j <job_id>` and reach for `sample_data` until the cause is clear.

### 4. Projection Hygiene
- **Never `SELECT *`**: the JSON blob columns (`payload`, `summary`, `lighthouse`, `custom_metrics`, `response_body`) dominate table bytes.
- **Dot-notate `custom_metrics`**: `custom_metrics.a11y` reads one JSON sub-column; root `custom_metrics` reads all of them. Dry-run both forms to see the difference for the current month.

### 5. Safe Joins Between Pages and Requests
When joining `crawl.pages` and `crawl.requests`:
- Join on `client` and `page` (plus `date` when spanning months). Note `crawl.requests` has no `wptid` column.
- **Repeat partition (`date`) and clustering filters on BOTH sides** so BigQuery prunes both tables before joining:

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

---

## 5. The Safe Prototyping Ladder

Progress through these steps when writing any new query, dry-running at every step:

1. **`bq head` ($0.00)**: Inspect actual data shapes and field names via Tabledata API.
2. **`sample_data.pages_10k` / `requests_10k`**: Test query logic, unnesting, and regex on the 10k-page sample. It still holds the full JSON blobs, so project only the columns you need.
3. **Clustered slice**: Run against `crawl.*` with `client = 'mobile' AND is_root_page AND rank <= 1000`, then widen `rank` step by step, checking the dry run each time.
4. **Full run**: Remove the `rank` filter only after the dry run for the full query is acceptable.

`TABLESAMPLE SYSTEM (n PERCENT)` is an alternative to step 3 when you need a random sample rather than the top-ranked sites. Its results change between runs.
