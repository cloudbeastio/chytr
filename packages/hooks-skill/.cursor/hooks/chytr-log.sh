#!/usr/bin/env bash
set -euo pipefail

EVENT_TYPE="${1:-unknown}"
CHYTR_URL="${CHYTR_URL:-}"
CHYTR_SERVICE_KEY="${CHYTR_SERVICE_KEY:-}"
WORK_ORDER_ID="${WORK_ORDER_ID:-}"
CHYTR_AGENT_ID="${CHYTR_AGENT_ID:-}"

# If no URL configured, skip silently
if [ -z "$CHYTR_URL" ] || [ -z "$CHYTR_SERVICE_KEY" ]; then
  exit 0
fi

# Read stdin payload (the raw hook data from Cursor)
RAW_PAYLOAD=$(cat)

# Build the log event body
BODY=$(cat <<EOF
{
  "event_type": "$EVENT_TYPE",
  "work_order_id": $([ -n "$WORK_ORDER_ID" ] && echo "\"$WORK_ORDER_ID\"" || echo "null"),
  "agent_id": $([ -n "$CHYTR_AGENT_ID" ] && echo "\"$CHYTR_AGENT_ID\"" || echo "null"),
  "raw_payload": $RAW_PAYLOAD
}
EOF
)

# POST to ingest-log — fire and forget, swallow all errors
curl -sf \
  --max-time 5 \
  -X POST \
  -H "Authorization: Bearer $CHYTR_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "$BODY" \
  "$CHYTR_URL/functions/v1/ingest-log" \
  > /dev/null 2>&1 || true

exit 0
