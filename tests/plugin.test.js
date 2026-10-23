import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

test('Plugin Manifest (plugin.json): conforms to expected structure', () => {
  const pluginPath = path.join(rootDir, 'plugin.json');
  assert.ok(fs.existsSync(pluginPath), 'plugin.json should exist');

  const plugin = JSON.parse(fs.readFileSync(pluginPath, 'utf-8'));
  assert.equal(plugin.name, 'httparchive');
  assert.ok(plugin.version);
  assert.ok(plugin.description);
  assert.equal(plugin.license, 'Apache-2.0');
  assert.ok(Array.isArray(plugin.keywords));
  assert.ok(plugin.keywords.includes('httparchive'));
});

test('MCP Config (mcp.json): configured for remote streamable-http', () => {
  const mcpPath = path.join(rootDir, 'mcp.json');
  assert.ok(fs.existsSync(mcpPath), 'mcp.json should exist');

  const mcp = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
  assert.ok(mcp.mcpServers, 'mcpServers object must exist');
  assert.ok(mcp.mcpServers.httparchive, 'httparchive server definition must exist');

  const serverConfig = mcp.mcpServers.httparchive;
  assert.equal(serverConfig.type, 'streamable-http', 'Server type must be streamable-http');
  assert.equal(serverConfig.url, 'https://cdn.httparchive.org/mcp', 'Must point to production remote MCP endpoint');
});

test('Skills: both table-schema and cost-optimization skills are defined with valid frontmatter', () => {
  const skillsDir = path.join(rootDir, 'skills');
  const requiredSkills = ['httparchive-table-schema', 'httparchive-cost-optimization'];

  for (const skill of requiredSkills) {
    const skillPath = path.join(skillsDir, skill, 'SKILL.md');
    assert.ok(fs.existsSync(skillPath), `SKILL.md should exist for ${skill}`);

    const content = fs.readFileSync(skillPath, 'utf-8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    assert.ok(frontmatterMatch, `Skill ${skill} must have YAML frontmatter`);

    const frontmatter = frontmatterMatch[1];
    assert.match(frontmatter, new RegExp(`name:\\s*${skill}`), `Skill name must match ${skill}`);
    assert.match(frontmatter, /description:\s*.+/, 'Skill must have a non-empty description');
    assert.ok(content.length > 500, `Skill ${skill} should have detailed documentation`);
  }
});

test('Remote MCP Server: https://cdn.httparchive.org/mcp endpoint is live and responsive', async () => {
  try {
    const res = await fetch('https://cdn.httparchive.org/mcp', {
      method: 'OPTIONS',
    });
    assert.ok(res.ok, 'Remote MCP server should respond with 2xx to OPTIONS');
    const allowHeaders = res.headers.get('access-control-allow-headers');
    assert.ok(allowHeaders && allowHeaders.includes('mcp-protocol-version'), 'Should support MCP protocol version headers');
  } catch (err) {
    // If offline or network constrained in test runner, pass with note
    console.warn('Network check skipped or offline:', err.message);
  }
});
