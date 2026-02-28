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
       POST /api/v1/    POST /api/v1/     POST /api/v1/
       work-orders      jobs/[id]/run     jobs/cron
       (dashboard,      (manual run)      (pg_cron)
        API users)
              │                │                │
              └────────────────┼────────────────┘
                               │
                      Insert work_orders row
                      Call launchAgent(id)
                               │
                               ▼
                  ┌────────────────────────┐
                  │  lib/services/         │
                  │  launch-agent.ts       │
                  └────────────┬───────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
       Validate WO        Check license     Fetch full WO
       (skip if local)    (loadLicenseDB)   (get_work_order
                                              RPC — joins
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
                  │  POST /v0/agents       │
                  │  {prompt.text,         │
                  │   source.repository,   │
                  │   source.ref,          │
                  │   webhook_url,         │
                  │   webhook_secret}      │
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
      /api/v1/ingest      /api/v1/ingest      /api/v1/ingest
      + /api/v1/knowledge (each event)        (session_end)
      (inject context)                             │
                                              DoD check
                                              WO → completed|failed
                               │
                               ▼
                  ┌────────────────────────┐
                  │  Cursor webhook POST   │
                  │  /api/v1/webhook/cursor │
                  │  (FINISHED or ERROR)   │
                  └────────────┬───────────┘
                               │
                  Update WO: status, pr_url,
                  summary, branch_name
                  Update job_runs if applicable
```

## All traffic goes through /api/v1/*

External callers (hooks, users, cron, Cursor webhooks) never call Supabase directly. Everything routes through Next.js API routes authenticated with `CHYTR_API_KEY`.

The only exception: `embed` and `query-knowledge` edge functions are called internally by Next.js (they need the Supabase AI runtime for vector embeddings).

## Entry points

### 1. API / Dashboard

```
POST /api/v1/work-orders
Authorization: Bearer <CHYTR_API_KEY>

{
  "objective": "Refactor auth module",
  "agent_id": "<uuid>",
  "repo_id": "<uuid>",
  "lines": [...],
  "constraints": {...},
  "verification": {...}
}
```

Creates the work order row and immediately calls `launchAgent()`.

### 2. Manual job run

```
POST /api/v1/jobs/<id>/run
Authorization: Bearer <CHYTR_API_KEY>
```

Creates work order with `source: 'job'` and `metadata: { job_id, job_run_id }`, creates a `job_runs` record, then calls `launchAgent()`.

### 3. Scheduled job (cron)

`pg_cron` runs every minute, finds due `scheduled_jobs`, POSTs to `/api/v1/jobs/cron` with the `job_id`. The route creates the work order and launches the agent.

## Cursor API call

`lib/services/launch-agent.ts` calls the Cursor Cloud Agent API:

```
POST https://api.cursor.com/v0/agents
Authorization: Basic <base64(CURSOR_API_KEY:)>

{
  "prompt": { "text": "<structured prompt>" },
  "source": {
    "repository": "https://github.com/org/repo",
    "ref": "main"
  },
  "target": { "autoCreatePr": true },
  "webhook_url": "https://app.chytr.ai/api/v1/webhook/cursor",
  "webhook_secret": "<CHYTR_API_KEY>"
}
```

The `webhook_url` points back to the chytr instance so Cursor notifies us on completion.

## Agent completion webhook

When the Cursor agent finishes (status `FINISHED` or `ERROR`), Cursor POSTs to `/api/v1/webhook/cursor`:

**Headers:**
- `User-Agent: Cursor-Agent-Webhook/1.0`
- `X-Webhook-Event: statusChange`
- `X-Webhook-ID: <unique-id>`
- `X-Webhook-Signature: sha256=<hmac-hex>`

**Body:**
```json
{
  "event": "statusChange",
  "timestamp": "2025-01-15T10:30:00Z",
  "id": "bc_abc123",
  "status": "FINISHED",
  "source": { "repository": "...", "ref": "main" },
  "target": {
    "url": "https://cursor.com/agents?id=bc_abc123",
    "branchName": "cursor/task-1234",
    "prUrl": "https://github.com/org/repo/pull/42"
  },
  "summary": "Completed the refactoring..."
}
```

The webhook receiver:
1. Verifies HMAC-SHA256 signature using `CHYTR_API_KEY`
2. Looks up work order by `cursor_agent_id`
3. Updates: `status`, `pr_url`, `branch_name`, `summary`, `finished_at`
4. If `source === 'job'`, updates the `job_runs` record

## Hook event flow

During execution, the hooks-skill captures all agent events via `/api/v1/ingest`:

### Session start (`chytr-session.sh`)
1. POSTs `session_start` to `/api/v1/ingest`
2. GETs `/api/v1/knowledge?work_order_id=<id>` for context
3. Returns `additional_context` to the agent

### During execution (`chytr-log.sh`)
Each event POSTs to `/api/v1/ingest`:
- `tool_call`, `tool_failure`, `shell_execution`, `file_edit`
- `mcp_execution`, `agent_thought`, `agent_response`
- `subagent_start`, `subagent_stop`

Events are normalized, stored in `agent_logs`, and stream to dashboard via Supabase Realtime.

### Session end (`chytr-stop.sh`)
1. POSTs `session_end` to `/api/v1/ingest`
2. Service checks Definition of Done on work order lines
3. Updates work order status
4. Returns `followup_message` if incomplete lines remain

## Environment variables

| Variable | Where | Description |
|----------|-------|-------------|
| `CHYTR_API_KEY` | App + hooks | API key for auth (also webhook secret) |
| `CHYTR_PUBLIC_URL` | App | Public URL for webhook callbacks |
| `CURSOR_API_KEY` | App | Cursor API key for launching agents |
| `CHYTR_URL` | Hooks | Points to the chytr instance |
| `WORK_ORDER_ID` | Hooks | Scopes events to a work order |
| `CHYTR_AGENT_ID` | Hooks | Optional agent identifier |

## Status lifecycle

```
pending → running → completed
                  → failed
                  → cancelled
```

- `pending`: work order created, agent not yet launched
- `running`: Cursor API accepted, agent executing
- `completed`: webhook received `FINISHED` or session_end with success
- `failed`: webhook received `ERROR` or session_end with failure
- `cancelled`: manual cancellation
