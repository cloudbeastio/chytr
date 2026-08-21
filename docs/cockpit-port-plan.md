# Cockpit → chytr port plan (master review)

Status: draft — Joe to lock. Author: cloud agent, 2026-08-21.
Sources: full inventory of `cloudbeastio/cb-wiki-2` (Cockpit + cb-main ops spine) and this
repo. Cockpit reference design: `cb-wiki-2/agent-outputs/architecture/2026-08-20_routines-task-trigger.md`
(routines mint desk tasks, no blind agent fire) + `2026-07-19_tasks-approvals-comments-cockpit.md`
(locked: Cockpit nails process → port to chytr).

---

## 1. Master review — what each app has

### Cockpit (proven model, dogfooded)

- **Tasks** `public.tasks`: board `backlog|todo|doing|review|stuck|done|cancelled`,
  `project_id` (desk) required, `assignee_type user|agent_runtime`, claim CAS, `human_approval_to_close`.
- **Desks = projects**: `parent_id` tree + `project_type`, `default_runtime_id`, org chart UI (`/desks`).
- **Runtimes** `ops.agent_runtimes`: `cursor_automation | claude_ccr | claude_ccma | cursor_cloud` — runtime
  abstraction under the agent.
- **Dispatch**: INSERT/flip to `todo` → trigger → `ops-dispatch` wakes the desk's **instant pickup**
  agent; pickup claims THAT task (`task_claim_work_item`), runs the command named on the task, closes.
- **Routines** `ops.routines`: cron + desk + command; heartbeat tick **mints a `todo` task**
  (idempotent per occurrence slot) — never wakes an agent directly. Tick off = kill switch.
- **Work sessions** `ops.work_items` + `work_clock_in/heartbeat/clock_out` lease ledger.
- **Comments / approvals**: promote (backlog→todo) and close gates via approvals.

### chytr (today)

- **chyts** (ex work_orders): `draft|pending|running|completed|failed|cancelled` — launch-centric,
  not a board. `agent_id` FK, no claim, no desk requirement (default-project trigger exists).
- **projects** (ex contracts): flat, client/engagement container. No tree, no default agent.
- **agents**: registry + heartbeat; `type` text unused by launcher. Launch = Cursor Cloud only
  (`lib/services/launch-agent.ts` → `POST api.cursor.com/v0/agents`). Claude Code = observe-only hooks.
- **scheduled_jobs**: pg_cron → `run_scheduled_job()` → INSERT chyt → direct Cursor launch.
- **Observability**: hooks → `/api/v1/ingest` → `agent_logs` → Realtime trace. Strong; keep as-is.
- **No**: desks tree, org chart, todo-stage dispatch, runtime adapters, inbound task webhooks,
  agent MCP task tools (MCP is read-only logs/knowledge).

### Gap map

| Capability | Cockpit | chytr | Port action |
|---|---|---|---|
| Task board w/ todo stage | tasks | chyt status enum | reshape chyts (chyts = tasks) |
| Desks + org chart | projects tree + `/desks` | flat projects | add `parent_id`, tree UI |
| Instant agent per desk | `default_runtime_id` + pickup | — | `projects.default_agent_id` + dispatch |
| Runtime abstraction | `ops.agent_runtimes.runtime` | Cursor-only launcher | adapter layer on `agents.runtime` |
| Routines mint tasks | `ops.routines` + mint RPC | jobs launch directly | rewrite `run_scheduled_job` to mint `todo` |
| Inbound webhook → task | none (internal producers) | none | **new** — chytr ships it first |
| Agent claim/complete API | MCP `task_*` | none | add to `/api/mcp` + `/api/v1` |

---

## 2. Target model (chytr terms)

```
Routine (cron + desk + template)        Inbound webhook (n8n, any app)      UI / API / MCP
        │ mint (idempotent slot)                │ mint from template               │
        └────────────────┬──────────────────────┴───────────────────────────────── ┘
                         ▼
              chyt  status='todo'  project_id=desk  agent_id=desk default agent
                         │  dispatch (app-level, on todo + sweep)
                         ▼
              runtime adapter: cursor_cloud | cursor_automation | claude_code | webhook
                         │
                         ▼
              agent claims task (claim CAS) → works (hooks → agent_logs) → done/stuck
```

