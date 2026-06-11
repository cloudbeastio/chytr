# Handoff: Meeting Enrichment backfill — June 2–7 (Phase 1)

You are taking over a Notion Meeting Notes enrichment backfill, already running and
~13 notes deep (June 8–10 done). Follow the installed **`meeting-enrichment`**
skill. This prompt is the operational summary; the SKILL.md is the full spec.

## What you’re doing

For each un-enriched note in the **Meeting Notes** database, match it to the real
calendar event, backfill attendees + a clean title, and write enrichment fields
back. Confidence-gated: only write attendees when note content corroborates the
match. Flag conflicts/ad-hoc calls for review instead of guessing.

## Database

- Meeting Notes data source: `collection://2ee070c1-91a8-8070-bf1e-000bff0519ef`
- Query for work: notes where **`Enriched` is unchecked**. This is idempotent —
  finished notes are flagged, so just pull unenriched and go. **Do not reprocess
  anything already marked Enriched.**

## Tools you need (load via tool_search if deferred)

- Notion: `notion-search`, `notion-fetch`, `notion-update-page`,
  `notion-query-meeting-notes`
- Calendar — **two separate servers; query BOTH** (there is no unified
  `event_search_v0` here): a Google server (`list_events` + `list_calendars`) and
  an MS365/Outlook server (`outlook_calendar_search`). Judge `Calendar Source` by
  the event link/ID, not by which server returned it (Google-Meet invites surface
  in the Outlook search too).
- MS365: `outlook_email_search` + `read_resource` (for Maestro recaps)

> **Note resolution.** A note URL usually resolves to a child *transcript* page,
> not the DB row. After `fetch`, walk the `<ancestor-path>` up to the page whose
> parent is `parent-data-source` and write there — writing to the child no-ops the
> properties. Use `notion-search` to find the row if needed.
> **Querying.** `notion-query-meeting-notes` time-range filtering is unreliable
> (timezone/coverage gaps). Prefer an orchestrator-side window query and hand each
> agent an explicit, pre-bucketed note list; treat any per-agent self-query as a
> backstop only (operators: `date_is_on_or_after` / `date_is_before`).

## The three hard-won rules (these matter)

1. **Bucket by the note TITLE’s local time** (`@Last Wednesday 9:30 AM (PDT)`),
   NOT the raw `createdTime` (UTC — it shifts the day). Use createdTime only if
   the title has no time.
1. **The person field is dead** — no colleagues are Notion users. Write ALL
   attendees to **`External Attendees`** as text (`Name <email>`); leave the
   person `Attendees` field alone.
1. **Maestro recaps are sparse.** They come from `noreply@maestrolabs.com`,
   subject starts `Summary:`, ~10–60 min after a LumenData meeting, and carry the
   true title + attendee block. Most days have none — so corroborate against note
   **content** (distinctive names, companies, topics) vs. the calendar event.
   Recap = bonus when present, not a dependency.

## Confidence rubric (the part to get right)

- **High**: a distinctive name/company/topic in the note also appears in the
  calendar event (title/attendees) or a Maestro recap. Write attendees from the
  calendar event (or recap). Replace placeholder titles with the real one.
- **Low**: nearest event exists but content doesn’t corroborate → write NO
  attendees, set `Needs Review = on`, record the candidate in `Calendar Match` as
  a suggestion.
- **No match**: no event in the time window (genuine ad-hoc call) → `Needs Review = on`. If the note itself clearly names its participants (e.g. a 1:1), you may
  record them in External Attendees and leave Needs Review off.
- **Empty stub (VOID)**: body is only the blank `### Agenda … ### Notes …`
  template (a mic-on false trigger; often 2–3 dupes within minutes). Do NOT
  proximity-match or push to the review queue. Set `Match Confidence = No match`,
  no attendees, title `⨯ VOID — empty …`, reason in `Calendar Match`,
  `Needs Review = off`, `Enriched = on`. Domain `Personal` unless the slot clearly
  sits in a work block. (No hard-delete in the MCP — VOID-titling lets a human
  bulk-delete in the UI.)
