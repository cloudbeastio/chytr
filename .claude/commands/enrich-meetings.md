---
description: Run Meeting Enrichment (Phase 1) — reconcile Notion meeting notes against calendars + Maestro recaps. Fans out one sub-agent per day for multi-day backfills.
---

Run a Phase 1 reconciliation pass with the **`meeting-enrichment`** skill.

The skill's `.claude/skills/meeting-enrichment/SKILL.md` is the reasoning (the brain);
`reference/handoff.md` is the operational loop + exact field formats. This command is
the **orchestration layer** — it decides whether to run inline or fan out per day.

## 0. Determine scope

Read `$ARGUMENTS` for a date or date range (e.g. `June 2–7`, `2026-06-03`,
`last week`). If none given, default to **today** (hourly/daily incremental).

- Confirm the required MCP tools are available: Notion (`notion-search`,
  `notion-fetch`, `notion-update-page`), Calendar (`event_search_v0`), MS365
  (`outlook_email_search`, `read_resource`). If any are missing, load them via
  ToolSearch before dispatching — sub-agents inherit the same tool access.
- State the active mode at the top (daily backfill vs. hourly incremental) and the
  list of days you're about to process.

## 1. Backfill pass FIRST (if applicable)

If the runbook's backfill pass applies (notes already `Enriched` but missing
`Event ID` / `Calendar Source` / `Domain`), do that pass **once, inline, before**
fanning out — it spans days and shouldn't be split across agents. See
`reference/handoff.md` → "Backfill pass".

## 2. Single day → run inline

If the scope is **one day**, just run the per-note loop yourself (Direction A then
Direction B) per `SKILL.md` + `reference/handoff.md`. No sub-agents needed.

## 3. Multiple days → one sub-agent per day

If the scope is **more than one day**, spawn one sub-agent (Task tool,
`general-purpose`) **per day**. Run each sub-agent on **Sonnet** (`model: sonnet`),
not Opus — per-day enrichment is well-scoped, mechanical work, so Sonnet is the
right cost/latency trade-off; keep the Opus orchestrator only for dispatch and
aggregation. Days are independent — notes bucket by the local time in their title,
and each day's notes/events are disjoint — so this is safe to parallelize. Dispatch
in **batches of 3–4 concurrent agents** (multiple Task calls in one message) to
respect rate limits; process newest → oldest.

Give each sub-agent this prompt, substituting `{{DAY}}` (e.g. `2026-06-03`) and the
mode:

```
You are processing ONE day of a Meeting Enrichment Phase 1 backfill: {{DAY}}.

Authoritative spec — read both before doing anything:
- .claude/skills/meeting-enrichment/SKILL.md   (the reasoning / confidence rubric)
- .claude/skills/meeting-enrichment/reference/handoff.md   (per-note loop + exact
  field formats, incl. the __YES__ / __NO__ checkbox literals)

Scope — STRICT:
- Only process Meeting Notes whose TITLE local-time falls on {{DAY}}. Bucket by the
  title's local time, NOT raw createdTime (UTC shifts the apparent day). Use
  createdTime only when the title has no time.
- Direction A: for each note on {{DAY}} where `Enriched` is unchecked, match it to a
  calendar event (window = start − 30 min → + 90 min, both calendars), corroborate
  (Maestro recap when present, else note content), apply the confidence rubric, and
  write the fields. Proximity ALONE never backfills attendees. Always set
  `Enriched = __YES__` on completion (even on no-match) so the run stays idempotent.
- Direction B: scan {{DAY}}'s LumenData events with no matching note; recover from a
  Maestro recap if one exists; otherwise skip (no empty stubs). Cloudbeast misses
  get nothing.
- Do NOT touch any other day. Do NOT do Phase 2 (clustering / scoping).

Return ONLY a structured report for {{DAY}}:
- counts: High / Low / No match
- notes created from Maestro recaps (with titles)
- every `Needs Review = on` row: note title + its suggested calendar match
- any anomalies (ambiguous matches, missing tools, write failures)
```

## 4. Aggregate

Collect every sub-agent's report and emit a **combined run summary**:
- per-day and total counts of High / Low / No match
- all notes created from recaps
- a single merged **review queue** — every `Needs Review` row across all days with
  its suggested match (this is the human gate before going hourly)
- any failures, so they can be re-run for just that day

Do NOT do Phase 2 (clustering / scoping) — that's a separate, heavier-model job.

$ARGUMENTS
