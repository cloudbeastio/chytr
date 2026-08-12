#!/usr/bin/env bash
# Shared fragment: emit conversation_id + cbmain into ingest body.
# Expects RAW_PAYLOAD already set. Sets CORRELATION_JSON_FIELDS.
#
# Priority for runtime run id (join key ↔ ops.work_items.chyt_id):
#   1. CHYTR_RUNTIME_RUN_ID env
#   2. .chytr/correlation.json → runtime_run_id  (written after work_set_session)
#   3. RAW_PAYLOAD: conversation_id | runtime_run_id | external_run_id | session_id | composer_id
#
# Priority for cbmain breadcrumbs:
#   1. CHYTR_CBMAIN_JSON env
#   2. .chytr/correlation.json → cbmain (or whole file if it has work_item_id)
#   3. null
#
# File format (.chytr/correlation.json):
#   { "runtime_run_id": "bc-…|session_…", "cbmain": { … } }

_chytr_corr_conversation=""
_chytr_corr_cbmain="null"

# Resolve project root for the correlation file (Claude sets CLAUDE_PROJECT_DIR).
_chytr_corr_root="${CLAUDE_PROJECT_DIR:-${CURSOR_PROJECT_DIR:-$PWD}}"
_chytr_corr_file="${CHYTR_CORRELATION_FILE:-$_chytr_corr_root/.chytr/correlation.json}"

_chytr_corr_file_runtime=""
_chytr_corr_file_cbmain=""
if [ -f "$_chytr_corr_file" ] && command -v jq >/dev/null 2>&1; then
  if jq -e . "$_chytr_corr_file" >/dev/null 2>&1; then
    _chytr_corr_file_runtime=$(jq -r '
      .runtime_run_id // .cbmain.runtime_run_id // empty
    ' "$_chytr_corr_file" 2>/dev/null || true)
    # Prefer nested cbmain; else treat top-level breadcrumb fields as cbmain.
    if jq -e '.cbmain | type == "object"' "$_chytr_corr_file" >/dev/null 2>&1; then
      _chytr_corr_file_cbmain=$(jq -c '.cbmain' "$_chytr_corr_file" 2>/dev/null || true)
    elif jq -e '.work_item_id != null or .runtime_run_id != null' "$_chytr_corr_file" >/dev/null 2>&1; then
      _chytr_corr_file_cbmain=$(jq -c 'del(.cbmain)' "$_chytr_corr_file" 2>/dev/null || true)
    fi
  fi
fi

if [ -n "${CHYTR_RUNTIME_RUN_ID:-}" ]; then
  _chytr_corr_conversation="$CHYTR_RUNTIME_RUN_ID"
elif [ -n "$_chytr_corr_file_runtime" ]; then
  _chytr_corr_conversation="$_chytr_corr_file_runtime"
elif command -v jq >/dev/null 2>&1 && [ -n "${RAW_PAYLOAD:-}" ]; then
  _chytr_corr_conversation=$(printf '%s' "$RAW_PAYLOAD" | jq -r '
    .conversation_id // .runtime_run_id // .external_run_id // .session_id // .composer_id // empty
  ' 2>/dev/null || true)
fi

if [ -n "${CHYTR_CBMAIN_JSON:-}" ]; then
  if command -v jq >/dev/null 2>&1 && printf '%s' "$CHYTR_CBMAIN_JSON" | jq -e . >/dev/null 2>&1; then
    _chytr_corr_cbmain="$CHYTR_CBMAIN_JSON"
  fi
elif [ -n "$_chytr_corr_file_cbmain" ]; then
  _chytr_corr_cbmain="$_chytr_corr_file_cbmain"
fi

# Always stamp runtime_run_id into cbmain when we know the join key.
if [ -n "$_chytr_corr_conversation" ] && command -v jq >/dev/null 2>&1; then
  if [ "$_chytr_corr_cbmain" = "null" ]; then
    _chytr_corr_cbmain=$(jq -nc --arg r "$_chytr_corr_conversation" '{runtime_run_id:$r}')
  else
    _chytr_corr_cbmain=$(printf '%s' "$_chytr_corr_cbmain" | jq -c --arg r "$_chytr_corr_conversation" '. + {runtime_run_id:$r}' 2>/dev/null || echo "$_chytr_corr_cbmain")
  fi
fi

if [ -n "$_chytr_corr_conversation" ]; then
  CORRELATION_JSON_FIELDS=$(printf '"conversation_id": %s, "cbmain": %s' \
    "$(printf '%s' "$_chytr_corr_conversation" | jq -Rs . 2>/dev/null || printf '"%s"' "$_chytr_corr_conversation")" \
    "$_chytr_corr_cbmain")
else
  CORRELATION_JSON_FIELDS=$(printf '"cbmain": %s' "$_chytr_corr_cbmain")
fi
