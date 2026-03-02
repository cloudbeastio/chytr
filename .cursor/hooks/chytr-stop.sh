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

# Log the session end
if [ -n "$CHYTR_URL" ] && [ -n "$CHYTR_API_KEY" ]; then
  RAW_PAYLOAD=$(cat)

  BODY=$(cat <<EOF
{
  "event_type": "session_end",
  "work_order_id": $([ -n "$WORK_ORDER_ID" ] && echo "\"$WORK_ORDER_ID\"" || echo "null"),
  "raw_payload": $RAW_PAYLOAD
}
EOF
  )

  RESPONSE=$(curl -sf --max-time 10 \
    -X POST \
    -H "Authorization: Bearer $CHYTR_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$BODY" \
    "${CHYTR_URL%/}/api/v1/ingest" 2>/dev/null || echo "{}")

  # If ingest-log returns a followup_message, output it
  FOLLOWUP=$(echo "$RESPONSE" | grep -o '"followup_message":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "")

  if [ -n "$FOLLOWUP" ]; then
    cat <<EOF
{
  "followup_message": "$FOLLOWUP"
}
EOF
  fi
fi

exit 0
