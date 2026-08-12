#!/usr/bin/env bash
# Shared fragment: emit JSON fields for conversation_id + cbmain into ingest body.
# Expects RAW_PAYLOAD already set. Sets CORRELATION_JSON_FIELDS (comma-prefixed object fields).
# Env: CHYTR_RUNTIME_RUN_ID, CHYTR_CBMAIN_JSON

_chytr_corr_conversation=""
_chytr_corr_cbmain="null"

if [ -n "${CHYTR_RUNTIME_RUN_ID:-}" ]; then
  _chytr_corr_conversation="$CHYTR_RUNTIME_RUN_ID"
elif command -v jq >/dev/null 2>&1 && [ -n "${RAW_PAYLOAD:-}" ]; then
  _chytr_corr_conversation=$(printf '%s' "$RAW_PAYLOAD" | jq -r '
    .conversation_id // .runtime_run_id // .external_run_id // .session_id // .composer_id // empty
  ' 2>/dev/null || true)
fi

if [ -n "${CHYTR_CBMAIN_JSON:-}" ]; then
  if command -v jq >/dev/null 2>&1 && printf '%s' "$CHYTR_CBMAIN_JSON" | jq -e . >/dev/null 2>&1; then
    _chytr_corr_cbmain="$CHYTR_CBMAIN_JSON"
  fi
fi

if [ -n "$_chytr_corr_conversation" ]; then
  CORRELATION_JSON_FIELDS=$(printf '"conversation_id": %s, "cbmain": %s' \
    "$(printf '%s' "$_chytr_corr_conversation" | jq -Rs . 2>/dev/null || printf '"%s"' "$_chytr_corr_conversation")" \
    "$_chytr_corr_cbmain")
else
  CORRELATION_JSON_FIELDS=$(printf '"cbmain": %s' "$_chytr_corr_cbmain")
fi
