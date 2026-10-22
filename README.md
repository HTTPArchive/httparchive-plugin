# HTTP Archive Agent Plugin

[![CI](https://github.com/httparchive/httparchive-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/httparchive/httparchive-plugin/actions/workflows/ci.yml)
[![Agent Plugins](https://img.shields.io/badge/Agent_Plugins-v1.0.0-blue.svg)](https://agent-plugins.org/)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

An official agent plugin conforming to the [Agent Plugins Specification (v1.0.0)](https://agent-plugins.org/) for querying the [HTTP Archive](https://httparchive.org) dataset in Google Cloud BigQuery.

Instead of bundling static catalogs that become stale, this plugin uses **BigQuery and official HTTP Archive documentation as live sources of truth**.

---

## Capabilities

### 1. Model Context Protocol (MCP) Tools
The plugin includes a stdio MCP server exposing 5 tools for BigQuery live introspection and cost validation:

| Tool | Source of Truth | Description | Cost |
|---|---|---|---|
| `get_table_schema` | **Live BigQuery API + Docs** | Queries BigQuery table metadata directly for column types, partitioning (`date`), clustering hierarchy, and links to official documentation. | $0.00 |
| `list_custom_metrics` | **Live BigQuery Schema & Data** | Introspects the live `custom_metrics` RECORD in BigQuery `crawl.pages`, and samples real JSON property keys via `sample_data.pages_10k` Tabledata API. | $0.00 |
| `preview_table_rows` | **Live BigQuery Tabledata API** | Previews actual live rows at zero cost without executing query jobs or scanning bytes. | $0.00 |
| `analyze_query_cost` | **Live BigQuery Dry-Run API** | Runs a live BigQuery dry-run (`dryRun: true`) returning exact bytes processed, estimated USD cost, and applies domain cost rules (partitioning, clustering order, `SELECT *` traps, `LIMIT` traps). | $0.00 |
| `get_documentation` | **HTTP Archive Docs Source** | Dynamically fetches official documentation guides (`minimizing-costs`, `getting-started`, `release-cycle`), table reference docs (`pages`, `requests`), struct reference docs (`custom-metrics`, `technology`), and SQL function docs (`capo`, `get_origin`). | $0.00 |

### 2. Agent Skills
Located under `skills/` adhering to the [Agent Skills specification](https://agentskills.io/):

- **[`httparchive-table-schema`](skills/httparchive-table-schema/SKILL.md)**:
  - Guides agents to use `get_table_schema`, `list_custom_metrics`, and `get_documentation` to discover live structures rather than guessing.
  - Unnesting patterns for `technologies` (`ARRAY<STRUCT>`) and `features` (`ARRAY<STRUCT>`).
  - Structured `RECORD` column storage for `custom_metrics` vs internal `JSON` path extraction.
  - Safe join patterns between pages and requests.
- **[`httparchive-cost-optimization`](skills/httparchive-cost-optimization/SKILL.md)**:
  - Grounded in the official [Minimizing Costs Guide](https://httparchive.org/docs/guides/minimizing-costs/).
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
│   ├── bigquery.js                          # Live BigQuery client factory
│   ├── docs.js                              # Dynamic HTTP Archive documentation loader
│   └── tools/
│       ├── get_table_schema.js              # Live BQ metadata + docs loader
│       ├── list_custom_metrics.js           # Live BQ custom_metrics schema & sampling
│       ├── preview_table_rows.js            # Live BQ Tabledata preview ($0.00)
│       ├── analyze_query_cost.js            # Live BQ dry-run & domain cost linter
│       └── get_documentation.js             # Live docs reader
├── skills/
│   ├── httparchive-table-schema/
│   │   └── SKILL.md                         # Live schema exploration guide
│   └── httparchive-cost-optimization/
│       └── SKILL.md                         # Cost minimization playbook
├── tests/
│   ├── cost_linter.test.js                  # Unit tests for cost linting rules
│   └── mcp_tools.test.js                    # Unit tests for MCP server tools
├── scripts/
│   ├── validate-spec.js                     # Validates plugin against agent-plugins.org schemas
│   └── schemas/1.0.0/                       # Canonical Agent Plugins JSON schemas
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
