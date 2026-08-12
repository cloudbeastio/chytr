#!/usr/bin/env bash
set -euo pipefail

# chytr-claude-session.sh — SessionStart hook for Claude Code.
# Logs session_start to ${CHYTR_URL}/api/v1/ingest, and injects knowledge from past
# agent runs as additionalContext when a chyt id resolves.
# ENFORCE MODE (opt-in — CHYTR_ENFORCE=1 or $ROOT/.chytr/enforce exists): if no chyt
# id resolves, auto-creates a logging-only chyt (source=local, never launched) via
# POST /api/v1/chyts and writes its id to $ROOT/.chytr/current_chyt.
# Never blocks SessionStart (the PreToolUse gate is what blocks); always exits 0.

ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"

# Load .env.local if API key not set
if [ -z "${CHYTR_API_KEY:-}" ]; then
  if [ -f "$ROOT/.env.local" ]; then
    set -a && source "$ROOT/.env.local" && set +a
  elif [ -f ".env.local" ]; then
    set -a && source ".env.local" && set +a
  fi
fi

CHYTR_URL="${CHYTR_URL:-${CHYTR_PUBLIC_URL:-}}"
CHYTR_API_KEY="${CHYTR_API_KEY:-}"
CHYTR_AGENT_ID="${CHYTR_AGENT_ID:-}"

# Resolve chyt id: CHYT_ID > WORK_ORDER_ID (legacy) > .chytr/current_chyt
CHYT_ID="${CHYT_ID:-${WORK_ORDER_ID:-}}"
if [ -z "$CHYT_ID" ] && [ -f "$ROOT/.chytr/current_chyt" ]; then
  CHYT_ID="$(tr -d '[:space:]' < "$ROOT/.chytr/current_chyt" 2>/dev/null)" || CHYT_ID=""
fi

SOURCE_REPO="${CHYTR_REPO:-}"
if [ -z "$SOURCE_REPO" ] && command -v git >/dev/null 2>&1; then
  SOURCE_REPO=$(git -C "$ROOT" remote get-url origin 2>/dev/null || echo "")
fi

RAW_PAYLOAD="$(cat 2>/dev/null || echo "{}")"

if [ -z "$CHYTR_URL" ] || [ -z "$CHYTR_API_KEY" ]; then
  exit 0
fi

HAS_JQ=0
command -v jq >/dev/null 2>&1 && HAS_JQ=1

if [ "$HAS_JQ" = "1" ]; then
  if ! printf '%s' "$RAW_PAYLOAD" | jq -e . >/dev/null 2>&1; then
    RAW_PAYLOAD="{}"
  fi
elif [ -z "$RAW_PAYLOAD" ]; then
  RAW_PAYLOAD="{}"
fi

# shellcheck source=chytr-correlation.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]:-.}")" && pwd)/chytr-correlation.sh"

SESSION_ID=""
if [ "$HAS_JQ" = "1" ]; then
  SESSION_ID=$(printf '%s' "$RAW_PAYLOAD" | jq -r '.session_id // ""' 2>/dev/null || echo "")
fi

# Enforce mode: auto-create a logging-only chyt when none resolves.
# source=local never launches an agent — it exists purely to scope this session's logs.
ENFORCE=0
if [ "${CHYTR_ENFORCE:-}" = "1" ] || [ -f "$ROOT/.chytr/enforce" ]; then
  ENFORCE=1
fi

if [ "$ENFORCE" = "1" ] && [ -z "$CHYT_ID" ] && [ "$HAS_JQ" = "1" ]; then
  REPO_LABEL="${SOURCE_REPO:-$ROOT}"
  CREATE_BODY=$(jq -n \
    --arg objective "Claude Code session ${SESSION_ID:-unknown} in ${REPO_LABEL}" \
    --arg session_id "$SESSION_ID" \
    '{objective: $objective, source: "local", metadata: {created_by: "claude-hooks-skill", session_id: $session_id}}' \
    2>/dev/null || echo "")
  if [ -n "$CREATE_BODY" ]; then
    CREATE_RESP=$(curl -sf --max-time 5 -X POST \
      -H "Authorization: Bearer $CHYTR_API_KEY" \
      -H "Content-Type: application/json" \
      -d "$CREATE_BODY" \
      "${CHYTR_URL%/}/api/v1/chyts" 2>/dev/null || echo "{}")
    NEW_ID=$(printf '%s' "$CREATE_RESP" | jq -r '.chyt_id // ""' 2>/dev/null || echo "")
    if [ -n "$NEW_ID" ]; then
      CHYT_ID="$NEW_ID"
      mkdir -p "$ROOT/.chytr" 2>/dev/null || true
      printf '%s' "$CHYT_ID" > "$ROOT/.chytr/current_chyt" 2>/dev/null || true
    fi
  fi
fi

BODY=$(cat <<EOF
{
  "event_type": "session_start",
  "chyt_id": $([ -n "$CHYT_ID" ] && echo "\"$CHYT_ID\"" || echo "null"),
  "agent_id": $([ -n "$CHYTR_AGENT_ID" ] && echo "\"$CHYTR_AGENT_ID\"" || echo "null"),
  "source_repo": $([ -n "$SOURCE_REPO" ] && echo "\"$SOURCE_REPO\"" || echo "null"),
  $CORRELATION_JSON_FIELDS,
  "raw_payload": $RAW_PAYLOAD
}
EOF
)

curl -sf --max-time 5 -X POST \
  -H "Authorization: Bearer $CHYTR_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$BODY" \
  "${CHYTR_URL%/}/api/v1/ingest" > /dev/null 2>&1 || true

# Knowledge injection: surface what past agent runs learned on this chyt
KNOWLEDGE=""
if [ -n "$CHYT_ID" ]; then
  RESP=$(curl -sf --max-time 5 \
    -H "Authorization: Bearer $CHYTR_API_KEY" \
    "${CHYTR_URL%/}/api/v1/knowledge/query?chyt_id=$CHYT_ID" 2>/dev/null || echo "{}")
  if [ "$HAS_JQ" = "1" ]; then
    KNOWLEDGE=$(printf '%s' "$RESP" | jq -r '.formatted // ""' 2>/dev/null || echo "")
  else
    KNOWLEDGE=$(printf '%s' "$RESP" | grep -o '"formatted":"[^"]*"' | sed 's/"formatted":"//;s/"$//' | sed 's/\\n/\n/g' || echo "")
  fi
fi

if [ -n "$KNOWLEDGE" ] && [ "$HAS_JQ" = "1" ]; then
  jq -n --arg ctx "Relevant knowledge from past agent runs:
$KNOWLEDGE" \
    '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $ctx}}' \
    2>/dev/null || true
fi

exit 0
