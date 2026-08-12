#!/usr/bin/env bash
# Write .chytr/correlation.json for hook join (runtime run id + cbmain).
# Usage:
#   echo '{"runtime_run_id":"bc-…","cbmain":{...}}' | chytr-stamp-correlation.sh
#   chytr-stamp-correlation.sh '{"runtime_run_id":"bc-…","cbmain":{...}}'
#   chytr-stamp-correlation.sh --from-session-url 'https://cursor.com/agents/bc-…' --cbmain '{...}'
set -euo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-${CURSOR_PROJECT_DIR:-$PWD}}"
OUT="${CHYTR_CORRELATION_FILE:-$ROOT/.chytr/correlation.json}"
mkdir -p "$(dirname "$OUT")"

parse_run_id_from_url() {
  local u="$1"
  if [[ "$u" =~ (bc-[0-9a-fA-F-]{8,}) ]]; then echo "${BASH_REMATCH[1]}"; return; fi
  if [[ "$u" =~ (session_[A-Za-z0-9]+) ]]; then echo "${BASH_REMATCH[1]}"; return; fi
  return 1
}

JSON=""
if [ "${1:-}" = "--from-session-url" ]; then
  URL="${2:-}"
  CBMAIN_ARG=""
  if [ "${3:-}" = "--cbmain" ]; then CBMAIN_ARG="${4:-}"; fi
  RID=$(parse_run_id_from_url "$URL" || true)
  if [ -z "$RID" ]; then echo "chytr-stamp-correlation: cannot parse run id from url" >&2; exit 1; fi
  if [ -n "$CBMAIN_ARG" ]; then
    JSON=$(jq -nc --arg r "$RID" --argjson c "$CBMAIN_ARG" '{runtime_run_id:$r, cbmain:($c + {runtime_run_id:$r, session_url:(.session_url // null)})}' 2>/dev/null || \
      jq -nc --arg r "$RID" --argjson c "$CBMAIN_ARG" --arg u "$URL" '{runtime_run_id:$r, cbmain:($c + {runtime_run_id:$r, session_url:$u})}')
  else
    JSON=$(jq -nc --arg r "$RID" --arg u "$URL" '{runtime_run_id:$r, cbmain:{runtime_run_id:$r, session_url:$u}}')
  fi
elif [ -n "${1:-}" ]; then
  JSON="$1"
else
  JSON="$(cat)"
fi

if ! printf '%s' "$JSON" | jq -e '.runtime_run_id | type == "string" and length > 0' >/dev/null 2>&1; then
  echo "chytr-stamp-correlation: need runtime_run_id string in JSON" >&2
  exit 1
fi
# Normalize: ensure cbmain.runtime_run_id matches
JSON=$(printf '%s' "$JSON" | jq -c '
  . as $root
  | (.runtime_run_id) as $r
  | .cbmain = ((.cbmain // {}) + {runtime_run_id:$r})
  | {runtime_run_id:$r, cbmain}
')
printf '%s\n' "$JSON" > "$OUT"
echo "wrote $OUT"