One fire path: **everything that should run an agent first mints a `todo` chyt on a desk.**
The todo is the wake. Direct-launch paths die (same rule Joe locked in Cockpit 2026-08-20).

### Naming

- **chyts = tasks.** Table stays `chyts` (FKs from `agent_logs`, `approvals`, `job_runs`,
  `knowledge` make a rename expensive); UI + docs say **Tasks**; add `/api/v1/tasks` alias.
- **projects = desks.** Table stays `projects`; UI says **Desks**.
- **scheduled_jobs → routines.** Rename table + UI (cheap here — few FKs, matches Cockpit).

### Statuses (reshape `work_order_status`)

`backlog | todo | doing | review | stuck | done | cancelled`
Map existing: draft→backlog, pending→todo, running→doing, completed→done,
failed→stuck (+ `error_message`), cancelled→cancelled. New claim cols: `claimed_by`,
`claimed_at`, `started_at` (have `finished_at`).

### Agent hierarchy — recommendation (asked: "agents reporting to one another")

**Don't model agent→agent reporting. The desk tree IS the org chart; agents attach to desks.**

- Cockpit tried both shapes; landed on desk tree + runtime binding. Agent identity churns
  (swap a runtime, keep the desk) — a `reports_to_agent_id` column drifts on every swap.
- "Manager agent" = the agent on the **parent desk**. Escalation = mint a task (or comment)
  on the parent desk; its agent picks it up on the same dispatch path. That's the whole
  reporting mechanic — no second hierarchy, one fire path.
- If a client insists on an explicit chain later, derive it from desk `parent_id` traversal;
  never store it twice.

---

## 3. Schema changes (migrations 027+)

1. **chyts**: new status enum + mapping; `claimed_by uuid`, `claimed_at`, `started_at`;
   `source` gains `webhook`; make `project_id` NOT NULL (default-project trigger already covers).
2. **projects**: `parent_id uuid REFERENCES projects` (depth cap), `project_type text`
   (`root|team|client|desk` — keep loose), `default_agent_id uuid REFERENCES agents`.
3. **agents**: `runtime text NOT NULL DEFAULT 'cursor_cloud'`
   (`cursor_cloud | cursor_automation | claude_code | webhook`), `runtime_config jsonb`
   (automation id, wake URL, repo, model…), `pickup_prompt text` (the desk-pickup preamble).
4. **routines** (rename `scheduled_jobs`): keep cron/enabled/project_id/template; add
   `agent_id` override (else desk default), `last_minted_slot`; unique `(routine_id, occurrence_slot)`
   on minted chyts via `metadata.routine_id + occurrence_slot` (idempotent double-mint guard).
5. **inbound_webhooks** (new): `id`, `user_id`, `project_id`, `agent_id?`, `name`, `secret_hash`,
   `template jsonb`, `enabled`, `last_fired_at`. RLS like other tables.
6. RLS + `database.types.ts` regen.

## 4. Dispatch engine (Phase 2 core)

App-level, not DB trigger (chytr is API-first; avoids pg_net→Vercel coupling):

- `lib/services/dispatch.ts`: `dispatchChyt(chyt)` — resolve agent (chyt.agent_id →
  desk.default_agent_id → walk desk `parent_id`), pick adapter by `agents.runtime`, launch,
  stamp `doing` + external run id. Try/catch + retry (3x backoff) + `stuck` on hard fail.
- Called from every todo-mint path (API create, routine mint, webhook mint, UI promote) +
  a **sweep** (Vercel cron / pg_cron→`/api/v1/dispatch/sweep`, every 1–5 min) that re-fires
  unclaimed `todo`s past a TTL. Sweep = the safety net Cockpit gets from its DB trigger.

Adapters (`lib/services/runtimes/`):

