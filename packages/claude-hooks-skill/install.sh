#!/usr/bin/env bash
set -euo pipefail

REPO="https://raw.githubusercontent.com/cloudbeastio/chytr/main"
PKG="packages/claude-hooks-skill"

# Args: optional target dir + optional --enforce flag (any position)
TARGET_DIR="."
ENFORCE=0
for ARG in "$@"; do
  case "$ARG" in
    --enforce) ENFORCE=1 ;;
    *) TARGET_DIR="$ARG" ;;
  esac
done

cd "$TARGET_DIR" || { echo "Error: cannot cd to $TARGET_DIR"; exit 1; }

echo "Installing chytr Claude Code hooks into $(pwd)/.claude/ ..."

mkdir -p ".claude/hooks"

# Download hook scripts
for SCRIPT in chytr-claude-log.sh chytr-claude-session.sh chytr-claude-stop.sh chytr-claude-gate.sh; do
  curl -fsSL "$REPO/$PKG/.claude/hooks/$SCRIPT" \
    -o ".claude/hooks/$SCRIPT"
  chmod +x ".claude/hooks/$SCRIPT"
done

# Settings: NON-DESTRUCTIVE — many repos already have .claude/settings.json.
TEMPLATE="$(mktemp)"
trap 'rm -f "$TEMPLATE"' EXIT
curl -fsSL "$REPO/$PKG/.claude/settings.json" -o "$TEMPLATE"

SETTINGS=".claude/settings.json"

if [ ! -f "$SETTINGS" ]; then
  # No existing settings — install the template as-is
  cp "$TEMPLATE" "$SETTINGS"
  echo "Created $SETTINGS with chytr hooks."
elif grep -q "chytr-claude-session.sh" "$SETTINGS" 2>/dev/null; then
  # Idempotency guard: hooks already wired — don't append duplicates
  echo "chytr hooks already installed in $SETTINGS — skipping settings merge (scripts refreshed)."
elif command -v jq >/dev/null 2>&1; then
  # Deep-merge: for each event key in the template, APPEND the template's hook
  # entries to any existing array. Everything else in the existing file is preserved.
  MERGED="$(mktemp)"
  if jq -s '.[0] * {hooks: (((.[0].hooks) // {}) as $e | ((.[1].hooks) // {}) as $t | ($e | keys) + ($t | keys) | unique | map({key: ., value: (($e[.] // []) + ($t[.] // []))}) | from_entries)}' \
    "$SETTINGS" "$TEMPLATE" > "$MERGED" && jq -e . "$MERGED" > /dev/null 2>&1; then
    mv "$MERGED" "$SETTINGS"
    echo "Merged chytr hooks into existing $SETTINGS (existing hooks preserved)."
  else
    rm -f "$MERGED"
    cp "$TEMPLATE" ".claude/settings.chytr.json"
    echo "WARNING: could not merge into $SETTINGS (is it valid JSON?)."
    echo "Wrote the chytr hook config to .claude/settings.chytr.json — merge its \"hooks\" block into $SETTINGS manually."
  fi
else
  # Existing settings but no jq — never overwrite; hand the user the template
  cp "$TEMPLATE" ".claude/settings.chytr.json"
  echo "NOTE: $SETTINGS already exists and jq is not available to merge safely."
  echo "Wrote the chytr hook config to .claude/settings.chytr.json — merge its \"hooks\" block into $SETTINGS manually."
fi

if [ "$ENFORCE" = "1" ]; then
  mkdir -p ".chytr"
  touch ".chytr/enforce"
  echo ""
  echo "Enforce mode enabled (.chytr/enforce created):"
  echo "  - SessionStart auto-creates a logging-only chyt (source=local) when none is active"
  echo "    and pins it to .chytr/current_chyt."
  echo "  - PreToolUse DENIES mutating tools (Bash/Edit/Write/MCP) until a chyt id resolves."
  echo "  - Fail-open: if chytr is unreachable, tools are allowed — enforcement never bricks a session."
  echo "  Disable any time: rm .chytr/enforce"
fi

echo ""
echo "chytr Claude Code hooks installed successfully!"
echo ""
echo "To stream logs to your chytr app, set these env vars (shell, .env.local, or CI env):"
echo ""
echo "  CHYTR_URL          App base URL (e.g. https://app.chytr.ai or http://localhost:3000)"
echo "  CHYTR_API_KEY      API key from chytr Settings -> API Keys (Bearer auth for /api/v1/ingest)"
echo "  CHYT_ID            Optional; scopes events to a chyt (legacy WORK_ORDER_ID also honored)"
echo "  CHYTR_REPO         Optional; override repo URL (auto-detected from git remote if unset)"
echo "  CHYTR_ENFORCE=1    Optional; gate mode — deny mutating tools without an active chyt"
echo ""
echo "Events POST to \${CHYTR_URL}/api/v1/ingest. If URL/key unset, hooks exit silently."
echo "Add .chytr/ to your .gitignore — it holds per-session state (current_chyt, enforce)."
