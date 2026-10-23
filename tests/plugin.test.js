import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

test('Plugin Manifest (plugin.json): conforms to agent-plugins.org v1.0.0', () => {
  const pluginPath = path.join(rootDir, 'plugin.json');
  assert.ok(fs.existsSync(pluginPath), 'plugin.json should exist');

  const plugin = JSON.parse(fs.readFileSync(pluginPath, 'utf-8'));
  assert.equal(plugin.name, 'httparchive');
  assert.ok(plugin.version);
  assert.ok(plugin.description);
  assert.equal(plugin.license, 'Apache-2.0');
  assert.ok(Array.isArray(plugin.keywords));
  assert.ok(plugin.keywords.includes('httparchive'));
  assert.ok(plugin.keywords.includes('skills'));
});

test('MCP: Tech Report server is declared identically for Codex and Claude Code', () => {
  // Codex reads mcp.json (Agent Plugins spec) and Claude Code reads .mcp.json;
  // neither honors a custom path in the root plugin.json, and a symlink breaks
  // on Windows checkouts, so .mcp.json is a plain copy.
  const codex = fs.readFileSync(path.join(rootDir, 'mcp.json'), 'utf-8');
  const claude = fs.readFileSync(path.join(rootDir, '.mcp.json'), 'utf-8');
  assert.equal(claude, codex, '.mcp.json must be an exact copy of mcp.json');

  const { mcpServers } = JSON.parse(codex);
  assert.equal(mcpServers.httparchive?.type, 'streamable-http');
  assert.equal(mcpServers.httparchive?.url, 'https://cdn.httparchive.org/mcp');
});

test('Skills: both docs-and-metrics and query-optimizer skills are defined with valid frontmatter', () => {
  const skillsDir = path.join(rootDir, 'skills');
  const requiredSkills = ['httparchive-docs-and-metrics', 'httparchive-query-optimizer'];

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

test('Harness marketplaces: Claude Code and Codex install plugin.json from the repo root', () => {
  const read = (rel) => JSON.parse(fs.readFileSync(path.join(rootDir, rel), 'utf-8'));
  const { name } = read('plugin.json');

  // Both harnesses read the root plugin.json, but a per-harness manifest takes
  // precedence in Claude Code and loses to the root one in Codex. Keep one.
  for (const rel of ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json']) {
    assert.equal(fs.existsSync(path.join(rootDir, rel)), false, `${rel} would shadow or drift from plugin.json`);
  }

  const claudeMarketplace = read('.claude-plugin/marketplace.json');
  const codexMarketplace = read('.agents/plugins/marketplace.json');
  assert.ok(claudeMarketplace.plugins.some(p => p.name === name && p.source === './'));
  assert.ok(codexMarketplace.plugins.some(p => p.name === name && p.source?.path === './'));
});

test('Official Documentation: every httparchive.org URL referenced by skills resolves', async (t) => {
  const skillsDir = path.join(rootDir, 'skills');
  const urls = new Set();
  for (const skill of fs.readdirSync(skillsDir)) {
    const content = fs.readFileSync(path.join(skillsDir, skill, 'SKILL.md'), 'utf-8');
    for (const [url] of content.matchAll(/https:\/\/httparchive\.org\/[\w/.-]*[\w/]/g)) urls.add(url);
  }
  assert.ok(urls.size > 0, 'expected httparchive.org URLs in the skills');

  try {
    await fetch('https://httparchive.org/', { method: 'HEAD' });
  } catch (err) {
    t.skip(`offline: ${err.message}`);
    return;
  }

  for (const url of urls) {
    let res = await fetch(url, { method: 'HEAD' });
    // The skill tells agents to fall back to the HTML page when a `.md` URL 404s.
    if (res.status === 404 && url.endsWith('.md')) res = await fetch(url.slice(0, -3), { method: 'HEAD' });
    assert.ok(res.ok, `${url} returned ${res.status}`);
  }
});
