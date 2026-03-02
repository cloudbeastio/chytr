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

You need two env vars to stream logs. Get your API key from **Settings → API Keys** in the chytr dashboard.

### Option A: Local `.env.local` (for local Cursor sessions)

Create `.env.local` in your repo root:

```bash
CHYTR_URL=https://app.chytr.ai        # or http://localhost:3000 for self-hosted
CHYTR_API_KEY=chk_your_api_key_here
```

Hooks auto-source `.env.local` from the project root when env vars aren't already set.

### Option B: Cursor Cloud Agent settings (for cloud agents)

When launching agents via Cursor Cloud or the chytr dashboard, set env vars in your Cursor Cloud Agent configuration:

```
CHYTR_URL=https://app.chytr.ai
CHYTR_API_KEY=chk_your_api_key_here
WORK_ORDER_ID=<auto-set by chytr when launching from dashboard>
```

These get injected into the agent's environment so hooks can stream logs back to your dashboard.

### Option C: Shell / CI environment

```bash
export CHYTR_URL=https://app.chytr.ai
export CHYTR_API_KEY=chk_your_api_key_here
```

## Repo tracking

Hooks auto-detect the git remote (`git remote get-url origin`) and send it with every log event. Logs are grouped by repo in the dashboard — no extra config needed.

To override the detected repo (e.g. in CI or forks):

```bash
export CHYTR_REPO=https://github.com/your-org/your-repo
```

## Pass work order ID

To link agent sessions to a work order, set:

```bash
export WORK_ORDER_ID=uuid-of-the-work-order
```

This is automatically set when launching via the chytr dashboard. For local dev sessions, set manually or omit — logs still stream and are grouped by repo.

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
