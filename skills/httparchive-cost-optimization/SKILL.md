---
name: httparchive-cost-optimization
description: Practical execution playbook for minimizing BigQuery query costs on HTTP Archive datasets. Source of truth is the official Minimizing Costs guide (`https://httparchive.org/docs/guides/minimizing-costs/`) and live dry-runs via `analyze_query_cost`.
---

# HTTP Archive Query Cost Optimization

HTTP Archive tables contain hundreds of terabytes of data. BigQuery on-demand pricing is $6.25 per TB scanned.

- **Authoritative Guide**: [https://httparchive.org/docs/guides/minimizing-costs/](https://httparchive.org/docs/guides/minimizing-costs/) (read via `get_documentation({ topic: "minimizing-costs" })`).
- **Live Dry-Run Tool** (provided via remote Streamable HTTP MCP at `https://cdn.httparchive.org/mcp`): `analyze_query_cost({ query })` calculates exact bytes processed, estimated USD cost, and checks for partition and clustering violations.

---

## The 5 Cost Minimization Rules

### 1. Mandatory Partition Pruning on `date`
- Both `crawl.pages` and `crawl.requests` are partitioned by `date`.
- Always filter `WHERE date = 'YYYY-MM-01'`. Omitting `date` scans all historical crawl months dating back to 2010 (multi-TB scan).

### 2. Follow Cluster Column Order
Clustering pruning only works effectively when filters match the defined clustering hierarchy from left to right:

| Table | Cluster Column 1 | Cluster Column 2 | Cluster Column 3 | Cluster Column 4 |
|---|---|---|---|---|
| `crawl.pages` | `client` | `is_root_page` | `rank` | `page` |
| `crawl.requests` | `client` | `is_root_page` | `type` | `rank` |

- Always include `client = 'mobile'` (or `'desktop'`) and `is_root_page = TRUE` when filtering by `rank <= 1000`.
- For `requests`, filter `type IN ('html', 'script')` to prune non-essential MIME blocks.

### 3. Dry-Run Estimation Bug on `rank`
BigQuery dry-run estimates **cannot** accurately estimate bytes processed for clustered tables when filtering on `rank`.
- The dry-run estimate for `rank <= 1000` overestimates scan size significantly; actual execution will scan much less.
- When you need deterministic, verified low-cost scans while prototyping, use `sample_data.pages_10k` or `TABLESAMPLE`.

### 4. Projection Hygiene
- **Never `SELECT *`**: `payload`, `summary`, `lighthouse`, and `response_body` account for >80% of data volume.
- **Project specific sub-records for `custom_metrics`**: Selecting `custom_metrics.a11y` only reads that sub-column from Capacitor storage (~10 MB for top 1k). Selecting root `custom_metrics` reads all 20+ JSON columns (~350 MB for top 1k).

### 5. Never Rely on `LIMIT` to Reduce Cost
BigQuery evaluates `LIMIT` *after* reading data from disk. `SELECT ... FROM crawl.pages LIMIT 1` will scan the entire 6+ TB partition. Use `TABLESAMPLE` or `sample_data.pages_10k` instead.

---

## 5-Step Safe Prototyping Ladder

Progress through these 5 steps when writing any new query:

1. **Table Preview ($0.00)**: Call `preview_table_rows` to inspect live data shapes at zero cost (uses BigQuery Tabledata API).
2. **`sample_data.pages_10k` (<100 MB)**: Test query logic, unnesting, and regex on the fixed 10k sample table.
3. **`TABLESAMPLE SYSTEM (0.01 PERCENT)`**: Produces accurate BigQuery dry-run cost estimates against the live table.
4. **Clustered Slice**: Filter `client = 'mobile' AND is_root_page AND rank <= 1000`.
5. **Production Run**: Run live dry-run via `analyze_query_cost` before executing full queries.
