# Plan: chytr `agent_logs` → cb-main mirror

**Status:** Gate A plan + impl (2026-08-16). Joe override of the 2026-08-12
"no copy" cut. Wiki twin:
`cloudbeastio/cb-wiki-2` → `agent-outputs/architecture/2026-08-16_chytr-logs-to-cb-main.md`.

**Live (2026-08-16, chytr `xbvbivmvrozdesdkormu`):** 51,980 `agent_logs`, 1 user,
14,357 with `conversation_id` (235 run ids), ~48k wiki-sourced. cb-main has
**no** log table yet. 174/763 `ops.work_items` carry a run id.

---

## Why (Joe, 2026-08-16)

Wiki hooks already stream to chytr. Need those rows **in cb-main Postgres**, plus
**backfill of existing logs**. Single chytr user → no multi-tenant fan-out.

Reverses 2026-08-12 §"No copying of agent_logs into cb-main" (read-on-demand via
`chytr_logs_list`). Join key + MCP stay. Mirror is additive so Cockpit/SQL can
join without a live chytr hop.

## SoT after this

| Domain | SoT | Other side |
|---|---|---|
| Work identity (projects/tasks/work_items) | **cb-main** | breadcrumbs on log `payload.cbmain` |
| Live ingest / knowledge embeddings | **chytr** | unchanged |
| Queryable execution log in CRM | **cb-main `ops.chytr_agent_logs`** (redacted copy) | chytr keeps original |

chytr remains the write path. cb-main never writes back into chytr logs.

## Design

```
wiki/fleet hooks
  → POST chytr /api/v1/ingest
  → INSERT chytr.agent_logs
  → best-effort POST cb-main chytr-log-ingest  (redacted)
  → UPSERT ops.chytr_agent_logs (unique chytr_log_id)

backfill: POST chytr /api/v1/cbmain-sync/backfill  (paged, same ingest)
```

**Push, not pull.** chytr already has the row; `chytr_logs_list` cannot list-all
(needs `conversation_id`). Pull would need a new dump API + cron lag.

**Redact before leave chytr.** `source_repo` has held live `ghs_…` tokens.
Reuse `lib/mcp/redact.ts`. Mirror stores `source_repo_name` only (canonical
`owner/repo`), never raw URL.

**Scope default = all rows.** Joe is the only chytr user; wiki is ~92% of
volume. Optional `repo=` filter on backfill. No new PAT scopes (ingest is
shared-secret; read reuses owner-scoped RPC).

### cb-main table `ops.chytr_agent_logs`

| Col | Notes |
|---|---|
| `chytr_log_id` | unique, chytr `agent_logs.id` |
| `owner_user_id` | `app_settings.system_owner_user_id` (fallback `owner_user_id`) |
| `conversation_id` | join = `ops.work_items.chyt_id` |
| `event_type`, `payload`, `model`, `created_at` | redacted payload |
| `source_repo_name` | canonical name |
| `cbmain` | extracted breadcrumbs |
| `synced_at` | mirror write time |

RLS on. Read via `public.chytr_agent_logs_list` (SECURITY DEFINER, owner).
Ingest Edge `chytr-log-ingest` (`verify_jwt=false`, `x-chytr-sync-key`).

### chytr

- After ingest INSERT (`.select()` for id): fire-and-forget sync. Ingest never
  fails on sync miss.
- `POST /api/v1/cbmain-sync/backfill` (`chk_` auth): page by `(created_at, id)`,
  cursor in `instance_config.cbmain_log_sync_cursor`.
- Env (names only): `CBMAIN_LOG_SYNC_URL`, `CBMAIN_LOG_SYNC_KEY`.

### Cockpit

Local RPC first, live `chytr_logs_list` fallback until backfill catches up.

## Phases

| Phase | Work | Repo | Deploy |
|---|---|---|---|
| **P0** | This plan | both | n/a |
| **P1** | Mirror table + `chytr-log-ingest` + list RPC | cb-wiki-2 | merge → Supabase GitHub integration |
| **P2** | Ingest hook + backfill route | chytr | merge → Vercel |
| **P3** | Joe: Cockpit **Settings → Integrations → Chytr log drain** (URL + chk_ + sync key). Same sync key on chytr Vercel `CBMAIN_LOG_SYNC_*` | Cockpit UI + chytr Vercel | Joe |
| **P4** | Integrations → **Test connection** then **Run backfill** until mirror_rows catch up | Cockpit UI | Joe / cockpit-qa |
| **P5** | Work-item drawer Execution log shows local mirror rows | Cockpit | cockpit-qa |

## Done = UI tests (`/cockpit-qa`)

| # | Check | Pass |
|---|--------|------|
| D1 | `/settings/integrations` shows **Chytr log drain** card | h2 + URL/API/sync fields |
| D2 | Save drain (URL + chk_ + Generate sync key) | flash-ok; status shows API key set + sync key set |
| D3 | **Test connection** | flash-ok "Chytr connection OK" |
| D4 | **Run backfill (5 pages)** | flash-ok with pushed>0 OR chytr 503 until chytr env set |
| D5 | Mirror rows counter rises after successful backfill | `mirror_rows` increases |
| D6 | Work item with `runtime_run_id` → Execution log | rows from mirror (not "Chytr not configured") |
| D7 | Smoke A–G on Integrations | auth, nav Admin→Integrations, route, heading, deep link |

Gate: D1 required on preview. D2–D6 need migrations merged (merge-owned) + chytr `CBMAIN_LOG_SYNC_*`.


## Gate A

1. **Use case:** SQL-join agent traces to work_items/tasks in cb-main; backfill
   history. Compounds: every run is queryable next to the work model.
2. **Reuse:** ingest, redact, run-id contract, `system_owner_user_id`, drain-style
   shared-secret Edge. New: one table, one Edge, one chytr helper, backfill.
3. **Trigger:** event = ingest POST. Backfill = on-demand API (then optional cron).
4. **Monitor:** `chytr_agent_logs_sync_stats` + chytr cursor. Silent fail =
   ingest ok + coverage gap → `/coo-daily` / `cb-escalation` if last-24h mirror
   << chytr inserts.
5. **Learning:** traces stay next to work identity (Layer-0 exhaust).
6. **Stack:** chytr + cb-main. No third store.

## Workflow audit

1. Source: chytr `agent_logs` (hooks + `work_log` ingest).
2. Conflict: chytr wins; mirror upserts by `chytr_log_id`.
3. Always: redact; run id when known; owner = Joe.
4. Never: raw `source_repo` URL; secrets; block ingest on sync fail; apply
   cb-main DDL from a session (merge-owned).
5. Corrections: coverage RPC.
6. Correction → rule: threshold on last-24h gap.
7. Compounding: yes — traces become CRM-queryable.

## What this does not do

- No chytr→cb-main knowledge/embedding copy.
- No push of projects/tasks into chytr.
- No session apply of cb-main migrations.
- No unredacted token copy.

## Unresolved

- Wiki-only filter or all repos? (default all)
- Mirror retention vs chytr 3/30/90d cleanup?
- Backfill now vs after Joe sets secrets?
- New MCP `work_logs_list` or Cockpit RPC only?
- Cap payload size (default 64k)?
