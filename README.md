# HTTP Archive Agent Plugin

[![CI](https://github.com/httparchive/httparchive-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/httparchive/httparchive-plugin/actions/workflows/ci.yml)
[![Agent Plugins](https://img.shields.io/badge/Agent_Plugins-v1.0.0-blue.svg)](https://agent-plugins.org/)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

An official agent plugin conforming to the [Agent Plugins Specification (v1.0.0)](https://agent-plugins.org/) for querying the [HTTP Archive](https://httparchive.org) dataset in Google Cloud BigQuery.

Equips AI agents with deep knowledge of HTTP Archive table structures, nested records, and custom metrics, while strictly enforcing cost optimization rules to eliminate multi-terabyte query scan waste.

---

## Capabilities

### 1. Model Context Protocol (MCP) Tools
The plugin includes a stdio MCP server exposing 5 tools for BigQuery introspection and cost validation:

| Tool | Description | Cost |
|---|---|---|
| `get_table_schema` | Returns column types, partition keys, clustering hierarchy, and domain hints for `crawl.pages`, `crawl.requests`, `sample_data.pages_10k`, etc. | $0.00 |
| `list_custom_metrics` | Discovers and inspects the 20 `custom_metrics` categories (`a11y`, `seo`, `markup`, etc.), known JSON paths, and query patterns. | $0.00 |
| `preview_table_rows` | Previews actual live rows using BigQuery's Tabledata API without executing queries or scanning data. | $0.00 |
| `analyze_query_cost` | Performs a live BigQuery dry-run (`dryRun: true`) returning exact bytes processed, estimated USD cost, and applies HTTP Archive cost linting rules (partition checks, clustering hierarchy, `SELECT *` traps, `LIMIT` traps). | $0.00 |
| `check_precomputed_reports` | Verifies whether requested metrics (CWV, page weight, adoption) are already available in pre-aggregated tables (`httparchive.reports.*`) or Tech Report APIs before running expensive raw crawl queries. | $0.00 |

### 2. Agent Skills
Located under `skills/` adhering to the [Agent Skills specification](https://agentskills.io/):

- **[`httparchive-table-schema`](skills/httparchive-table-schema/SKILL.md)**:
  - Deep schema reference for `crawl.pages`, `crawl.requests`, `sample_data`, and `reports`.
  - Nested unnesting patterns for `technologies` (`ARRAY<STRUCT>`) and `features` (`ARRAY<STRUCT>`).
  - Structured `RECORD` column storage for `custom_metrics` vs internal `JSON` path extraction.
  - Safe join patterns between pages and requests.
- **[`httparchive-cost-optimization`](skills/httparchive-cost-optimization/SKILL.md)**:
  - The 5 core optimization rules (mandatory `date` partition, clustering hierarchy, column projection hygiene, the `LIMIT` trap).
  - Explains the BigQuery dry-run estimation limitation on clustered `rank` filters.
  - The 5-step safe prototyping progression (`preview_table_rows` → `sample_data.pages_10k` → `TABLESAMPLE` → clustered slice → production run).

---

## Directory Structure

```text
httparchive-plugin/
├── plugin.json                              # Agent Plugins v1.0.0 root manifest
├── mcp.json                                 # MCP stdio server configuration
├── bin/
│   └── server.js                            # MCP server CLI executable
├── src/
│   ├── index.js                             # McpServer initialization & tool registrations
│   ├── bigquery.js                          # BigQuery client factory
│   ├── data/
│   │   ├── custom_metrics_catalog.js        # 20 custom metrics categories & query syntax
│   │   └── reports_catalog.js               # Pre-computed reports & Tech Report mappings
│   └── tools/
│       ├── get_table_schema.js
│       ├── list_custom_metrics.js
│       ├── preview_table_rows.js
│       ├── analyze_query_cost.js            # Live dry-run & domain cost linter
│       └── check_precomputed_reports.js
├── skills/
│   ├── httparchive-table-schema/
│   │   └── SKILL.md                         # Schema & unnesting guide
│   └── httparchive-cost-optimization/
│       └── SKILL.md                         # Cost minimization playbook
├── tests/
│   ├── cost_linter.test.js                  # Unit tests for cost linting rules
│   └── mcp_tools.test.js                    # Unit tests for MCP server tools
├── scripts/
│   └── validate-spec.js                     # Validates plugin against agent-plugins.org schemas
└── .github/workflows/
    └── ci.yml                               # CI matrix (Node 20, 22, 24)
```

---

## Installation & Usage

### Prerequisites
1. **Node.js**: >= 20.0.0
2. **Google Cloud Credentials**: Active Application Default Credentials (ADC) with access to BigQuery:
   ```bash
   gcloud auth application-default login
   ```

### Running with AI Agent Clients

#### In Any Agent Plugins Compatible Client (Cursor, Claude Desktop, Antigravity)
Add the plugin directory to your agent's plugin discovery path or configure `mcp.json`:

```json
{
  "mcpServers": {
    "httparchive": {
      "command": "node",
      "args": ["/path/to/httparchive-plugin/bin/server.js"],
      "env": {
        "BIGQUERY_PROJECT": "httparchive",
        "BIGQUERY_LOCATION": "US"
      }
    }
  }
}
```

---

## Development & Testing

```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Run Agent Plugins specification validator
npm run validate:spec

# Run linter
npm run lint
```

---

## License

[Apache 2.0](LICENSE) © HTTP Archive Team
