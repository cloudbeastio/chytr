#!/usr/bin/env bash
set -euo pipefail

# Resolve project root: prefer CWD when it looks like workspace (Cursor plugin runs with CWD = workspace)
ROOT=""
if [ -n "${PWD:-}" ] && { [ -f "${PWD}/.env.local" ] || [ -d "${PWD}/.git" ]; }; then
  ROOT="$PWD"
fi
if [ -z "$ROOT" ] && [ -n "${BASH_SOURCE[0]:-}" ]; then
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd)"
fi

# Load .env.local if API key not set
if [ -z "${CHYTR_API_KEY:-}" ]; then
  if [ -n "$ROOT" ] && [ -f "$ROOT/.env.local" ]; then
    set -a && source "$ROOT/.env.local" && set +a
  elif [ -f ".env.local" ]; then
    set -a && source ".env.local" && set +a
  fi
fi

CHYTR_URL="${CHYTR_URL:-${CHYTR_PUBLIC_URL:-}}"
CHYTR_API_KEY="${CHYTR_API_KEY:-}"
WORK_ORDER_ID="${WORK_ORDER_ID:-}"
CHYTR_AGENT_ID="${CHYTR_AGENT_ID:-}"

SOURCE_REPO="${CHYTR_REPO:-}"
if [ -z "$SOURCE_REPO" ] && command -v git >/dev/null 2>&1; then
  SOURCE_REPO=$(git -C "${ROOT:-.}" remote get-url origin 2>/dev/null || echo "")
fi

DEBUG_LOG=""
if [ -n "${CHYTR_HOOK_DEBUG:-}" ]; then
  DEBUG_LOG="${ROOT:-.}/.cursor/hooks/debug.log"
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] chytr-session url_set=$([ -n "$CHYTR_URL" ] && echo 1 || echo 0) key_set=$([ -n "$CHYTR_API_KEY" ] && echo 1 || echo 0) root=${ROOT:-none}" >> "$DEBUG_LOG" 2>/dev/null || true
fi

if [ -z "$CHYTR_URL" ] || [ -z "$CHYTR_API_KEY" ]; then
  [ -n "$DEBUG_LOG" ] && echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] chytr-session skip (no url or key)" >> "$DEBUG_LOG" 2>/dev/null || true
  exit 0
fi

RAW_PAYLOAD=$(cat)

BODY=$(cat <<EOF
{
  "event_type": "session_start",
  "chyt_id": $([ -n "$WORK_ORDER_ID" ] && echo "\"$WORK_ORDER_ID\"" || echo "null"),
  "agent_id": $([ -n "$CHYTR_AGENT_ID" ] && echo "\"$CHYTR_AGENT_ID\"" || echo "null"),
  "source_repo": $([ -n "$SOURCE_REPO" ] && echo "\"$SOURCE_REPO\"" || echo "null"),
  "raw_payload": $RAW_PAYLOAD
}
EOF
)

curl -sf --max-time 5 -X POST \
  -H "Authorization: Bearer $CHYTR_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$BODY" \
  "${CHYTR_URL%/}/api/v1/ingest" > /dev/null 2>&1 || true

KNOWLEDGE=""
if [ -n "$WORK_ORDER_ID" ]; then
  RESP=$(curl -sf --max-time 5 \
    -H "Authorization: Bearer $CHYTR_API_KEY" \
    "${CHYTR_URL%/}/api/v1/knowledge/query?chyt_id=$WORK_ORDER_ID" 2>/dev/null || echo "{}")
  if command -v jq >/dev/null 2>&1; then
    KNOWLEDGE=$(echo "$RESP" | jq -r '.formatted // ""')
  else
    KNOWLEDGE=$(echo "$RESP" | grep -o '"formatted":"[^"]*"' | sed 's/"formatted":"//;s/"$//' | sed 's/\\n/\n/g' || echo "")
  fi
fi

if [ -n "$KNOWLEDGE" ]; then
  cat <<EOF
{
  "additional_context": "Relevant knowledge from past agent runs:\n$KNOWLEDGE"
}
EOF
fi

exit 0
