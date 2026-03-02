#!/usr/bin/env bash
set -euo pipefail

EVENT_TYPE="${1:-unknown}"
CHYTR_URL="${CHYTR_URL:-}"
CHYTR_API_KEY="${CHYTR_API_KEY:-}"
WORK_ORDER_ID="${WORK_ORDER_ID:-}"
CHYTR_AGENT_ID="${CHYTR_AGENT_ID:-}"

if [ -z "$CHYTR_URL" ] || [ -z "$CHYTR_API_KEY" ]; then
  exit 0
fi

RAW_PAYLOAD=$(cat)

BODY=$(cat <<EOF
{
  "event_type": "$EVENT_TYPE",
  "work_order_id": $([ -n "$WORK_ORDER_ID" ] && echo "\"$WORK_ORDER_ID\"" || echo "null"),
  "agent_id": $([ -n "$CHYTR_AGENT_ID" ] && echo "\"$CHYTR_AGENT_ID\"" || echo "null"),
  "raw_payload": $RAW_PAYLOAD
}
EOF
)

curl -sf \
  --max-time 5 \
  -X POST \
  -H "Authorization: Bearer $CHYTR_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$BODY" \
  "$CHYTR_URL/api/v1/ingest" \
  > /dev/null 2>&1 || true

exit 0
