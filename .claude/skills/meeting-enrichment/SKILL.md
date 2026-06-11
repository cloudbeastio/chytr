---
name: meeting-enrichment
description: >
  Phase 1 of Joe's virtual forward-deployed-engineer pipeline: two-way
  reconciliation between the Notion Meeting Notes database and his combined
  Google + MS365 calendars, with the Teams Maestro recap as the authoritative
  bridge for LumenData meetings. Direction A matches each note to its real event
  and backfills attendees + a clean title, corroborated by the Maestro recap (not
  by whether attendees are named in Joe's own notes). Direction B scans LumenData
  events with no note, pulls the Maestro recap, and creates the note. Maestro
  recaps come from noreply@maestrolabs.com, subject starting "Summary:", ~10-60
  min after the meeting; the recap carries canonical title, attendee list, and
  action items. Runs daily first, then hourly. Trigger on "enrich meetings",
  "reconcile meeting notes", "run meeting enrichment", "phase 1", "backfill
  attendees", "pull the Maestro recaps", or on schedule. Does NOT scope work
  (Phase 2) or deploy agents (Phase 3).
compatibility: >
  Requires the Notion MCP (Meeting Notes DB), the calendar tools
  (calendar_search_v0, event_search_v0) spanning Google + MS365, and the MS365
  MCP (outlook_email_search + read_resource) to fetch Teams Maestro recaps from
  noreply@maestrolabs.com.
---

# Meeting Enrichment — Phase 1 (two-way reconciliation)

The first stage of the FDE pipeline. It produces clean, attributable meeting
records so Phase 2 (scoping) and Phase 3 (agent deployment) have trustworthy
signal. This skill ONLY reconciles and enriches. It proposes no backlog, scopes
nothing, deploys nothing.

## Why this design

Joe's notes are auto-created the moment his mic turns on — including **ad-hoc
calls never on his calendar**, and meetings whose notes never name the people he
met with (you don't write "I met with Nimish" in your own notes). Two facts drive
everything:

1. **A note's nearest calendar event is not proof.** Time alone mis-attributes.
2. **For LumenData meetings, the Teams Maestro recap is ground truth.** It
   carries the canonical meeting title, the real **attendee list**, action items
   with owners, and a structured summary. Use it to confirm the note↔event match
   and to source attendees — do NOT gate on whether attendees appear in Joe's
   note body. (Validated live: a 9:31 note that never said "Nimish" was confirmed
   as the Joe/Nimish sync purely by its Maestro recap, whose attendee block read
   "Joe Ondrejcka, Nimish Mehta.")

Meetings Joe **skipped produce no note** (no mic). They are recoverable only
calendar-first: find the event, fetch the recap, create the note.

## Field-tested realities (read before running)

Live backfills over June 8–10 and all of May confirmed the following, which change how you run this:

1. **Maestro recaps are sparse — content corroboration is the primary engine, not
   a fallback.** Only one of three days had recaps. So for most notes you will be
   matching note *content* against the calendar event (topic, distinctive names,
   companies), not against a recap. Treat the recap as a bonus when present; do
   not assume it exists.
2. **The `Attendees` person field is effectively dead.** No colleagues
   (Nimish, Aakash, GuidePoint, Salesforce reps, the offshore team) are users in
   this Notion workspace — a user search returns nothing. So in practice
   **everyone goes to `External Attendees`** and the person field stays empty.
   Don't waste calls trying to resolve people to Notion users; go straight to the
   text field.
3. **Bucket notes by the local time in the TITLE, not the raw `createdTime`.**
   Auto-titles read like `@Monday 8:13 AM (PDT)` / `@Today 9:31 AM (PDT)` and are
   the reliable local-time anchor. The raw `createdTime` is UTC and pushed at
   least one note's apparent date a day early (a June 8 "call with nate" surfaced
   under June 9). Parse the title's day + time first; use `createdTime` only when
   the title carries no time.
4. **A note's URL usually points at a child *transcript* page, not the database
   row.** The auto-created meeting note nests the transcript as a child page
   inside the real DB row, and casual links resolve to that child. After you
   `fetch`, check the `<ancestor-path>`: only a page whose parent is
   `parent-data-source` (the Meeting Notes collection) is the enrichable row.
   If you landed on a child, walk up to the parent row and write there — writing
   to the child silently no-ops the database properties.
5. **Empty "mic-on" stubs are real and come in duplicates.** A note whose body is
   only the blank template (`### Agenda … ### Notes …` with no transcript) is a
   false trigger or an abandoned recording; they frequently appear 2–3 times
   within a couple of minutes of each other. Do NOT churn them as Low/No-match
   review noise. Disposition: `Match Confidence = No match`, no attendees, and
   mark them VOID delete-candidates — set the title to `⨯ VOID — empty …`, record
   the reason in `Calendar Match`, and set `Needs Review = off` (the decision is
   "delete," not "investigate"). The Notion MCP has no hard-delete; VOID-titling
   lets a human bulk-delete them in the UI. An empty stub with no event is
   `Personal` unless its day/time clearly sits inside a work block.
6. **Maestro has a 5-meeting/day free-tier cap — a missing recap does NOT mean a
   non-Teams meeting.** Once Joe hits 5 recaps in a day, Maestro sends a
   "You've Hit Your 5-Meeting Limit" email from `maestrolabs.com` and silently
   stops recapping; the 6th+ Teams meeting then has no recap. So treat "no recap"
   as "no recap," not as evidence the meeting wasn't on Teams — fall back to
   content corroboration as usual, and note the cap when a clearly-Teams meeting
   has none.
7. **There is no single unified calendar tool in this environment.** Calendar
   access is split across two MCP servers — a Google server (`list_events` /
   `list_calendars`) and an MS365/Outlook server (`outlook_calendar_search`). You
   MUST query BOTH for every note. Judge `Calendar Source` by the event's
   link/ID (`meet.google.com`/`@google.com` → Google; `teams.microsoft.com`/MS365
   → Outlook), NOT by which server returned it — Google-Meet invites routinely
   surface in the Outlook search because Joe's MS365 account holds the invite.
   Also: `notion-query-meeting-notes` time-range filtering is unreliable
   (timezone/coverage gaps); prefer an orchestrator-side window query (operators
   `date_is_on_or_after` / `date_is_before`) and hand each agent an explicit,
   pre-bucketed note list rather than trusting a per-agent self-query.

## Operating modes
- **Daily backfill (start here):** run both directions over a trailing window,
  surface a review queue, keep until the matching is trusted.
- **Hourly incremental (after approval):** same logic, ~90-min trailing window.
State the active mode at the top of every run summary.

## The data
- Database: **Meeting Notes** — `collection://2ee070c1-91a8-8070-bf1e-000bff0519ef`
- Match anchor: parse the **local time in the note title** first
  (`@Monday 8:13 AM (PDT)`). Fall back to the system **`createdTime`** (full ISO,
  UTC) only when the title has no time. A note is created at mic-on ≈ meeting
  start. The **Date** property is date-only — never use it for time-of-day
  matching, and beware UTC `createdTime` shifting the apparent day.
- **Maestro recap source:** Outlook, from `noreply@maestrolabs.com`, subject
  starts with `Summary:`, received ~10-60 min after the meeting ends. The recap
  HTML contains an **Attendees** block (Maestro users marked with `*`), a
  Purpose, Takeaways, a Detailed summary, and Action items with owners.

### Properties read
`Meeting name` (title), `Summary` (text), `Category` (multi-select),
`Attendees` (person), `Projects` (relation), `createdTime` (system), page body.

### Properties written — add once if missing
| Property | Type | Purpose |
|---|---|---|
| `Enriched` | checkbox | Processed flag. Default off. |
| `External Attendees` | text | Non-Notion-user attendees. **Required** — see constraint. |
| `Attendance` | select | `Attended` · `Did Not Attend` · `Team Recap` |
| `Match Confidence` | select | `High` · `Low` · `No match` |
| `Calendar Match` | text | Matched event title + calendar, for audit. |
| `Event ID` | text | The matched calendar event's `event_id`, verbatim — links the note to the exact event. |
| `Calendar Source` | select | `Google` · `Outlook` — which system the event came from. |
| `Domain` | select | `LD` · `CB` · `Personal` — which business the meeting belongs to. |
| `Needs Review` | checkbox | On = a human must look before Phase 2 trusts it. |

> **Hard constraint.** Notion's `Attendees` property is type `person` and accepts
> only Notion **workspace user IDs**. In this workspace there are effectively no
> colleague users, so **write all attendees to `External Attendees`** as
> comma-separated `Name <email>` (email when known, name alone otherwise). Never
> silently drop an attendee. Only use the person field if a user search actually
> returns a match — which, in practice, it won't.

> **Source & Domain tagging.** On every match, also store:
> - `Event ID` = the matched event's `event_id`, copied verbatim (the durable link
>   back to the calendar event).
> - `Calendar Source` = `Google` if the event is on a Google calendar / has a
>   `meet.google.com` link / its `event_id` ends `@google.com`; `Outlook` if it's
>   a Teams meeting (`teams.microsoft.com`) or comes from the MS365/Exchange
>   account. (Note: the unified "Calendar" aggregates both, so judge by the
>   event's link/ID, not the calendar name.)
> - `Domain` = `LD` when attendees/content point to LumenData (lumendata.com,
>   salesforce.com, informatica, or LD clients like GuidePoint, ScanSource, the
>   offshore team); `CB` when they point to Cloudbeast (cloudbeast.io, Klabin,
>   Ricavvo, other CB clients, or chytr/MCP build work); `Personal` otherwise.
>   Domain is independent of Source — an LD meeting can land on a Google invite.

## Step 0 — One-time setup
Fetch the schema. Add any missing write-properties. Confirm `Enriched` defaults
off.

## Direction A — Notes → Calendar (Maestro-corroborated)

For each note where `Enriched` is off:

1. Read `createdTime` and the note's real in-body title/summary (ignore the
   `@Today HH:MM` placeholder). **If the body is only the blank template** (the
   `### Agenda … ### Notes …` skeleton with no transcript), treat it as an empty
   mic-on stub: `Match Confidence = No match`, no attendees, title `⨯ VOID — empty
   …`, reason in `Calendar Match`, `Needs Review = off`, `Enriched = on`, and stop
   — do not try to proximity-match it (see reality #5).
2. Pull events from **both** calendars in `createdTime − 30 min → +90 min`
   (Google/personal + `joe@cloudbeast.io`; MS365/LumenData calendar `Calendar`).
3. **If the best candidate is a LumenData event, fetch its Maestro recap**
   (`outlook_email_search` from `noreply@maestrolabs.com`, subject `Summary:`,
   received from event end to +90 min; then `read_resource` for the body).
   - Recap title/topic aligns with the note → **High**. Take attendees from the
     recap's Attendees block, split internal/external, write them. Replace a
     placeholder `Meeting name` with the recap title. Set `Attendance = Attended`
     (Joe is in the attendee list), `Match Confidence = High`, `Calendar Match`.
   - Recap exists but clearly describes a different meeting → keep looking / mark
     **Low**, `Needs Review = on`.
4. **No Maestro recap** (e.g. non-Teams or ad-hoc call): fall back to time +
   topic overlap with the calendar event. Only **High** if a distinctive
   name/company/topic is shared; otherwise **Low** + `Needs Review = on` and
   write no attendees. Proximity alone never backfills attendees.
5. **No event in window** → `Match Confidence = No match`, `Needs Review = on`.
6. Set `Enriched = on`.

> Do NOT require the attendee's name to appear in Joe's note text. The recap (or,
> failing that, the calendar event) is the attendee source. Gating on the note
> body produces false negatives — it would have wrongly flagged the Nimish sync.

## Direction B — Calendar → Notes (missed-meeting recovery)

For each **LumenData event with no matched note** from Direction A:

1. Treat as likely missed.
2. Fetch the Maestro recap (same search as above).
   - **Found** → create a Meeting Note: title from the recap, attendees split
     internal/external from the recap's Attendees block, paste Purpose +
     Takeaways + Detailed summary + Action items into the body under
     `## Team recap (Maestro)`, `Attendance = Team Recap`,
     `Match Confidence = High`, `Enriched = on`.
   - **Not found** → create a stub (title + attendees from the event + event
     link), `Attendance = Did Not Attend`, `Needs Review = on`, note "Maestro
     recap not found."
3. **Cloudbeast** events Joe missed get NO recovery (no recap stream). Skip.

## Review queue
End every run with counts of High / Low / No match, notes created from Maestro,
Maestro-not-found stubs, and a list of every `Needs Review = on` row with its
suggested match. This is the human gate before dropping to hourly.

## Guardrails
- Never write external emails into the `Attendees` person field.
- Never overwrite a `Summary` Joe wrote; only fill empties or append the recap
  under `## Team recap (Maestro)`.
- Attendees come from the recap (or calendar), never invented; proximity alone
  never backfills.
- Always set `Enriched = on` (even on no-match) so nothing loops; use
  `Needs Review` to resurface, not reprocessing.
- Create contacts/accounts? No. Reconcile notes and events only.
- Surface NO backlog/scoping/build output. That is Phase 2 / 3.

## Hand-off to Phase 2
An enriched note carries: recap-sourced attendees (internal + external), the
canonical title, project links, a real summary or recovered recap (with action
items + owners), an attendance flag, and a confidence/review state. Phase 2
consumes only `High`-confidence, non-flagged notes for theme clustering.

---

## Bundled reference

This skill ships with two supporting documents in `reference/`:

- [`reference/handoff.md`](reference/handoff.md) — the operational runbook: exact
  tools to load, the per-note loop, field formats (`__YES__`/`__NO__` checkbox
  literals), the backfill pass, and the day-by-day backlog. Read this when
  actually executing a run.
- [`reference/feature-brief.md`](reference/feature-brief.md) — the chytr
  productization context: how this skill becomes Phase 1 of the FDE pipeline
  (config schema, `RecapSource` abstraction, work queue, telemetry, runner).
  Read this when building chytr orchestration around the skill — **the skill is
  the brain; chytr is the body. Do not reimplement this reasoning as code.**
