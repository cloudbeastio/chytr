# Agent execution linkage (cb-main ↔ chytr)

**Status:** P1b+P2 shipped (PR #10). Correlation bridge (file + work_set_session) on
`cursor/chytr-correlation-bridge-b396`. Design SoT:
`cloudbeastio/cb-wiki-2` → `agent-outputs/architecture/2026-08-12_chytr-workitem-linkage-and-query.md`.

## Contract (P0)

| Side | Field | Meaning |
|---|---|---|
| cb-main | `ops.work_items.chyt_id` | **Runtime run id** (`bc-…` / `session_…`) — legacy column name |
| chytr | `agent_logs.conversation_id` | Same runtime run id |
| chytr | `agent_logs.payload.cbmain` | Breadcrumbs only (work_item/task/project/repo/branch/session_url/lane) |

chytr remains write SoT. Joe 2026-08-16: **also copy** redacted rows into
cb-main `ops.chytr_agent_logs` (live ingest + backfill). Plan:
`docs/cb-main-log-sync-plan.md`.

**Do not** use Claude Code's raw UUID `session_id` as the join key unless it equals a
cb-main-stamped `session_…` / `bc-…` value.

## Join path (clean)

1. Agent calls `work_set_session(work_item_id, session_url=…)` on cb-main MCP.
2. MCP parses `bc-…` / `session_…` from the URL, stamps `ops.work_items.chyt_id`, returns
   `chytr_correlation` (`write_path`, `write_json`).
3. Agent writes that JSON to **`.chytr/correlation.json`** (gitignored) — helper:
   `scripts/chytr-stamp-correlation.sh` (wiki) / `packages/hooks-skill/scripts/chytr-stamp-correlation.sh`.
4. Hooks source `chytr-correlation.sh` which prefers:
   - env `CHYTR_RUNTIME_RUN_ID` / `CHYTR_CBMAIN_JSON` (optional override)
   - else **`.chytr/correlation.json`**
   - else raw hook payload ids
5. Ingest stores `conversation_id` + `payload.cbmain` → Cockpit Execution log joins by
   `runtime_run_id` via `chytr_logs_list`.

## P1b — ingest guarantee

`POST /api/v1/ingest` resolves `conversation_id` from (in order):

1. body `conversation_id` / `runtime_run_id`
2. `raw_payload` keys: `conversation_id`, `runtime_run_id`, `external_run_id`, `session_id`, `composer_id`, `cbmain.runtime_run_id`
3. env `CHYTR_RUNTIME_RUN_ID`

`payload.cbmain` merges body `cbmain` ← raw `cbmain` ← env `CHYTR_CBMAIN_JSON`, always stamping `runtime_run_id` when known.

Hooks (`packages/hooks-skill`, `packages/claude-hooks-skill`) source `chytr-correlation.sh` and forward those fields.

### Coverage metric

- HTTP: `GET /api/v1/metrics/correlation-coverage?hours=24` (chk_ auth)
- SQL: `select public.agent_logs_correlation_coverage(24);` (migration `026_…`)

## P2 — read MCP

- `POST /api/mcp` (Node) — JSON-RPC; PAT `chk_` or GoTrue JWT (JWT read-only)
- `GET /.well-known/oauth-protected-resource` — RFC 9728
- Tools: `chytr_logs_list` (**by `conversation_id`**, not chyt_id), `chytr_knowledge_query`
- Mandatory redaction of `source_repo` / credential patterns in payload
- `mcp_audit_log` on every `tools/call`
- Auth server: `CHYTR_MCP_AUTH_SERVER` (default `NEXT_PUBLIC_SUPABASE_URL/auth/v1`); optional same-origin rewrites in `next.config.ts` (verify D3 before flipping)

## D5 — product-model drift (flag)

`chyts` is empty while `agent_logs` streams tens of thousands of rows. Reporting substrate is **log-centric**. `chytr_chyt_*` MCP tools stay **descoped** until chyts are actually created.

## Apply migrations

On chytr Supabase (`xbvbivmvrozdesdkormu`):

1. `025_mcp_audit_log.sql`
2. `026_agent_logs_correlation_coverage.sql`

## Fleet env (optional override)

Prefer the **file bridge** above. Env still works when a runtime can inject per-session env:

```
CHYTR_RUNTIME_RUN_ID=<external_run_id>
CHYTR_CBMAIN_JSON={"work_item_id":"...","work_item_short_id":"W…","task_id":"...","task_short_id":"T…","project_id":"...","repo":"...","branch":"...","session_url":"...","lane":"..."}
```
