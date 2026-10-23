import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);

const pluginSchemaPath = path.join(__dirname, 'schemas/1.0.0/plugin.schema.json');
const mcpSchemaPath = path.join(__dirname, 'schemas/1.0.0/mcp.schema.json');

const pluginSchema = JSON.parse(fs.readFileSync(pluginSchemaPath, 'utf-8'));
const mcpSchema = JSON.parse(fs.readFileSync(mcpSchemaPath, 'utf-8'));

const validatePlugin = ajv.compile(pluginSchema);
const validateMcp = ajv.compile(mcpSchema);

let hasErrors = false;

// 1. Validate plugin.json
console.log('Validating plugin.json...');
const pluginData = JSON.parse(fs.readFileSync(path.join(rootDir, 'plugin.json'), 'utf-8'));
const pluginValid = validatePlugin(pluginData);
if (!pluginValid) {
  console.error('❌ plugin.json validation failed:', validatePlugin.errors);
  hasErrors = true;
} else {
  console.log('✅ plugin.json is conformant with agent-plugins.org v1.0.0 spec.');
}

// 2. Validate mcp.json (optional for pure skills plugins)
const mcpPath = path.join(rootDir, 'mcp.json');
if (fs.existsSync(mcpPath)) {
  console.log('Validating mcp.json...');
  const mcpData = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
  const mcpValid = validateMcp(mcpData);
  if (!mcpValid) {
    console.error('❌ mcp.json validation failed:', validateMcp.errors);
    hasErrors = true;
  } else {
    console.log('✅ mcp.json is conformant with agent-plugins.org v1.0.0 spec.');
  }
} else {
  console.log('ℹ️ No mcp.json present — pure skills plugin configuration.');
}

// 3. Validate skills/
console.log('Validating skills/...');
const skillsDir = path.join(rootDir, 'skills');
if (!fs.existsSync(skillsDir) || !fs.statSync(skillsDir).isDirectory()) {
  console.error('❌ skills/ directory is missing!');
  hasErrors = true;
} else {
  const skillDirs = fs.readdirSync(skillsDir).filter(f => fs.statSync(path.join(skillsDir, f)).isDirectory());
  if (skillDirs.length === 0) {
    console.error('❌ No skills found in skills/');
    hasErrors = true;
  }

  for (const skill of skillDirs) {
    const skillMdPath = path.join(skillsDir, skill, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) {
      console.error(`❌ Skill '${skill}' is missing SKILL.md`);
      hasErrors = true;
      continue;
    }

    const content = fs.readFileSync(skillMdPath, 'utf-8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      console.error(`❌ Skill '${skill}/SKILL.md' is missing YAML frontmatter (---)`);
      hasErrors = true;
      continue;
    }

    const frontmatter = frontmatterMatch[1];
    const hasName = /name:\s*([a-zA-Z0-9_-]+)/.test(frontmatter);
    const hasDescription = /description:\s*(.+)/.test(frontmatter);

    if (!hasName || !hasDescription) {
      console.error(`❌ Skill '${skill}/SKILL.md' frontmatter must have 'name' and 'description'`);
      hasErrors = true;
    } else {
      console.log(`✅ Skill '${skill}' is valid.`);
    }
  }
}

if (hasErrors) {
  process.exit(1);
} else {
  console.log('\n🎉 All Agent Plugin specification checks PASSED!');
}
