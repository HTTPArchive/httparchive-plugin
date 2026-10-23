---
name: httparchive-query-optimizer
description: Execution playbook for inspecting table schemas, previewing table data at $0.00 cost, running dry-run cost checks, and writing high-efficiency, cost-optimized BigQuery SQL for HTTP Archive datasets.
---

# HTTP Archive Query Optimizer & Schema Guide

HTTP Archive stores hundreds of terabytes of monthly web crawl data. BigQuery on-demand analysis costs $6.25 per TB scanned.

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

---

## 2. Preview Live Rows at $0.00 Cost

> [!IMPORTANT]
> **NEVER use `SELECT * FROM crawl.pages LIMIT 10` to preview data.**
> BigQuery evaluates `LIMIT` *after* reading data from disk. Running `LIMIT 10` on `crawl.pages` scans the entire 6+ TB partition.

### Zero-Cost Tabledata Preview
Use `bq head`, which calls the BigQuery Tabledata API. It reads stored rows directly without executing a query job and scans **0 bytes**:

```bash
bq head -n 5 --format=prettyjson \
  --selected_fields="date,client,page,rank,root_page" \
  httparchive:sample_data.pages_10k
```

---

## 3. Dry-Run Query Cost Check

Always dry-run queries before running them to verify syntax and inspect exact bytes scanned:

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

To calculate USD cost from bytes:
$$\text{Cost (USD)} = \frac{\text{Bytes Processed}}{10^{12}} \times \$6.25$$

---

## 4. The 5 Core Optimization Rules

### 1. Mandatory `date` Partition Pruning
Both `crawl.pages` and `crawl.requests` are partitioned by month on the `date` column.
- Always include `WHERE date = 'YYYY-MM-01'` (or a narrow date range).
- Omitting `date` scans all historical crawl months dating back to 2010 (multi-TB scan).

### 2. Follow Clustering Column Order Left-to-Right
Clustering pruning only works if your `WHERE` filters match the declared clustering hierarchy from left to right:
- **`crawl.pages`**: `client` → `is_root_page` → `rank` → `page`
  - To prune by `rank <= 1000`, you **must** also filter `client = 'mobile'` (or `'desktop'`) and `is_root_page = TRUE`.
- **`crawl.requests`**: `client` → `is_root_page` → `type` → `rank`
  - Always filter `type IN ('html', 'script')` to avoid scanning unneeded media/font asset blocks.

### 3. Dry-Run Estimation Trap on `rank`
BigQuery dry-run estimates **cannot** accurately calculate bytes saved by clustered filters on `rank`.
- The dry-run estimate for `rank <= 1000` reflects scanning all ranks in the date partition (overestimates scan size significantly).
- The actual execution will prune clusters at runtime and scan dramatically less data.
- **How to verify safely**: Prototype first on `sample_data.pages_10k` or use `TABLESAMPLE SYSTEM (0.01 PERCENT)` on the live table.

### 4. Projection Hygiene
- **Never `SELECT *`**: `payload`, `summary`, `lighthouse`, and `response_body` contain >80% of total table bytes.
- **Dot-notate `custom_metrics`**: `custom_metrics.a11y` reads ~10 MB for top 1k; querying root `custom_metrics` reads all 20+ JSON columns (>350 MB for top 1k).

### 5. Safe Joins Between Pages and Requests
When joining `crawl.pages` and `crawl.requests`:
- Join on `date`, `client`, and `page` (or `wptid`).
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

## 5. The 5-Step Safe Prototyping Ladder

Progress through these 5 steps when writing any new query:

1. **`bq head` ($0.00)**: Inspect actual data shapes and field names via Tabledata API.
2. **`sample_data.pages_10k` (<100 MB)**: Test query logic, unnesting, and regex on the 10k sample table.
3. **`TABLESAMPLE SYSTEM (0.01 PERCENT)`**: Produces accurate dry-run estimates against the live table.
4. **Clustered Slice**: Filter `client = 'mobile' AND is_root_page AND rank <= 1000`.
5. **Dry-Run Check**: Run `bq query --dry_run` before executing full production scans.
