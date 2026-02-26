# Install hooks skill

The hooks skill streams Cursor agent actions to your chytr dashboard in real time.

## Install

Run this in the root of any repo where you want hooks active:

```bash
curl -sL https://raw.githubusercontent.com/cloudbeastio/chytr/main/packages/hooks-skill/install.sh | bash
```

This creates:
```
.cursor/
  hooks.json           # registers all 11 hooks with Cursor
  hooks/
    chytr-log.sh       # generic event logger
    chytr-session.sh   # session start + knowledge injection
    chytr-stop.sh      # session end + DoD validation
```

## Configure

Set these env vars in your shell profile or `.env`:

```bash
export CHYTR_URL=https://your-supabase-url.supabase.co
export CHYTR_SERVICE_KEY=your-service-role-key
```

These are your **self-hosted Supabase** URL and service role key (not anon key).

## Pass work order ID

To link agent sessions to a work order, set:

```bash
export WORK_ORDER_ID=uuid-of-the-work-order
```

This is automatically set when launching via the chytr dashboard. For local dev sessions, either set manually or let chytr auto-create a local work order on `sessionStart`.

## Hooks that are installed

| Hook | Event | What it does |
|---|---|---|
| chytr-session | SessionStart | Logs session start, injects knowledge context |
| chytr-log-tool | PostToolUse | Logs tool name, args, duration, success |
| chytr-log-tool-fail | PostToolUseFailure | Logs tool errors |
| chytr-log-shell | AfterShellExecution | Logs shell command + exit code |
| chytr-log-file | AfterFileEdit | Logs file path + lines changed |
| chytr-log-mcp | AfterMCPExecution | Logs MCP server + tool + result |
| chytr-log-thought | AfterAgentThought | Logs agent reasoning (previewed) |
| chytr-log-response | AfterAgentResponse | Logs agent message content |
| chytr-log-subagent-start | SubagentStart | Tracks subagent spawning |
| chytr-log-subagent-stop | SubagentStop | Tracks subagent completion |
| chytr-stop | Stop | Logs session end, checks DoD |

## Failure handling

All hooks are designed to never break agent execution:
- `curl` calls have a 5-second timeout
- All errors are swallowed silently
- Hooks exit 0 regardless of chytr availability

## Uninstall

```bash
rm -rf .cursor/hooks.json .cursor/hooks/chytr-*.sh
```
