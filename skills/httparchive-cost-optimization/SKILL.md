---
name: httparchive-cost-optimization
description: Practical execution playbook for minimizing BigQuery query costs on HTTP Archive datasets. Use when writing, reviewing, or optimizing queries to prevent expensive multi-terabyte scans and avoid common BigQuery cost traps.
---

# HTTP Archive Query Cost Optimization

HTTP Archive tables contain hundreds of terabytes of data. BigQuery charges $6.25 per TB scanned (with 1 TB free per month). Writing unoptimized queries will exhaust your monthly free tier in a single execution.

Follow these rules and workflows to query data efficiently and safely.

---

## The 5 Rules of HTTP Archive Query Optimization

### 1. Always Filter on Partition Column `date`
Both `crawl.pages` and `crawl.requests` are partitioned by `date`.
- **Rule**: Include `date = 'YYYY-MM-01'` in the `WHERE` clause of every query.
- **Impact**: Omitting `date` scans all historical crawl months dating back to 2010.

```sql
-- CORRECT
WHERE date = '2024-01-01'

-- FATAL (Scans every month in HTTP Archive history)
WHERE client = 'desktop' AND rank <= 1000
```

### 2. Follow Cluster Column Order
BigQuery takes full advantage of clustering only when query filters match the defined clustering hierarchy from left to right:

| Table | Cluster Column 1 | Cluster Column 2 | Cluster Column 3 | Cluster Column 4 |
|---|---|---|---|---|
| `crawl.pages` | `client` | `is_root_page` | `rank` | `page` |
| `crawl.requests` | `client` | `is_root_page` | `type` | `rank` |

- Filtering on `client` AND `is_root_page` AND `rank` achieves maximum block pruning.
- Filtering on `rank` without `client` or `is_root_page` degrades pruning efficiency.
- For `requests`, filtering by `type IN ('html', 'script')` prunes image, font, and CSS blocks.

```sql
-- OPTIMAL (prunes by client, root page, and rank)
WHERE date = '2024-01-01'
  AND client = 'mobile'
  AND is_root_page
  AND rank <= 1000
```

### 3. Understand the Dry-Run Estimation Bug on `rank`
BigQuery has a known limitation: **dry-run estimation cannot accurately estimate bytes processed for clustered tables when filtering on `rank` or non-prefix cluster columns**.
- The dry-run estimate for `WHERE rank <= 1000` may report 500 GB, but actual execution will only scan ~15-30 GB.
- If you need guaranteed small scans and accurate dry-run estimates while developing queries, use `sample_data` or `TABLESAMPLE`.

### 4. Projection Discipline: Never `SELECT *`
- **Never use `SELECT *`**: HTTP Archive tables contain massive JSON and string blobs (`payload`, `lighthouse`, `summary`, `response_body`).
- **Use sub-columns for `custom_metrics`**: `custom_metrics` is a structured `RECORD`. Selecting `custom_metrics.a11y` only scans that sub-column (~10 MB for top 1k). Selecting the root `custom_metrics` scans all 20+ JSON blobs (~350 MB for top 1k).
- **Avoid `payload` and `response_body`**: These two columns account for >80% of total table bytes. Extract the required data from `summary` or specific `custom_metrics` sub-fields whenever possible.

### 5. Never Rely on `LIMIT` to Reduce Cost
In BigQuery, `LIMIT` is evaluated *after* data is read from disk.
- `SELECT custom_metrics.other.avg_dom_depth FROM crawl.pages WHERE date = '2024-01-01' LIMIT 1` will scan the **entire 6+ TB** partition!
- Use `TABLESAMPLE` or `sample_data` instead.

---

## The 5-Step Safe Prototyping Ladder

Progress through these 5 steps when writing any new query:

```
[Step 1: Table Preview ($0)]
      │
[Step 2: sample_data.pages_10k (<100 MB)]
      │
[Step 3: TABLESAMPLE SYSTEM (0.01%) (Accurate Estimates)]
      │
[Step 4: Clustered Slice (rank <= 1000)]
      │
[Step 5: Full Production Run]
```

### Step 1: Zero-Cost Table Previews ($0.00)
Use the BigQuery Tabledata API (or MCP `preview_table_rows` tool) to inspect row structures, column types, and sample JSON payloads. This scans 0 bytes and costs $0.00.

### Step 2: `sample_data.pages_10k` (Deterministic <100 MB)
HTTP Archive maintains a fixed 10,000-page subset: `httparchive.sample_data.pages_10k` and `requests_10k`.
Use this to write, debug, and verify query logic, unnesting syntax, and regexes without incurring billable costs.

```sql
SELECT page, t.technology
FROM `httparchive.sample_data.pages_10k`,
  UNNEST(technologies) AS t
WHERE client = 'mobile'
  AND is_root_page;
```

### Step 3: `TABLESAMPLE SYSTEM (0.01 PERCENT)`
`TABLESAMPLE` samples a random pseudo-random percentage of data blocks on live tables and produces **accurate BigQuery dry-run cost estimates**:

```sql
SELECT
  CAST(JSON_VALUE(custom_metrics.other, '$.avg_dom_depth') AS FLOAT64) AS avg_depth
FROM `httparchive.crawl.pages` TABLESAMPLE SYSTEM (0.01 PERCENT)
WHERE date = '2024-01-01'
  AND client = 'desktop';
```
*(Scans ~680 MB instead of 6.8 TB).*

### Step 4: Clustered Slice (Top 1k / Top 10k Sites)
Filter by top popularity ranks to restrict data scan to the smallest sample:

```sql
WHERE date = '2024-01-01'
  AND client = 'mobile'
  AND is_root_page
  AND rank <= 1000
```

### Step 5: Full Run / Check Pre-computed Reports
Before running full-scale queries across millions of origins, verify whether your metric is already pre-aggregated:
- Core Web Vitals: `httparchive.reports.cwv_timeseries`
- Page transfer size: `httparchive.reports.bytesTotal_timeseries`
- Protocol adoption: `httparchive.reports.h2_timeseries`
- Tech Report API: `get_cwv_metrics`, `get_adoption_metrics`, `get_page_weight_metrics`
