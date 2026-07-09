#!/usr/bin/env bash
set -uo pipefail

# chytr-claude-gate.sh — opt-in PreToolUse enforcement gate for Claude Code.
# Active ONLY when CHYTR_ENFORCE=1 or $ROOT/.chytr/enforce exists; otherwise it exits 0
# immediately (never gates by default). When active, it denies mutating tool calls unless
# a chyt id resolves (CHYT_ID / WORK_ORDER_ID / $ROOT/.chytr/current_chyt).
#
# Fail-open: enforcement must never brick a session when chytr is down or tooling is
# missing — any error reading state means ALLOW (exit 0). Note: set -e is deliberately
# NOT used here so an unexpected failure can't turn into an implicit deny/non-zero exit.

ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"

# Consume stdin (the PreToolUse JSON) so we never block the pipe
cat > /dev/null 2>&1 || true

# Not in enforce mode → allow everything, immediately
if [ "${CHYTR_ENFORCE:-}" != "1" ] && [ ! -f "$ROOT/.chytr/enforce" ]; then
  exit 0
fi

# Load .env.local if API key not set (so CHYTR_URL is available for the deny message)
if [ -z "${CHYTR_API_KEY:-}" ]; then
  if [ -f "$ROOT/.env.local" ]; then
    set -a && source "$ROOT/.env.local" 2>/dev/null && set +a
  elif [ -f ".env.local" ]; then
    set -a && source ".env.local" 2>/dev/null && set +a
  fi
fi

CHYTR_URL="${CHYTR_URL:-${CHYTR_PUBLIC_URL:-}}"

# Resolve chyt id: CHYT_ID > WORK_ORDER_ID (legacy) > .chytr/current_chyt
CHYT_ID="${CHYT_ID:-${WORK_ORDER_ID:-}}"
if [ -z "$CHYT_ID" ] && [ -f "$ROOT/.chytr/current_chyt" ]; then
  CHYT_ID="$(tr -d '[:space:]' < "$ROOT/.chytr/current_chyt" 2>/dev/null || echo "")"
fi

# A chyt is active → allow silently
if [ -n "$CHYT_ID" ]; then
  exit 0
fi

# Enforce mode, no active chyt → deny with instructions
URL_HINT="${CHYTR_URL:-<your CHYTR_URL>}"
REASON="chytr enforce mode: no active chyt for this session. Create one: POST ${URL_HINT%/}/api/v1/chyts with {\"objective\":\"...\",\"source\":\"local\"} and write the returned chyt_id to .chytr/current_chyt — or unset enforce mode (remove .chytr/enforce / unset CHYTR_ENFORCE)."

if command -v jq >/dev/null 2>&1; then
  jq -n --arg reason "$REASON" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}' \
    2>/dev/null && exit 0
fi

# Fallback without jq (the reason string above contains no characters needing escaping
# beyond the quotes we escape inline)
cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "chytr enforce mode: no active chyt for this session. Create one via POST ${URL_HINT%/}/api/v1/chyts (source: local) and write the returned chyt_id to .chytr/current_chyt — or unset enforce mode."
  }
}
EOF

exit 0
