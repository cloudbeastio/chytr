# chytr feature brief: Meeting Enrichment (Phase 1 of the FDE pipeline)

This describes the feature to scaffold in chytr, the architecture, and what to build
vs. leave alone. It is companion context to the `meeting-enrichment` skill:

- `SKILL.md` — the proven reasoning logic (the “brain”). Install/keep as-is.
- `reference/handoff.md` — the operational runbook + field formats.

## What this is

Meeting Enrichment is **Phase 1** of the forward-deployed-engineer pipeline chytr is
meant to host. It reconciles a client’s meeting notes (Notion today) against their
calendars, backfills attendees + clean titles, recovers missed meetings from a
transcription-recap source, and tags each note with confidence/source/domain. It is
also the ideal **first metered workload** for chytr’s usage-based billing: every run
has measurable tokens, tool calls, and minutes.

This was validated as customer-zero on Joe’s own data: 13 notes enriched across
June 8–10, zero invented attendees, with a confidence gate that correctly caught a
false match (a note that timestamp-matched the wrong meeting).

## Core architecture principle: chytr is the body, the skill is the brain

**chytr orchestrates the skill; it does NOT reimplement the logic as code.**

- **chytr owns the plumbing (build this):** schedule/trigger, the “unenriched” work
  queue, connector wiring (Notion + Google Calendar + Outlook + recap source),
  retries, per-client config, and the run/telemetry record.
- **Claude + the skill own the reasoning (do NOT harden into code):** the
  confidence gate (High/Low/No-match), content corroboration, attendee resolution,
  and domain inference. These judgment steps are exactly why it caught the bad match;
  freezing them into rules makes it brittle. chytr calls Claude-with-the-skill for the
  thinking and records the result.

## What to build in chytr

1. **Per-client config schema** — everything currently hard-wired to Joe must become
   config:
- Notion meeting-notes data source ID
- calendar accounts to pull (provider + credentials), combined by local time
- recap source: sender address + subject pattern + provider type
- domain taxonomy (e.g. LD/CB) with the email-domain + keyword rules for inference
- enrichment field names/options to write back
1. **Recap-source abstraction** — Joe uses Teams Maestro (`noreply@maestrolabs.com`,
   subject starts `Summary:`). Clients will use Otter / Fireflies / Gemini / Granola.
   Define a `RecapSource` interface (search window, match-by-title, fetch body) so the
   provider is pluggable. This is the main “productization” work.
1. **Work queue** — query notes where `Enriched = false`; process oldest first; mark
   `Enriched = true` on completion so runs are idempotent and resumable. Add a
   backfill mode (query `Enriched = true` AND a target field empty) for schema
   migrations.
1. **Run / telemetry record** — per run: client, mode (daily/hourly), notes seen /
   enriched / High / Low / No-match, notes created from recaps, tokens, tool calls,
   wall-clock minutes, and the review-queue list. This is the billing + audit
   substrate.
1. **Runner** — invokes Claude with the installed skill over the queued notes, passing
   the client config; persists results and telemetry.

## Field contract (what gets written per note)

`Enriched` (checkbox), `External Attendees` (text), `Attendance`
(Attended/Did Not Attend/Team Recap), `Match Confidence` (High/Low/No match),
`Calendar Match` (text), `Event ID` (text, verbatim), `Calendar Source`
(Google/Outlook), `Domain` (LD/CB/Personal), `Needs Review` (checkbox), `Meeting name`
(replace placeholder titles). Full formats in the handoff file.

## Three field-tested rules to bake into the orchestration

1. Bucket notes by the **local time in the note title**, not the raw UTC createdTime
   (UTC shifts the apparent day).
1. The Notion **person field is effectively dead** (no colleague users) — write all
   attendees to the text field.
1. **Recaps are sparse** — content corroboration is the primary matching engine, not
   a fallback. Don’t assume a recap exists.

## Sequencing guidance (important)

Do NOT freeze the logic into code yet. Keep the skill running as customer-zero on
Joe’s data until the spec is boring/stable (a couple of weeks). In parallel, scaffold
the chytr feature: config schema, queue, recap abstraction, telemetry record, runner.
Then point chytr’s runner at the proven skill. Productize the connectors and config;
leave the reasoning in the skill.

## Out of scope for this feature

Phase 2 (clustering enriched notes into a backlog) and Phase 3 (agent deployment).
Those are separate chytr features and should run on a heavier model. Phase 1 only
produces clean, attributable, tagged notes for them to consume.

## First tasks for chytr orchestration

1. Add `meeting-enrichment` to the repo as the reference spec. *(done — this skill)*
1. Define the per-client config schema and the `RecapSource` interface.
1. Scaffold the work queue + run/telemetry record (no live writes yet).
1. Stub the runner that loads a client config and invokes the skill.
   Leave the confidence/corroboration/domain logic in the skill — call it, don’t clone it.
