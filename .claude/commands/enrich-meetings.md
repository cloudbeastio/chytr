---
description: Run Meeting Enrichment (Phase 1) — reconcile Notion meeting notes against calendars + Maestro recaps
---

Invoke the **`meeting-enrichment`** skill and run a Phase 1 reconciliation pass.

Follow the skill's `SKILL.md` for the reasoning and `reference/handoff.md` for the
operational loop and exact field formats. Before starting:

1. State the active mode (daily backfill vs. hourly incremental) at the top.
2. Confirm the required MCP tools are loaded: Notion (`notion-search`,
   `notion-fetch`, `notion-update-page`), Calendar (`event_search_v0`), and MS365
   (`outlook_email_search`, `read_resource`).
3. Query the work queue: Meeting Notes where `Enriched` is unchecked, oldest first.

Apply the confidence rubric exactly — proximity alone never backfills attendees.
Always set `Enriched` on completion (even on no-match) so runs stay idempotent.

End with the review queue: counts of High / Low / No match, notes created from
recaps, and every `Needs Review` row with its suggested match. Do NOT do Phase 2
(clustering / scoping).

$ARGUMENTS
