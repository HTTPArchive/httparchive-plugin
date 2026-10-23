# HTTP Archive Agent Plugin

[![CI](https://github.com/httparchive/httparchive-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/httparchive/httparchive-plugin/actions/workflows/ci.yml)
[![Agent Plugins](https://img.shields.io/badge/Agent_Plugins-v1.0.0-blue.svg)](https://agent-plugins.org/)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

An official, CLI-first agent plugin conforming to the [Agent Plugins Specification (v1.0.0)](https://agent-plugins.org/) for working with [HTTP Archive](https://httparchive.org) data: cost-safe BigQuery queries over the raw crawl, plus the pre-aggregated [Tech Report](https://httparchive.org/reports/techreport/landing) through a remote MCP server.

---

## Skills and MCP

The plugin combines two kinds of access, each where it fits best:

- **Skills for the raw crawl.** Questions that need `crawl.pages` or `crawl.requests` are open-ended, so the skills teach the agent to use the `bq` CLI against live `INFORMATION_SCHEMA`, and to read the official docs at [httparchive.org/docs](https://httparchive.org/docs), instead of fixed tool signatures. Skills load only when relevant.
- **MCP for the Tech Report.** Technology adoption, Core Web Vitals, Lighthouse and page-weight trends are already aggregated by the [Tech Report](https://httparchive.org/reports/techreport/landing). The remote MCP server at `https://cdn.httparchive.org/mcp` answers those questions directly, with no BigQuery project or query cost. It needs no authentication and nothing runs locally.

### MCP tools

| Tool | Returns |
|---|---|
| `search_technologies`, `list_categories`, `list_versions` | Technologies, categories and versions tracked by the Tech Report |
| `list_ranks`, `list_geos` | Rank segments and geographies available as filters |
| `get_adoption_metrics` | Share of sites using a technology over time |
| `get_cwv_metrics`, `get_cwv_distribution`, `get_geo_breakdown` | Core Web Vitals pass rates, histograms and per-country breakdowns |
| `get_lighthouse_metrics`, `get_audits_metrics` | Lighthouse category scores and audit results |
| `get_page_weight_metrics` | Page, JavaScript and CSS weight |

---

## Included Skills

### 1. [`httparchive-docs-and-metrics`](skills/httparchive-docs-and-metrics/SKILL.md)
Retrieval guide for official HTTP Archive documentation and live introspection of `custom_metrics` JSON sub-columns in BigQuery.

- **Live Documentation Fetching**: URLs of the authoritative guides, table references and UDF pages on [httparchive.org/docs](https://httparchive.org/docs), fetched with the agent's web-fetch tool. New pages are found through `https://httparchive.org/sitemap.xml`.
- **Live `custom_metrics` Discovery (10 MB minimum)**: Discover all active categories from BigQuery's metadata catalog:
  ```bash
  bq query --use_legacy_sql=false --format=prettyjson \
  "SELECT field_path, data_type 
  FROM \`httparchive.crawl.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS\` 
  WHERE table_name = 'pages' AND column_name = 'custom_metrics'"
  ```
- **Key Sampling from `sample_data`**: Sample real JSON property keys via `JSON_KEYS()` on `sample_data.pages_10k`.
- **Capacitor Storage Rules**: Why dot-notation (`custom_metrics.a11y`) reads one JSON sub-column, while selecting root `custom_metrics` reads all of them.

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
  3. **Trust the dry run, including `rank` filters**: estimates now reflect cluster pruning on `rank`, unlike older guidance.
  4. Projection hygiene (no `SELECT *`, dot-notate `custom_metrics`).
  5. Safe joins between `crawl.pages` and `crawl.requests` (repeating partition and clustering filters on both sides).
- **The Safe Prototyping Ladder** (dry-run at every step):
  `bq head` ($0.00) → `sample_data` (project columns) → Clustered slice (`rank <= 1000`, widened step by step) → Full run.

---

## Directory Structure

```text
httparchive-plugin/
├── plugin.json                              # Agent Plugins v1.0.0 manifest, read by Claude Code and Codex
├── mcp.json                                 # Tech Report MCP server (read by Codex)
├── .mcp.json                                # Identical copy (read by Claude Code)
├── .claude-plugin/
│   └── marketplace.json                     # Claude Code marketplace (this repo)
├── .agents/plugins/
│   └── marketplace.json                     # Codex marketplace (this repo)
├── skills/
│   ├── httparchive-docs-and-metrics/
│   │   └── SKILL.md                         # Documentation & custom metrics skill
│   └── httparchive-query-optimizer/
│       └── SKILL.md                         # Query optimization & schema skill
├── tests/
│   └── plugin.test.js                       # Specification & skill verification tests
├── scripts/
│   ├── validate-spec.js                     # Validates plugin against agent-plugins.org schemas
│   ├── verify-install.sh                    # Installs into a clean Claude Code or Codex home and checks it
│   └── schemas/1.0.0/                       # Canonical Agent Plugins JSON schemas
└── .github/workflows/
    └── ci.yml                               # GitHub Actions CI workflow
```

---

## Installation & Usage

The repository is its own marketplace for both Claude Code and Codex. Both read the root `plugin.json`, so it is the only manifest; don't add `.claude-plugin/plugin.json` or `.codex-plugin/plugin.json`, since each harness would prefer a different one.

### Claude Code

```bash
claude plugin marketplace add httparchive/httparchive-plugin
claude plugin install httparchive@httparchive
```

Or, inside a session: `/plugin marketplace add httparchive/httparchive-plugin`, then `/plugin install httparchive@httparchive`.

### Codex

```bash
codex plugin marketplace add httparchive/httparchive-plugin
codex plugin add httparchive@httparchive
```

### Other Agent Skills harnesses

Copy or symlink the folders under `skills/` into the harness's skills directory (for example `~/.agents/skills/`), and add the MCP server `https://cdn.httparchive.org/mcp` (Streamable HTTP, no auth) in the harness's MCP settings.

The BigQuery skills run the `bq` CLI, so the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) must be installed and authenticated against a project with BigQuery billing enabled. Docs pages are read with the agent's built-in web fetch, falling back to `curl` (`curl.exe` on Windows). The MCP tools need none of this.

Claude Code reads `.mcp.json` and Codex reads `mcp.json`, and neither accepts a custom path in the root `plugin.json`, so the two files must stay identical. Edit `mcp.json`, then run `cp mcp.json .mcp.json`; a test fails if they differ.

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

# Install into a clean Claude Code or Codex home and check the result
# (needs the claude / codex CLI and jq; no login required)
scripts/verify-install.sh claude
scripts/verify-install.sh codex
```

---

## License

[Apache 2.0](LICENSE) © HTTP Archive Team
