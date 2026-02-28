# Triggering agents — launch-agent flow

## Overview

```
                      ┌──────────────────┐
                      │  Work Order      │
                      │  Created         │
                      │  (status=pending)│
                      └────────┬─────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
         Dashboard       REST API         Scheduled Job
       (+ New WO)     (POST /rest/v1    (run-scheduled-job
                       /work_orders)      edge fn)
              │                │                │
              └────────────────┼────────────────┘
                               │
                       DB Webhook fires
                               │
                               ▼
                  ┌────────────────────────┐
                  │  launch-agent          │
                  │  (Supabase Edge Fn)    │
                  └────────────┬───────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
       Validate WO        Check license     Fetch full WO
       (id required,      (getLicense)       (get_work_order
        skip if local)                        RPC — joins
                                              agent, repo)
            │                  │                  │
            └──────────────────┼──────────────────┘
                               │
                        Build prompt
                    (objective, lines,
                     constraints, hints,
                     verification)
                               │
                               ▼
                  ┌────────────────────────┐
                  │  Cursor Cloud Agent    │
                  │  POST /v1/agents       │
                  │  {prompt, repo_url,    │
                  │   branch}              │
                  └────────────┬───────────┘
                               │
                     Cursor returns agent ID
                               │
                               ▼
                  ┌────────────────────────┐
                  │  Update work_orders    │
                  │  status → running      │
                  │  cursor_agent_id set   │
                  └────────────┬───────────┘
                               │
               Agent executes with hooks-skill
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
      SessionStart        PostToolUse/         Stop hook
      hook fires          FileEdit/Shell       fires
           │              hooks fire                │
           │                   │                   │
           ▼                   ▼                   ▼
      ingest-log          ingest-log          ingest-log
      + query-knowledge   (each event)        (session_end)
      (inject context)                             │
                                              DoD check
                                              WO → completed|failed
```

## Entry points

Three paths create a work order and trigger the launch:

### 1. Dashboard / direct API

Insert into `work_orders` via Supabase PostgREST or the dashboard UI. The DB webhook on `INSERT` calls `launch-agent`.

```bash
curl -X POST https://<supabase-url>/rest/v1/work_orders \
  -H "apikey: <service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "objective": "Refactor auth module",
    "agent_id": "<uuid>",
    "repo_id": "<uuid>",
    "source": "cloud"
  }'
```

### 2. Manual job run

`POST /api/jobs/[id]/run` creates a work order with `source: 'job'` and a `job_runs` record, then the same DB webhook triggers `launch-agent`.

### 3. Scheduled job (cron)

`pg_cron` runs every minute, finds due `scheduled_jobs`, and calls `run-scheduled-job` edge function via `net.http_post()`. That function creates the work order with `metadata: { job_id, job_run_id }`, triggering the DB webhook.

## launch-agent step by step

Location: `supabase/functions/launch-agent/index.ts`

### 1. Parse input

Accepts either a DB webhook payload (`{ type: 'INSERT', record: {...} }`) or a direct work order object. Extracts the work order record.

### 2. Skip local sources

If `source === 'local'`, returns immediately — local sessions are tracked by hooks only, no cloud agent launch needed.

### 3. Validate license

Calls `getLicense()` which reads `instance_config.license_decoded` from the DB. Returns `403` if no valid license.

### 4. Fetch full work order

Calls `get_work_order` RPC which joins:
- `work_orders` — objective, lines, constraints, hints, verification
- `agent_repos` — `repo_url`, `default_branch`
- `agents` — `name`, `system_prompt`, `default_config`

### 5. Build prompt

`buildAgentPrompt()` constructs a structured prompt:

```
WORK_ORDER_ID=<uuid>

## Objective
<objective text>

## Work Order Lines
1. <title> — DoD: <definition_of_done>
2. ...

## Constraints
<JSON if present>

## Exploration Hints
<JSON if present>

## Verification
<JSON if present>

## Instructions
1. Start by reading your work order: the WORK_ORDER_ID above is <uuid>
2. The chytr hooks skill is installed — actions are logged automatically
3. Complete each work order line in order
4. When done, create a PR if applicable
```

### 6. Call Cursor API

```
POST https://api.cursor.com/v1/agents
Authorization: Bearer <CURSOR_API_KEY>
{
  "prompt": "<built prompt>",
  "repo_url": "<from agent_repos>",
  "branch": "<branch_name || default_branch || 'main'>"
}
```

### 7. Update work order

Sets `status = 'running'` and stores `cursor_agent_id` from the Cursor API response.

## Agent execution lifecycle

Once the Cursor Cloud Agent starts, the **hooks-skill** (installed in the target repo) captures all events:

### Session start (`chytr-session.sh`)

1. POSTs `session_start` event to `ingest-log`
2. Calls `query-knowledge` to fetch relevant learnings from past runs
3. Returns `additional_context` to the agent with injected knowledge

### During execution (`chytr-log.sh`)

Every hook event (`tool_call`, `tool_failure`, `shell_execution`, `file_edit`, `mcp_execution`, `agent_thought`, `agent_response`, `subagent_start`, `subagent_stop`) POSTs to `ingest-log`:

- Inserts into `agent_logs` table (normalized payload)
- Updates agent `last_heartbeat` and `status = 'active'`
- Events stream to dashboard via Supabase Realtime

### Session end (`chytr-stop.sh`)

1. POSTs `session_end` to `ingest-log`
2. `ingest-log` runs `checkDefinitionOfDone()`:
   - Reads work order lines
   - Checks for lines still `pending`
   - Returns `followup_message` if incomplete lines remain
3. Updates work order `status → completed|failed`, sets `finished_at`
4. Hook outputs `followup_message` back to the agent if present

### Agent completion (`agent-complete`)

Called separately (or by the stop hook flow) with token usage, PR URL, summary:

1. Updates work order with final data (`tokens_input`, `tokens_output`, `total_cost`, `model`, `duration_ms`, `pr_url`, `summary`)
2. If `CURSOR_API_KEY` set, fetches usage stats from `GET /v1/agents/<id>`
3. If `source === 'job'` and `metadata.job_run_id` exists, updates the `job_runs` record status

## Environment variables

| Variable | Required | Used by |
|----------|----------|---------|
| `CURSOR_API_KEY` | Yes | `launch-agent`, `agent-complete` |
| `SUPABASE_URL` | Yes | All edge functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | All edge functions |
| `CHYTR_URL` | Yes (agent-side) | Hook scripts |
| `CHYTR_SERVICE_KEY` | Yes (agent-side) | Hook scripts |
| `WORK_ORDER_ID` | Yes (agent-side) | Hook scripts |
| `CHYTR_AGENT_ID` | Optional (agent-side) | Hook scripts |

## Status lifecycle

```
pending → running → completed
                  → failed
                  → cancelled
```

- `pending`: work order created, launch-agent not yet called
- `running`: Cursor API returned agent ID, agent is executing
- `completed`: session_end hook fired with success
- `failed`: session_end hook fired with `status: 'failed'`
- `cancelled`: manual cancellation (no automated path yet)
