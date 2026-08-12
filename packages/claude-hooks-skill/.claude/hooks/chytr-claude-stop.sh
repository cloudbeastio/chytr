#!/usr/bin/env bash
set -euo pipefail

# chytr-claude-stop.sh — Stop + SessionEnd hook for Claude Code. $1 = stop | session_end.
#
# IMPORTANT divergence from the Cursor hooks: chytr's ingest endpoint flips the chyt to
# completed/failed on event_type=session_end, and Claude Code's Stop event fires at the
# end of EVERY turn — not the end of the session. So Stop sends event_type=stop (a valid,
# non-terminal event type) and only SessionEnd sends the terminal session_end.
#
# stop:        POST event_type=stop; if the response carries a non-empty followup_message,
#              emit {"decision":"block","reason":...} so Claude continues with that message.
# session_end: POST event_type=session_end (terminal — flips the chyt) and delete
#              $ROOT/.chytr/current_chyt (the session's chyt is finished).
# Always exits 0; silently skips when URL/key are unset.

MODE="${1:-stop}"

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

# shellcheck source=chytr-correlation.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]:-.}")" && pwd)/chytr-correlation.sh"

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

if [ "$MODE" = "session_end" ]; then
  EVENT_TYPE="session_end"
else
  EVENT_TYPE="stop"
fi

BODY=$(cat <<EOF
{
  "event_type": "$EVENT_TYPE",
  "chyt_id": $([ -n "$CHYT_ID" ] && echo "\"$CHYT_ID\"" || echo "null"),
  "agent_id": $([ -n "$CHYTR_AGENT_ID" ] && echo "\"$CHYTR_AGENT_ID\"" || echo "null"),
  "source_repo": $([ -n "$SOURCE_REPO" ] && echo "\"$SOURCE_REPO\"" || echo "null"),
  $CORRELATION_JSON_FIELDS,
  "raw_payload": $RAW_PAYLOAD
}
EOF
)

RESPONSE=$(curl -sf --max-time 10 -X POST \
  -H "Authorization: Bearer $CHYTR_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$BODY" \
  "${CHYTR_URL%/}/api/v1/ingest" 2>/dev/null || echo "{}")

if [ "$MODE" = "session_end" ]; then
  # The session's chyt is finished (ingest flipped it to completed/failed) — clear the pin
  rm -f "$ROOT/.chytr/current_chyt" 2>/dev/null || true
  exit 0
fi

# Stop: surface a followup_message (definition-of-done loop-back) as a continuation
FOLLOWUP=""
if [ "$HAS_JQ" = "1" ]; then
  FOLLOWUP=$(printf '%s' "$RESPONSE" | jq -r '.followup_message // ""' 2>/dev/null || echo "")
else
  FOLLOWUP=$(printf '%s' "$RESPONSE" | grep -o '"followup_message":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "")
fi

if [ -n "$FOLLOWUP" ] && [ "$FOLLOWUP" != "null" ]; then
  if [ "$HAS_JQ" = "1" ]; then
    jq -n --arg reason "$FOLLOWUP" '{decision: "block", reason: $reason}' 2>/dev/null || true
  else
    cat <<EOF
{
  "decision": "block",
  "reason": "$FOLLOWUP"
}
EOF
  fi
fi

exit 0