| Runtime | Mechanics |
|---|---|
| `cursor_cloud` | existing `launch-agent.ts`, refactored behind the adapter interface (push) |
| `cursor_automation` | Cursor API trigger of a named automation (`runtime_config.automation_id`); prompt = pickup_prompt + task ref |
| `claude_code` | **pull**: agent polls/claims via MCP `task_claim` (its own cron/hook loop); optional `runtime_config.wake_url` POST for push. Hooks already report logs |
| `webhook` | POST task JSON to `runtime_config.url` (HMAC w/ agent secret) — n8n/Zapier/etc. as an "agent" |

## 5. Routines (Phase 3)

- `run_scheduled_job()` rewritten: INSERT chyt `status='todo'` on the routine's desk from
  template (no launch); idempotent per slot; `job_runs` row links routine→chyt.
- Dispatch sweep (or the DB fn calling the app) fires it. No direct Cursor call from SQL.
- UI: **Routines is its own link off the desk** — `/desks/[id]/routines` (list, enable, run-now,
  occurrence history = the minted tasks on that desk). Global `/routines` replaces `/jobs`
  (redirect). License: stays Pro+ (`scheduled_jobs` feature flag renamed).

## 6. Inbound webhooks (Phase 4)

- `POST /api/v1/hooks/[id]` — verify `X-Chytr-Signature` (HMAC of body w/ webhook secret) or
  `?key=` fallback; validate payload; mint todo chyt from `template` with `{{payload.*}}`
  interpolation; return chyt id. Rate-limit per hook.
- Settings UI on desk: create hook → shows URL + secret once. n8n HTTP node POSTs JSON; done.

## 7. UI (Phase 5)

- `/desks` — org chart (tree of desk cards: agent + runtime badge + status dot, open
  todo/doing counts, routines count → link). `/projects` redirects.
- `/tasks` — kanban board (columns = statuses), filters desk/agent/status; `/chyts` redirects.
  Detail page keeps the Realtime trace (unchanged, chytr's strongest surface).
- Desk detail: task board scoped to desk + Routines link + Webhooks link + agent card.

## 8. MCP + pull agents (Phase 6)

- Add MCP tools (PAT `chk_` auth, mirror Cockpit contracts): `task_list`, `task_claim`
  (CAS todo→doing, `FOR UPDATE SKIP LOCKED`), `task_start`, `task_complete`, `task_stuck`,
  `task_create` (backlog). Same ops via `/api/v1/tasks/*` REST.
- This is what makes a self-hosted Claude Code box a first-class agent with zero inbound
  networking: its own loop claims → works → completes; hooks stream the trace.
- Docs pass: kill `work_orders` drift, document tasks/desks/routines/webhooks.

## 9. Phases (recap)

| Phase | Ships | Depends |
|---|---|---|
| 0 | Lock this doc (Joe) | — |
| 1 | Schema migrations 027+ | 0 |
| 2 | Dispatch engine + 4 adapters | 1 |
| 3 | Routines mint todo + `/desks/[id]/routines` | 2 |
| 4 | Inbound webhook endpoint + UI | 2 |
| 5 | Desks org chart + task board | 1 (UI parallel to 2–4) |
| 6 | MCP task tools + docs rename | 1 |

## 10. Out of scope v1 (deliberate)

- Approvals promote/close gates on the board (chytr approvals stay HITL questions; add
  `human_approval_to_close` later if clients want the gate).
- `ops.work_items`-style separate lease ledger — the chyt row + claim cols is the ticket.
- Comments spine, domain wall, wiki sync, heartbeat tick clock (routines use pg_cron directly;
  a master kill switch = one `instance_config` flag checked by mint + dispatch).

## Unresolved questions

1. Rename `chyts` table → `tasks` now, or keep table + UI-says-Tasks (recommended)?
2. `failed` → `stuck` mapping OK, or keep `failed` as terminal status?
3. Master kill switch (`instance_config` flag gating all dispatch) — want it v1?
4. Cursor automation trigger API — confirm endpoint/auth available on your Cursor plan?
5. `claude_code` push wake needed v1, or pull-only (recommended)?
6. Webhook runtime + inbound webhooks: Pro+ or free tier?
7. Desk depth cap (Cockpit uses 8) — same?
8. Keep `agents.last_heartbeat` offline logic per runtime, or only for pull runtimes?
