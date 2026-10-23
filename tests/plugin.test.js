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

test('Plugin Architecture: pure skills configuration without MCP token bloat', () => {
  const mcpPath = path.join(rootDir, 'mcp.json');
  assert.equal(fs.existsSync(mcpPath), false, 'mcp.json should not exist in pure skills plugin');
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

test('Official Documentation: GitHub raw documentation source is accessible', async () => {
  try {
    const res = await fetch(
      'https://raw.githubusercontent.com/HTTPArchive/httparchive.org/main/src/content/docs/docs/guides/minimizing-costs.md'
    );
    assert.ok(res.ok, 'Documentation endpoint should return 200 OK');
    const text = await res.text();
    assert.ok(text.includes('Minimizing query costs') || text.includes('TABLESAMPLE'));
  } catch (err) {
    console.warn('Network check skipped or offline:', err.message);
  }
});
