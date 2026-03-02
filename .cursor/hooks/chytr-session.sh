#!/usr/bin/env bash
set -euo pipefail

CHYTR_URL="${CHYTR_URL:-}"
CHYTR_SERVICE_KEY="${CHYTR_SERVICE_KEY:-}"
WORK_ORDER_ID="${WORK_ORDER_ID:-}"
CHYTR_AGENT_ID="${CHYTR_AGENT_ID:-}"

# Log the session start
if [ -n "$CHYTR_URL" ] && [ -n "$CHYTR_SERVICE_KEY" ]; then
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
    -H "Authorization: Bearer $CHYTR_SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -d "$BODY" \
    "$CHYTR_URL/functions/v1/ingest-log" > /dev/null 2>&1 || true

  # Query knowledge for context injection
  KNOWLEDGE=""
  if [ -n "$WORK_ORDER_ID" ]; then
    KNOWLEDGE=$(curl -sf --max-time 5 \
      -H "Authorization: Bearer $CHYTR_SERVICE_KEY" \
      -H "Content-Type: application/json" \
      "$CHYTR_URL/functions/v1/query-knowledge?work_order_id=$WORK_ORDER_ID" 2>/dev/null || echo "")
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
