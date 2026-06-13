# Meeting Enrichment — operational runbook (Phase 1)

The operational summary for the **`meeting-enrichment`** skill; SKILL.md is the full
spec. For each un-enriched note in the **Meeting Notes** database, match it to the real
calendar event, backfill attendees + a clean title, and write enrichment fields back.
Confidence-gated: only write attendees when note content (or a Maestro recap)
corroborates the match. Flag conflicts/ad-hoc calls for review instead of guessing.

## Database & work queue

- Meeting Notes data source: `collection://2ee070c1-91a8-8070-bf1e-000bff0519ef`
- The work queue is notes where **`Enriched` is unchecked**. This is idempotent —
  finished notes are flagged, so just pull unenriched and go. **Never reprocess
  anything already marked `Enriched`** (unless it's missing `Event ID`/`Calendar
  Source`/`Domain`, in which case backfill only those three).

## Allocation (how the orchestrator fans out)

- **Direction A: 5 notes per sub-agent**, on Sonnet, in batches of 3–4 concurrent.
  Small chunks stay well under the context ceiling (a single agent overflows ~25+
  heavily-transcribed notes → "Prompt is too long") and make crash recovery cheap.
- Hand each agent its **explicit** list of ≤5 note URLs + createdTime + local day —
  never have it self-query (`notion-query-meeting-notes` is unreliable for time and
  only returns Joe-attended/created notes, so it can't even see Direction-B recap
  notes). The orchestrator builds the queue via windowed queries and chunks it.
- **Direction B runs as a separate per-day sweep** after Direction A (it's
  calendar-driven, not note-chunked).
- Agents are idempotent (skip already-`Enriched` rows), so a crashed/suspended agent
  is recovered by re-launching its chunk — no duplicates. Detect a dead agent by the
  real transcript mtime (`…/subagents/agent-<id>.jsonl`), not the 116-byte `.output`
  symlink.

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
> (timezone/coverage gaps), and it only returns notes where Joe is attendee or
> creator — so it will NOT show agent-created Direction-B recap notes. Prefer an
> orchestrator-side window query and hand each agent an explicit, pre-bucketed
> note list; treat any per-agent self-query as a backstop only (operators:
> `date_is_on_or_after` / `date_is_before`).
> **Scale & context.** A single Sonnet agent overflows its context around ~25+
> heavily-transcribed notes (seen live: a 29-note week died with "Prompt is too
> long" at note 22). That's why Direction A is chunked at **5 notes per agent** and
> agents are told NOT to read the giant `<transcript>` bodies — properties + summary
> + in-body title are enough to match. Agents are idempotent (skip already-`Enriched`
> rows), so a re-run after a crash/suspend resumes cleanly and creates no duplicates.

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
Event ID:          "<event_id copied verbatim from the matched calendar event>"
Calendar Source:   "Google" | "Outlook"   (Google = meet.google.com / @google.com / Google cal; Outlook = teams.microsoft.com / MS365)
Domain:            "LD" | "CB" | "Personal"   (LD = lumendata/salesforce/GuidePoint/ScanSource/offshore; CB = cloudbeast/Klabin/Ricavvo/chytr; else Personal)
Needs Review:      __YES__ | __NO__
Meeting name:      replace ‣/@Today/@Monday placeholders with the real title
                   (prefer the in-body note title; else the calendar/recap title)
```

## Per-note loop

1. Read the note’s title-time → determine the day + local start time.
1. `notion-fetch` the note → resolve the parent DB row; read its in-body title +
   summary/content. **Do NOT read the `<transcript>` body** (it can be 100k chars and
   blow context — properties + summary + title are enough).
1. Query **both** calendars (`list_events` + `outlook_calendar_search`) for that day,
   window = start − 30 min → + 90 min.
1. If the best candidate is a LumenData event, `outlook_email_search` for a Maestro
   recap (sender `noreply@maestrolabs.com`, subject `Summary:`, end → +90 min) and
   `read_resource` it.
1. Apply the rubric → write the fields. Set `Enriched = __YES__`.

## Direction B (missed meetings) — separate per-day sweep

After Direction A, run Direction B as its own pass (calendar-driven, one Sonnet agent
per day or a few days each). For each day, scan its **LumenData calendar events with no
matching note**. If a Maestro recap exists, create a note from it (`Attendance = Team
Recap`, attendees from the recap, paste it under `## Team recap (Maestro)`,
`Match Confidence = High`, `Enriched = __YES__`). If not, skip (don’t create empty
stubs). Cloudbeast/Personal misses get nothing. Dedupe against notes already present —
including ones just created — because the recap notes have Joe as neither attendee nor
creator and won't appear in `notion-query-meeting-notes`.

## Optional: field-backfill pass

If schema fields were added after some notes were enriched (e.g. a note is `Enriched`
but missing `Event ID` / `Calendar Source` / `Domain`), fold the fix into the per-note
loop: when a chunk agent fetches an already-`Enriched` note that's missing any of those
three, it re-matches the calendar event (using the existing `Calendar Match` text as a
guide) and fills in **only** those three fields, leaving everything else.

## Dedupe sweep

After Direction B, confirm no duplicate recap notes (a crashed agent that partially
persisted plus its re-run). `notion-search` the data source on **distinctive**
Direction-B titles — each should return one note per date. Recurring titles (e.g.
"Weekly Event Marketing Sync") legitimately recur; only a **same-date** pair is a true
duplicate. Void any duplicate.

## End-of-run

Report: total counts of High / Low / No match / VOID, any notes created from Maestro,
and a single merged review queue — every `Needs Review` row with its suggested match.
That review queue is the gate before this ever goes hourly. Do NOT do Phase 2
(clustering/scoping) — that’s a separate, heavier-model job.
