# chytr Claude Code hooks skill

Claude Code hooks that POST structured log events to a chytr instance — the Claude Code port of the [Cursor hooks skill](../hooks-skill/README.md). Every shell execution, file edit, MCP call, subagent completion, compaction, and session boundary gets captured — tied to a chyt (work order) ID for full traceability. Plus an **opt-in enforce mode** that refuses mutating tool calls until the session has an active chyt.

## Install

From the root of any repo:

```bash
curl -fsSL https://raw.githubusercontent.com/cloudbeastio/chytr/main/packages/claude-hooks-skill/install.sh | bash
```

With enforce mode enabled:

```bash
curl -fsSL https://raw.githubusercontent.com/cloudbeastio/chytr/main/packages/claude-hooks-skill/install.sh | bash -s -- --enforce
```

Or clone and run locally:

```bash
bash packages/claude-hooks-skill/install.sh [target-dir] [--enforce]
```

This downloads the four hook scripts into `.claude/hooks/` and wires them into `.claude/settings.json` — **non-destructively**: if a `settings.json` already exists, its hook arrays are deep-merged (existing hooks preserved, chytr hooks appended). If `jq` isn't available for a safe merge, the config is written to `.claude/settings.chytr.json` for you to merge manually. Re-running the installer is idempotent (it detects an existing install and skips the merge).

Add `.chytr/` to your `.gitignore` — it holds per-session local state (`current_chyt`, `enforce`), not repo content.

## Event mapping (Claude Code → chytr)

| Claude Code hook event | Matcher | `event_type` sent | Script |
|---|---|---|---|
| `SessionStart` | — | `session_start` (+ knowledge injection) | `chytr-claude-session.sh` |
| `PreToolUse` | `Bash\|Edit\|Write\|MultiEdit\|NotebookEdit\|mcp__.*` | *(no event — enforcement gate)* | `chytr-claude-gate.sh` |
| `PostToolUse` (tool = `Bash`) | same | `shell_execution` | `chytr-claude-log.sh` |
| `PostToolUse` (tool = `Edit`/`Write`/`MultiEdit`/`NotebookEdit`) | same | `file_edit` | `chytr-claude-log.sh` |
| `PostToolUse` (tool = `mcp__*`) | same | `mcp_execution` | `chytr-claude-log.sh` |
| `PostToolUse` (any other tool) | same | `tool_call` | `chytr-claude-log.sh` |
| `PostToolUse` (tool_response carries an error) | same | `tool_failure` | `chytr-claude-log.sh` |
| `SubagentStop` | — | `subagent_stop` | `chytr-claude-log.sh subagent_stop` |
| `PreCompact` | — | `pre_compact` | `chytr-claude-log.sh pre_compact` |
| `Stop` | — | `stop` | `chytr-claude-stop.sh stop` |
| `SessionEnd` | — | `session_end` (terminal) | `chytr-claude-stop.sh session_end` |

### Stop vs. SessionEnd — an important divergence from the Cursor hooks

chytr's ingest endpoint treats `event_type: session_end` as **terminal**: it flips the chyt to `completed`/`failed`. In Cursor, `Stop` fires once at session end, so the Cursor skill sends `session_end` from its stop hook. In Claude Code, **`Stop` fires at the end of every turn** — sending `session_end` there would close the chyt after the first response. So this skill sends the non-terminal `stop` event on `Stop` (and surfaces any `followup_message` the server returns as a continuation, via `{"decision":"block","reason":...}` — the definition-of-done loop-back), and only `SessionEnd` sends the terminal `session_end`, which also clears `.chytr/current_chyt`.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `CHYTR_URL` or `CHYTR_PUBLIC_URL` | Yes | App base URL (e.g. `https://app.chytr.ai` or `http://localhost:3000`) — events POST to `{URL}/api/v1/ingest` |
| `CHYTR_API_KEY` | Yes | API key from chytr **Settings → API Keys** — Bearer auth for `/api/v1/ingest`, `/api/v1/chyts`, and `/api/v1/knowledge/query` |
| `CHYT_ID` | Optional | ID of the active chyt — scopes all events to a task. Legacy `WORK_ORDER_ID` is also honored. A `.chytr/current_chyt` file (written by enforce mode) is the third fallback |
| `CHYTR_AGENT_ID` | Optional | Agent identifier — useful when running multiple agents |
| `CHYTR_REPO` | Optional | Override repo URL — auto-detected from `git remote get-url origin` if unset |
| `CHYTR_ENFORCE` | Optional | `1` enables enforce mode (equivalent to a `.chytr/enforce` file) |

