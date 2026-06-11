# meeting-enrichment (agent skill)

Phase 1 of chytr's forward-deployed-engineer pipeline, packaged as a Claude Code
agent skill. It reconciles a Notion Meeting Notes database against combined
Google + MS365 calendars, backfills attendees and clean titles (confidence-gated),
recovers missed meetings from a transcription recap (Teams Maestro), and tags each
note with confidence / source / domain.

## Contents

| File | What it is |
|---|---|
| `SKILL.md` | The **brain** — the proven reasoning spec. Keep as-is. Auto-loaded when the skill triggers. |
| `reference/handoff.md` | Operational **runbook** — tools, per-note loop, field formats, backfill pass, day-by-day backlog. |
| `reference/feature-brief.md` | chytr **productization context** — config schema, `RecapSource` abstraction, work queue, telemetry, runner. Build the body around the skill; don't clone the reasoning into code. |

## How to invoke

Triggers on phrases like "enrich meetings", "reconcile meeting notes", "run meeting
enrichment", "backfill attendees", "pull the Maestro recaps", or via the
`/enrich-meetings` command.

## Required MCP tools

- **Notion** — Meeting Notes DB (`notion-search`, `notion-fetch`, `notion-update-page`)
- **Calendar** — `event_search_v0` (Google + MS365 in one call)
- **MS365** — `outlook_email_search` + `read_resource` (fetch Maestro recaps from
  `noreply@maestrolabs.com`)

## Principle

**chytr is the body; the skill is the brain.** Orchestration (schedule, queue,
connectors, config, telemetry) is code. The judgment steps — the confidence gate,
content corroboration, attendee resolution, domain inference — stay in the skill.
Freezing them into rules is exactly what makes the matcher brittle.
