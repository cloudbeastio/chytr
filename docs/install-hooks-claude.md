# Install Claude Code hooks skill

The Claude Code hooks skill streams Claude Code agent actions to your chytr dashboard in real time — the Claude Code counterpart to the [Cursor hooks skill](./install-hooks.md).

## Install

Run this in the root of any repo where you want hooks active:

```bash
curl -fsSL https://raw.githubusercontent.com/cloudbeastio/chytr/main/packages/claude-hooks-skill/install.sh | bash
```

With the opt-in enforce gate (deny mutating tools until the session has an active chyt):

```bash
curl -fsSL https://raw.githubusercontent.com/cloudbeastio/chytr/main/packages/claude-hooks-skill/install.sh | bash -s -- --enforce
```

This creates:

```
.claude/
  settings.json                    # hook registrations (deep-merged into any existing file)
  hooks/
    chytr-claude-log.sh            # PostToolUse / SubagentStop / PreCompact logger
    chytr-claude-session.sh        # SessionStart — logging + knowledge injection + enforce auto-create
    chytr-claude-stop.sh           # Stop (per-turn) + SessionEnd (terminal — flips the chyt)
    chytr-claude-gate.sh           # PreToolUse enforce gate (opt-in, fail-open)
```

The installer is **non-destructive**: an existing `.claude/settings.json` is deep-merged (with `jq`), never overwritten, and re-runs are idempotent.

## Configure

Same env vars as the Cursor skill — set `CHYTR_URL` and `CHYTR_API_KEY` (shell, `.env.local` in the repo root, or CI env). Optional: `CHYT_ID` (legacy `WORK_ORDER_ID` honored) to scope events to a chyt, `CHYTR_REPO` to override repo auto-detection, `CHYTR_ENFORCE=1` for gate mode. If URL/key are unset, hooks exit silently.

Add `.chytr/` to your `.gitignore` — it holds per-session local state.

## Full reference

See the package README for the event mapping table, the Stop-vs-SessionEnd divergence (Claude's `Stop` fires every turn, so only `SessionEnd` sends the terminal `session_end`), and enforce-mode details:

[`packages/claude-hooks-skill/README.md`](../packages/claude-hooks-skill/README.md)

## Uninstall

```bash
rm -rf .claude/hooks/chytr-claude-*.sh .chytr
# then remove the chytr entries from .claude/settings.json's "hooks" block
```
