#!/usr/bin/env bash
# Quick local test: run hook scripts with mock stdin.
# Usage: ./test-hooks.sh [session|log|stop]
# Ensure .env.local has CHYTR_PUBLIC_URL (https) and CHYTR_API_KEY for real ingest.
# Run from repo root. If hooks don't fire from Cursor, check .cursor/hooks/last-hook.log after an edit.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOCK_PAYLOAD='{"test": true, "ts": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}'

case "${1:-log}" in
  session)
    echo "$MOCK_PAYLOAD" | bash "$SCRIPT_DIR/chytr-session.sh"
    ;;
  log)
    echo "$MOCK_PAYLOAD" | bash "$SCRIPT_DIR/chytr-log.sh" "tool_call"
    ;;
  stop)
    echo "$MOCK_PAYLOAD" | bash "$SCRIPT_DIR/chytr-stop.sh"
    ;;
  *)
    echo "Usage: $0 session|log|stop"
    exit 1
    ;;
esac
