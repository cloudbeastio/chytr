#!/usr/bin/env bash
set -euo pipefail

# chytr-claude-log.sh — generic logging hook for Claude Code.
# Wired to: PostToolUse (no arg — event type derived from the payload),
# SubagentStop ($1=subagent_stop), PreCompact ($1=pre_compact).
# Reads the Claude Code hook JSON on stdin and POSTs it to ${CHYTR_URL}/api/v1/ingest.
# Non-blocking guarantee: always exits 0; silently skips when URL/key are unset.

# Resolve project root: Claude Code sets CLAUDE_PROJECT_DIR for hooks
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

# Consume stdin regardless (avoids blocking the pipe), then decide whether to send
RAW_PAYLOAD="$(cat 2>/dev/null || echo "{}")"

if [ -z "$CHYTR_URL" ] || [ -z "$CHYTR_API_KEY" ]; then
  exit 0
fi

HAS_JQ=0
command -v jq >/dev/null 2>&1 && HAS_JQ=1

# Validate stdin is JSON; fall back to {} so the ingest body stays well-formed
if [ "$HAS_JQ" = "1" ]; then
  if ! printf '%s' "$RAW_PAYLOAD" | jq -e . >/dev/null 2>&1; then
    RAW_PAYLOAD="{}"
  fi
elif [ -z "$RAW_PAYLOAD" ]; then
  RAW_PAYLOAD="{}"
fi

# Event type: $1 verbatim when given (lifecycle callers: subagent_stop, pre_compact);
# else derive from the PostToolUse payload's tool_name / tool_response
EVENT_TYPE="${1:-}"
if [ -z "$EVENT_TYPE" ]; then
  EVENT_TYPE="tool_call"
  if [ "$HAS_JQ" = "1" ]; then
    TOOL_NAME=$(printf '%s' "$RAW_PAYLOAD" | jq -r '.tool_name // ""' 2>/dev/null || echo "")
    case "$TOOL_NAME" in
      Bash) EVENT_TYPE="shell_execution" ;;
      Edit|Write|MultiEdit|NotebookEdit) EVENT_TYPE="file_edit" ;;
      mcp__*) EVENT_TYPE="mcp_execution" ;;
      *) EVENT_TYPE="tool_call" ;;
    esac
    # Failure detection: truthy .tool_response.error or .tool_response.is_error
    if printf '%s' "$RAW_PAYLOAD" | jq -e \
      '((.tool_response // {}) | (.error // .is_error // false)) as $e | ($e != false and $e != "")' \
      >/dev/null 2>&1; then
      EVENT_TYPE="tool_failure"
    fi
  fi
fi

BODY=$(cat <<EOF
{
  "event_type": "$EVENT_TYPE",
  "chyt_id": $([ -n "$CHYT_ID" ] && echo "\"$CHYT_ID\"" || echo "null"),
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

exit 0
