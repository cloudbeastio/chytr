#!/usr/bin/env bash
set -euo pipefail

# Resolve project root: script-relative then CWD (Cursor may run with CWD = workspace)
ROOT=""
if [ -n "${BASH_SOURCE[0]:-}" ]; then
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd)"
fi
[ -z "$ROOT" ] && [ -n "${PWD:-}" ] && [ -f "${PWD}/.env.local" ] && ROOT="$PWD"

# Load .env.local if API key not set
if [ -z "${CHYTR_API_KEY:-}" ]; then
  if [ -n "$ROOT" ] && [ -f "$ROOT/.env.local" ]; then
    set -a && source "$ROOT/.env.local" && set +a
  elif [ -f ".env.local" ]; then
    set -a && source ".env.local" && set +a
  fi
fi

EVENT_TYPE="${1:-unknown}"
CHYTR_URL="${CHYTR_URL:-${CHYTR_PUBLIC_URL:-}}"
CHYTR_API_KEY="${CHYTR_API_KEY:-}"
WORK_ORDER_ID="${WORK_ORDER_ID:-}"
CHYTR_AGENT_ID="${CHYTR_AGENT_ID:-}"

SOURCE_REPO="${CHYTR_REPO:-}"
if [ -z "$SOURCE_REPO" ] && command -v git >/dev/null 2>&1; then
  SOURCE_REPO=$(git -C "${ROOT:-.}" remote get-url origin 2>/dev/null || echo "")
fi

# Sentinel: always log that hook ran (so we can see if Cursor invokes it)
SENTINEL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-.}")" 2>/dev/null && pwd)"
SENTINEL="${SENTINEL_DIR:-.}/last-hook.log"
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) event=$EVENT_TYPE url_set=$([ -n "$CHYTR_URL" ] && echo 1 || echo 0) key_set=$([ -n "$CHYTR_API_KEY" ] && echo 1 || echo 0) root=${ROOT:-none}" >> "$SENTINEL" 2>/dev/null || true

DEBUG_LOG=""
if [ -n "${CHYTR_HOOK_DEBUG:-}" ]; then
  DEBUG_LOG="${ROOT:-.}/.cursor/hooks/debug.log"
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] chytr-log event=$EVENT_TYPE url_set=$([ -n "$CHYTR_URL" ] && echo 1 || echo 0) key_set=$([ -n "$CHYTR_API_KEY" ] && echo 1 || echo 0) root=${ROOT:-none}" >> "$DEBUG_LOG" 2>/dev/null || true
fi

if [ -z "$CHYTR_URL" ] || [ -z "$CHYTR_API_KEY" ]; then
  [ -n "$DEBUG_LOG" ] && echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] chytr-log skip (no url or key)" >> "$DEBUG_LOG" 2>/dev/null || true
  exit 0
fi

RAW_PAYLOAD=$(cat)

# shellcheck source=chytr-correlation.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]:-.}")" && pwd)/chytr-correlation.sh"

BODY=$(cat <<EOF
{
  "event_type": "$EVENT_TYPE",
  "chyt_id": $([ -n "$WORK_ORDER_ID" ] && echo "\"$WORK_ORDER_ID\"" || echo "null"),
  "agent_id": $([ -n "$CHYTR_AGENT_ID" ] && echo "\"$CHYTR_AGENT_ID\"" || echo "null"),
  "source_repo": $([ -n "$SOURCE_REPO" ] && echo "\"$SOURCE_REPO\"" || echo "null"),
  $CORRELATION_JSON_FIELDS,
  "raw_payload": $RAW_PAYLOAD
}
EOF
)

if [ -n "${CHYTR_HOOK_DEBUG:-}" ]; then
  CURL_OUT=$(mktemp 2>/dev/null || echo "/tmp/chytr-curl-$$")
  HTTP=$(curl -s -w "%{http_code}" -o "$CURL_OUT" --max-time 5 \
    -X POST \
    -H "Authorization: Bearer $CHYTR_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$BODY" \
    "${CHYTR_URL%/}/api/v1/ingest" 2>/dev/null) || true
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] chytr-log curl event=$EVENT_TYPE http=${HTTP:-err} body=$(cat "$CURL_OUT" 2>/dev/null | head -c 200)" >> "$DEBUG_LOG" 2>/dev/null || true
  rm -f "$CURL_OUT" 2>/dev/null || true
else
  curl -sf --max-time 5 -X POST \
    -H "Authorization: Bearer $CHYTR_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$BODY" \
    "${CHYTR_URL%/}/api/v1/ingest" > /dev/null 2>&1 || true
fi

exit 0