- Proximity alone NEVER backfills attendees. A blank field is recoverable; a
  wrong one corrupts Phase 2.
- A missing Maestro recap is NOT proof a meeting wasn't on Teams: Maestro's
  free tier caps at **5 recaps/day** (it emails a "5-Meeting Limit" notice from
  `maestrolabs.com`, then goes silent). On busy days the 6th+ Teams meeting has no
  recap — fall back to content corroboration and note the cap.

## Fields to write (via notion-update-page → update_properties)

Checkboxes use the literal string `__YES__` / `__NO__`.

```
Enriched:          __YES__            (always, even on no-match, so it won't loop)
External Attendees: "Name <email>, Name <email>"
Attendance:        "Attended" | "Did Not Attend" | "Team Recap"
Match Confidence:  "High" | "Low" | "No match"
Calendar Match:    "<event title> · <calendar> — <note on corroboration>"
Event ID:          "<event_id copied verbatim from event_search_v0>"
Calendar Source:   "Google" | "Outlook"   (Google = meet.google.com / @google.com / Google cal; Outlook = teams.microsoft.com / MS365)
Domain:            "LD" | "CB" | "Personal"   (LD = lumendata/salesforce/GuidePoint/ScanSource/offshore; CB = cloudbeast/Klabin/Ricavvo/chytr; else Personal)
Needs Review:      __YES__ | __NO__
Meeting name:      replace ‣/@Today/@Monday placeholders with the real title
                   (prefer the in-body note title; else the calendar/recap title)
```

## Per-note loop

1. Read the note’s title-time → determine the day + local start time.
1. `notion-fetch` the note for its in-body title + summary/content.
1. `event_search_v0` for that day (both calendars), window = start − 30 min → + 90 min.
1. If the best candidate is a LumenData event, optionally `outlook_email_search`
   for a Maestro recap (end → +90 min) and `read_resource` it.
1. Apply the rubric → write the fields. Set `Enriched = __YES__`.

## Direction B (missed meetings)

After the notes are done for a day, scan that day’s **LumenData calendar events
that have no matching note**. If a Maestro recap exists, create a note from it
(`Attendance = Team Recap`, paste recap under `## Team recap (Maestro)`). If not,
skip (don’t create empty stubs). Cloudbeast misses get nothing.

## Backfill pass (do this FIRST, before June 7→2)

The June 8–10 notes are already enriched, but the ones from **June 9 and June 10
are missing `Event ID`, `Calendar Source`, and `Domain`** (those fields were added
after they were processed; June 8 is already backfilled). So:

1. Query notes where `Enriched` is checked AND `Event ID` is empty.
1. For each, re-pull that day’s calendar (`event_search_v0`), re-match to the
   event (you can use the existing `Calendar Match` text as a guide), and fill in
   `Event ID`, `Calendar Source`, `Domain`. Don’t change the other fields.
   This is ~10 notes (June 9 ×6, June 10 ×4). Then proceed to the new days below.

## Days remaining (process newest → oldest)

- **June 7** (Sunday — almost certainly empty; confirm and move on)
- **June 6** — ~1 note (“New meeting”)
- **June 5** — ~2–3 notes (two `@Last Friday 7:34 AM`, a “New meeting”)
- **June 4** — ~2 notes (`@Last Thursday 8:02 AM`, `1:30 PM`)
- **June 3** — ~5 notes (incl. `@Last Wednesday 10:00 AM LeverEdge - Budget Review`,
  7:29 AM, 9:30 AM, 12:05 PM, a “New meeting”)
- **June 2** — ~1 note (“New meeting”)
  NOTE: the earlier search capped at 25 results — after June 2, re-query unenriched
  to catch anything older that wasn’t listed.

## End-of-run

Per day, report: counts of High / Low / No match, any notes created from Maestro,
and every `Needs Review` row with its suggested match. That review queue is the
gate before this ever goes hourly. Do NOT do Phase 2 (clustering/scoping) — that’s
a separate, heavier-model job.
