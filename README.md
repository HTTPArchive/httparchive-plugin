# HTTP Archive Agent Plugin

[![CI](https://github.com/httparchive/httparchive-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/httparchive/httparchive-plugin/actions/workflows/ci.yml)
[![Agent Plugins](https://img.shields.io/badge/Agent_Plugins-v1.0.0-blue.svg)](https://agent-plugins.org/)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

An official, CLI-first agent plugin conforming to the [Agent Plugins Specification (v1.0.0)](https://agent-plugins.org/) for querying the [HTTP Archive](https://httparchive.org) dataset in Google Cloud BigQuery.

---

## Why Pure Skills?

Instead of running a local MCP server or forcing a remote MCP dependency that incurs continuous schema token bloat and maintenance overhead, this plugin provides **two high-leverage agent skills**:

1. **Zero System Prompt Bloat**: MCP tools inject JSON Schemas into the agent context on *every single interaction*. Skills are loaded on demand only when relevant to the task.
2. **CLI-First Flexibility**: AI agents can run native commands (`bq`, `curl`, `jq`), pipe outputs, and inspect specific properties without being locked into rigid tool signatures.
3. **Always Up to Date**: Agents query BigQuery's live `INFORMATION_SCHEMA` and fetch official documentation directly from GitHub, ensuring schemas and metrics never get stale.
4. **Zero Maintenance & Downtime**: No servers, no local background processes, and no external runtime dependencies.

---

## Included Skills

### 1. [`httparchive-docs-and-metrics`](skills/httparchive-docs-and-metrics/SKILL.md)
Retrieval guide for official HTTP Archive documentation and live introspection of `custom_metrics` JSON sub-columns in BigQuery.

- **Live Documentation Fetching**: Instructions and paths to read authoritative guides (`minimizing-costs.md`, `getting-started.md`, `release-cycle.md`), table references (`pages.md`, `requests.md`), and UDFs (`capo.md`, `get_origin.md`) directly from GitHub:
  ```bash
  curl -sL "https://raw.githubusercontent.com/HTTPArchive/httparchive.org/main/src/content/docs/docs/guides/minimizing-costs.md"
  ```
- **Live `custom_metrics` Discovery ($0.00)**: Discover all active categories from BigQuery's metadata catalog:
  ```bash
  bq query --use_legacy_sql=false --format=prettyjson \
  "SELECT field_path, data_type 
  FROM \`httparchive.crawl.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS\` 
  WHERE table_name = 'pages' AND column_name = 'custom_metrics'"
  ```
- **Key Sampling from `sample_data`**: Sample real JSON property keys via `JSON_KEYS()` on `sample_data.pages_10k`.
- **Capacitor Storage Rules**: Why dot-notation (`custom_metrics.a11y`) only scans ~10 MB, while selecting root `custom_metrics` scans >350 MB.

---

### 2. [`httparchive-query-optimizer`](skills/httparchive-query-optimizer/SKILL.md)
Execution playbook for inspecting table schemas, previewing table data at $0.00 cost, running dry-run cost checks, and writing high-efficiency BigQuery SQL.

- **Live Schema Introspection**:
  ```bash
  bq show --schema --format=prettyjson httparchive:crawl.pages
  ```
- **Zero-Cost Tabledata Previews**: How to use `bq head` to inspect live data at $0.00 cost without executing query jobs (avoiding the `SELECT ... LIMIT 1` trap):
  ```bash
  bq head -n 5 --format=prettyjson --selected_fields="date,client,page,rank" httparchive:sample_data.pages_10k
  ```
- **Dry-Run Cost Checks**:
  ```bash
  bq query --use_legacy_sql=false --dry_run "SELECT ..."
  ```
- **The 5 Core Optimization Rules**:
  1. Mandatory `date` partition pruning (`WHERE date = 'YYYY-MM-01'`).
  2. Follow clustering order left-to-right (`client` → `is_root_page` → `rank` → `page`).
  3. **The Dry-Run Estimation Trap on `rank`**: Explains why dry-run estimates for `rank <= 1000` overestimate actual scan costs, and how to safely prototype on `sample_data.pages_10k` or `TABLESAMPLE`.
  4. Projection hygiene (no `SELECT *`, dot-notate `custom_metrics`).
  5. Safe joins between `crawl.pages` and `crawl.requests` (repeating partition and clustering filters on both sides).
- **The 5-Step Safe Prototyping Ladder**:
  `bq head` ($0.00) → `sample_data.pages_10k` (<100 MB) → `TABLESAMPLE SYSTEM (0.01 PERCENT)` → Clustered slice (`rank <= 1000`) → Dry-run before production run.

---

## Directory Structure

```text
httparchive-plugin/
├── plugin.json                              # Agent Plugins v1.0.0 root manifest
├── skills/
│   ├── httparchive-docs-and-metrics/
│   │   └── SKILL.md                         # Documentation & custom metrics skill
│   └── httparchive-query-optimizer/
│       └── SKILL.md                         # Query optimization & schema skill
├── tests/
│   └── plugin.test.js                       # Specification & skill verification tests
├── scripts/
│   ├── validate-spec.js                     # Validates plugin against agent-plugins.org schemas
│   └── schemas/1.0.0/                       # Canonical Agent Plugins JSON schemas
└── .github/workflows/
    └── ci.yml                               # GitHub Actions CI workflow
```

---

## Installation & Usage

Add the plugin to your agent's skills or plugins discovery directory:

```bash
git clone https://github.com/httparchive/httparchive-plugin.git
```

In any Agent Plugins v1.0.0 compatible harness (such as Antigravity, Cursor, Claude Code, or Jules), the skills will be automatically discovered and activated when exploring HTTP Archive tables or writing queries.

---

## Testing & Validation

```bash
# Install test dependencies
npm install

# Run unit tests
npm test

# Validate Agent Plugins specification conformance
npm run validate:spec

# Run linter
npm run lint
```

---

## License

[Apache 2.0](LICENSE) © HTTP Archive Team
