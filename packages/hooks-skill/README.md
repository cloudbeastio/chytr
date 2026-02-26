# chytr hooks skill

Installs Cursor agent hooks that POST structured log events to a chytr instance. Every tool call, file edit, shell execution, MCP call, agent thought, and session boundary gets captured — tied to a work order ID for full traceability.

## Install

From the root of any repo:

```bash
curl -fsSL https://raw.githubusercontent.com/cloudbeastio/chytr/main/packages/hooks-skill/install.sh | bash
```

Or clone and run locally:

```bash
bash packages/hooks-skill/install.sh
```

This copies `.cursor/hooks.json` and the three hook scripts into your repo's `.cursor/` directory and makes them executable.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `CHYTR_URL` | Yes | Your Supabase project URL (e.g. `https://xyz.supabase.co`) |
| `CHYTR_SERVICE_KEY` | Yes | Supabase service role key — used to authenticate hook POSTs |
| `WORK_ORDER_ID` | Recommended | ID of the active work order — scopes all events to a task |
| `CHYTR_AGENT_ID` | Optional | Agent identifier — useful when running multiple agents |

Set them in your shell, `.env`, or inject via `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "your-server": {
      "env": {
        "CHYTR_URL": "https://xyz.supabase.co",
        "CHYTR_SERVICE_KEY": "your-service-key",
        "WORK_ORDER_ID": "wo_abc123"
      }
    }
  }
}
```

If `CHYTR_URL` or `CHYTR_SERVICE_KEY` are not set, all hooks exit silently — no errors, no noise.

## How work order IDs work

Set `WORK_ORDER_ID` before starting a session to tie every log event to a specific task. On `SessionStart`, the hooks skill queries `GET /functions/v1/query-knowledge?work_order_id=<id>` and injects any returned knowledge as `additional_context` into the agent session — so the agent picks up where the last run left off.

On `Stop`, the `ingest-log` endpoint can return a `followup_message` field which gets surfaced back to the agent as a continuation prompt — enabling automatic work order validation and loop-back if the definition of done isn't met.

## Tracked events

| Hook event | `event_type` sent | Script |
|---|---|---|
| `SessionStart` | `session_start` | `chytr-session.sh` |
| `PostToolUse` | `tool_call` | `chytr-log.sh` |
| `PostToolUseFailure` | `tool_failure` | `chytr-log.sh` |
| `AfterShellExecution` | `shell_execution` | `chytr-log.sh` |
| `AfterFileEdit` | `file_edit` | `chytr-log.sh` |
| `AfterMCPExecution` | `mcp_execution` | `chytr-log.sh` |
| `AfterAgentThought` | `agent_thought` | `chytr-log.sh` |
| `AfterAgentResponse` | `agent_response` | `chytr-log.sh` |
| `SubagentStart` | `subagent_start` | `chytr-log.sh` |
| `SubagentStop` | `subagent_stop` | `chytr-log.sh` |
| `Stop` | `session_end` | `chytr-stop.sh` |

## Payload structure

Every event POSTs to `POST /functions/v1/ingest-log`:

```json
{
  "event_type": "tool_call",
  "work_order_id": "wo_abc123",
  "agent_id": "agent_xyz",
  "raw_payload": { ...cursor hook payload... }
}
```

All hooks are fire-and-forget with a 5s timeout (`chytr-stop.sh` uses 10s to allow validation). Failures are swallowed — hooks never block or break agent execution.

## Files installed

```
.cursor/
  hooks.json              # hook registrations
  hooks/
    chytr-log.sh          # generic log handler (all events except session/stop)
    chytr-session.sh      # SessionStart — logs + injects knowledge context
    chytr-stop.sh         # Stop — logs + surfaces followup_message if returned
```

## Permissions

The install script runs `chmod +x` on all hook scripts automatically. If installing manually, run:

```bash
chmod +x .cursor/hooks/chytr-log.sh
chmod +x .cursor/hooks/chytr-session.sh
chmod +x .cursor/hooks/chytr-stop.sh
```