Hooks auto-source `.env.local` from the project root (`CLAUDE_PROJECT_DIR`) when `CHYTR_API_KEY` isn't already set. If `CHYTR_URL`/`CHYTR_PUBLIC_URL` or `CHYTR_API_KEY` are unset, all hooks exit silently — no errors, no noise.

## Enforce mode (opt-in)

Off by default — without it, the hooks are pure passive logging. Enable it with `CHYTR_ENFORCE=1` or by creating a `.chytr/enforce` file (the installer's `--enforce` flag does this). When active:

- **SessionStart auto-creates a chyt** if none resolves: `POST /api/v1/chyts` with `{"objective": "Claude Code session <id> in <repo>", "source": "local", "metadata": {"created_by": "claude-hooks-skill", ...}}`. A `source: local` chyt never launches an agent — it exists purely to scope this session's logs. The returned `chyt_id` is pinned to `.chytr/current_chyt` so every subsequent hook in the session picks it up.
- **PreToolUse denies mutating tools** (`Bash`, `Edit`, `Write`, `MultiEdit`, `NotebookEdit`, any `mcp__*`) while no chyt id resolves, with a deny reason telling the agent exactly how to create one.
- **Fail-open by design:** if chytr is unreachable or `jq`/state can't be read, tools are **allowed** — enforcement must never brick a session when the logging backend is down.
- `SessionEnd` deletes `.chytr/current_chyt`, so each session gets its own chyt.

## How chyt IDs work

Set `CHYT_ID` (or legacy `WORK_ORDER_ID`) before starting a session to tie every log event to a specific chyt. On `SessionStart`, the skill queries `GET /api/v1/knowledge/query?chyt_id=<id>` and injects any returned knowledge into the session as `additionalContext` — so the agent picks up where the last run left off. On `Stop`, the ingest endpoint can return a `followup_message`, which is fed back to Claude as a continuation prompt.

## Payload structure

Every event POSTs to `POST /api/v1/ingest`:

```json
{
  "event_type": "shell_execution",
  "chyt_id": "wo_abc123",
  "agent_id": "agent_xyz",
  "source_repo": "https://github.com/your-org/your-repo",
  "raw_payload": { ...claude code hook stdin JSON... }
}
```

`raw_payload` is the full JSON Claude Code passes to the hook on stdin (`hook_event_name`, `session_id`, `cwd`, `tool_name`, `tool_input`, `tool_response`, …). All hooks are fire-and-forget with a 5s timeout (`chytr-claude-stop.sh` uses 10s to allow DoD validation) and always exit 0 — they never block or break agent execution.

## Files installed

```
.claude/
  settings.json                    # hook registrations (merged, not overwritten)
  hooks/
    chytr-claude-log.sh            # PostToolUse / SubagentStop / PreCompact logger
    chytr-claude-session.sh        # SessionStart — logs, enforce auto-create, knowledge injection
    chytr-claude-stop.sh           # Stop (per-turn) + SessionEnd (terminal)
    chytr-claude-gate.sh           # PreToolUse enforce gate (opt-in, fail-open)
.chytr/                            # local state — gitignore this
  current_chyt                     # active chyt id for this session (enforce mode writes it)
  enforce                          # presence enables enforce mode
```

## Requirements

`bash`, `curl`, and `git` (for repo auto-detection). `jq` is strongly recommended — without it, PostToolUse event-type derivation falls back to `tool_call`, enforce-mode auto-create is skipped, and settings merges are manual.
