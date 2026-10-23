#!/usr/bin/env bash
# Installs this repo as a plugin into a throwaway HOME and checks that the
# harness reports it enabled at the manifest version with every skill and the
# MCP server registered.
# Usage: scripts/verify-install.sh claude|codex
set -euo pipefail

harness="${1:?usage: verify-install.sh claude|codex}"
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
plugin="$(jq -r .name "$repo_root/plugin.json")"
version="$(jq -r .version "$repo_root/plugin.json")"
plugin_id="$plugin@$plugin"

HOME="$(mktemp -d)"
export HOME
trap 'rm -rf "$HOME"' EXIT

fail() { echo "❌ $*" >&2; exit 1; }

case "$harness" in
  claude)
    claude plugin validate --strict "$repo_root"
    claude plugin validate --strict "$repo_root/plugin.json"
    claude plugin marketplace add "$repo_root"
    claude plugin install "$plugin_id"
    entry="$(claude plugin list --json | jq --arg id "$plugin_id" '.[] | select(.id == $id)')"
    install_path="$(jq -r .installPath <<<"$entry")"
    # Run from $HOME so the repo's own .mcp.json is not picked up as a project server
    mcp_list="$(cd "$HOME" && claude mcp list 2>&1 | grep "^plugin:$plugin:" || true)"
    ;;
  codex)
    codex plugin marketplace add "$repo_root"
    codex plugin add "$plugin_id"
    entry="$(codex plugin list --json | jq --arg id "$plugin_id" '[.. | objects | select(.pluginId? == $id)][0]')"
    jq -e '.installed == true' <<<"$entry" >/dev/null || fail "codex does not report $plugin_id as installed"
    install_path="$HOME/.codex/plugins/cache/$plugin/$plugin/$version"
    mcp_list="$(cd "$HOME" && codex mcp list 2>&1)"
    ;;
  *)
    fail "unknown harness: $harness"
    ;;
esac

[[ -n "$entry" && "$entry" != "null" ]] || fail "$harness does not list $plugin_id"
jq -e '.enabled == true' <<<"$entry" >/dev/null || fail "$harness reports $plugin_id as disabled"
jq -e --arg v "$version" '.version == $v' <<<"$entry" >/dev/null \
  || fail "$harness installed version $(jq -r .version <<<"$entry"), expected $version"

for skill_dir in "$repo_root"/skills/*/; do
  skill="$(basename "$skill_dir")"
  [[ -f "$install_path/skills/$skill/SKILL.md" ]] || fail "$harness install is missing skills/$skill/SKILL.md"
done

mcp_url="$(jq -r '.mcpServers[].url' "$repo_root/mcp.json")"
grep -qF "$mcp_url" <<<"$mcp_list" || fail "$harness did not register the MCP server $mcp_url"

echo "✅ $harness installed $plugin_id $version with $(ls -d "$repo_root"/skills/*/ | wc -l | tr -d ' ') skills and MCP server $mcp_url"
