#!/usr/bin/env bash
set -euo pipefail

# Load .env.local from project root if vars not set
if [ -z "${CHYTR_API_KEY:-}" ]; then
  ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
  [ -f "$ROOT/.env.local" ] && set -a && source "$ROOT/.env.local" && set +a
fi

CHYTR_URL="${CHYTR_URL:-${CHYTR_PUBLIC_URL:-}}"
CHYTR_API_KEY="${CHYTR_API_KEY:-}"
WORK_ORDER_ID="${WORK_ORDER_ID:-}"
CHYTR_AGENT_ID="${CHYTR_AGENT_ID:-}"

# Log the session start
if [ -n "$CHYTR_URL" ] && [ -n "$CHYTR_API_KEY" ]; then
  RAW_PAYLOAD=$(cat)

  BODY=$(cat <<EOF
{
  "event_type": "session_start",
  "work_order_id": $([ -n "$WORK_ORDER_ID" ] && echo "\"$WORK_ORDER_ID\"" || echo "null"),
  "agent_id": $([ -n "$CHYTR_AGENT_ID" ] && echo "\"$CHYTR_AGENT_ID\"" || echo "null"),
  "raw_payload": $RAW_PAYLOAD
}
EOF
  )

  curl -sf --max-time 5 -X POST \
    -H "Authorization: Bearer $CHYTR_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$BODY" \
    "${CHYTR_URL%/}/api/v1/ingest" > /dev/null 2>&1 || true

  # Query knowledge for context injection
  KNOWLEDGE=""
  if [ -n "$WORK_ORDER_ID" ]; then
    KNOWLEDGE=$(curl -sf --max-time 5 \
      -H "Authorization: Bearer $CHYTR_API_KEY" \
      "${CHYTR_URL%/}/api/v1/knowledge/query?work_order_id=$WORK_ORDER_ID" 2>/dev/null || echo "")
  fi

  # Output additional_context if we got knowledge
  if [ -n "$KNOWLEDGE" ]; then
    cat <<EOF
{
  "additional_context": "Relevant knowledge from past agent runs:\n$KNOWLEDGE"
}
EOF
  fi
fi

exit 0
