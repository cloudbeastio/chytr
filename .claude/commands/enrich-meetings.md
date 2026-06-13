---
description: Run Meeting Enrichment (Phase 1) — reconcile Notion meeting notes against calendars + Maestro recaps. Pulls the unenriched work queue and fans out Sonnet sub-agents, 5 notes each.
---

Run a Phase 1 reconciliation pass with the **`meeting-enrichment`** skill.

The skill's `.claude/skills/meeting-enrichment/SKILL.md` is the reasoning (the brain);
`reference/handoff.md` is the operational loop + exact field formats. This command is
the **orchestration layer** — it builds the work queue and fans it out.

**Core model:** the work queue is every Meeting Note where **`Enriched` is unchecked**.
Pull that queue, then **allocate 5 notes per sub-agent** (Direction A), running each
on **Sonnet**. The Opus orchestrator only builds the queue, dispatches, recovers
failures, dedupes, and aggregates. `Enriched` is the idempotency flag — finished
notes are skipped forever, so the same trigger is safe to re-run.

## 0. Scope + tools

Read `$ARGUMENTS` for an optional date range (e.g. `June 2–7`, `last week`). With no
argument, the scope is **all unenriched notes** (steady-state / hourly: this is just
"today's new notes" because everything older is already `Enriched`). State the active
mode at the top (one-shot backfill vs. hourly incremental).

Confirm/load these MCP tools via ToolSearch (sub-agents must load them too — pass the
exact names). **There is no unified `event_search_v0` in this environment** — calendar
access is split across two servers:
- Notion: `notion-search`, `notion-fetch`, `notion-update-page`, `notion-query-meeting-notes`
- Google Calendar: `list_events`, `list_calendars` (personal + joe@cloudbeast.io)
- MS365/Outlook: `outlook_calendar_search` (LumenData/Teams), `outlook_email_search` + `read_resource` (Maestro recaps)

## 1. Build the work queue (orchestrator-side)

Query the Meeting Notes data source (`collection://2ee070c1-91a8-8070-bf1e-000bff0519ef`)
for notes with `Enriched` unchecked, bounded by the scope range if given. For a dated
backfill, query in **windows** (operators `date_is_on_or_after` / `date_is_before`,
`time_zone: America/Los_Angeles`) — `notion-query-meeting-notes` time-filtering is
flaky and only returns notes where Joe is attendee/creator, so query per-week-ish
windows and assemble the list yourself rather than trusting one big self-query.

For each note capture: **URL, `createdTime` (UTC), and the local-time day**. Bucket by
the **local time in the TITLE** (`@Monday 8:13 AM (PDT)`); fall back to `createdTime`
when the title has no time. **Mind the timezone**: PST = UTC−8 (Nov–early Mar), PDT =
UTC−7 (mid-Mar–early Nov); DST flips ~Mar 8 / Nov 1. UTC `createdTime` can shift a
note's apparent day — convert with the correct offset.

Process **newest → oldest**.

## 2. Direction A — allocate 5 notes per sub-agent

Chunk the queue into groups of **5 notes** (a chunk may span days — that's fine,
Direction A is per-note). Spawn one `general-purpose` sub-agent **per chunk** on
**Sonnet** (`model: sonnet`). Dispatch in **batches of 3–4 concurrent agents**
(multiple Task calls in one message) to respect rate limits.

5-note chunks are deliberately small: they stay far under the context ceiling (a
single agent overflows ~25+ heavily-transcribed notes → "Prompt is too long") and make
crash recovery cheap. Hand each agent its **explicit list** of ≤5 note URLs +
createdTime + local day — never have it self-query.

Give each sub-agent this prompt (substitute the note list + mode):

```
You are enriching a small batch of Meeting Notes — Phase 1, Direction A. Process ONLY
the notes listed below.

Authoritative spec — read both first:
- .claude/skills/meeting-enrichment/SKILL.md            (reasoning / confidence rubric)
- .claude/skills/meeting-enrichment/reference/handoff.md (per-note loop, field formats,
  __YES__/__NO__ literals)

Load these deferred tools via ToolSearch `select:`: notion-fetch, notion-update-page,
notion-search, list_events, list_calendars, outlook_calendar_search,
outlook_email_search, read_resource (full mcp__… names provided by the orchestrator).

NO unified event_search_v0 — query BOTH Google (list_events) and Outlook
(outlook_calendar_search) for every note; judge Calendar Source by the event link/ID
(meet.google.com/@google.com → Google; teams.microsoft.com/MS365 → Outlook), not by
which server returned it. timeZone America/Los_Angeles.

CONTEXT DISCIPLINE: do NOT read the giant <transcript> bodies — notion-fetch returns
properties + summary + in-body title, which is enough to match. Never view a transcript.

NOTES (createdTime UTC → local; PST=UTC−8 before ~Mar 8, PDT=UTC−7 after):
  {{5 NOTE URLs WITH TITLE + createdTime + local day}}

For EACH note:
1. notion-fetch → resolve the parent DB row (a note URL usually points at a CHILD
   transcript page; write to the page whose parent is parent-data-source — use
   notion-search if needed). IDEMPOTENT: if already Enriched WITH Event ID + Calendar
   Source + Domain → skip; if Enriched but missing any of those three → backfill only
   those; else full loop.
2. EMPTY STUB? If the body is only the blank "### Agenda … ### Notes …" template
   (mic-on false trigger, often duplicated): Match Confidence = No match, no attendees,
   Meeting name = "⨯ VOID — empty …", reason in Calendar Match, Needs Review = __NO__,
   Enriched = __YES__, Domain = Personal unless clearly in a work block. Stop.
3. Pull BOTH calendars in window = local start − 30 min → + 90 min.
4. If the best candidate is a LumenData event, fetch its Maestro recap
   (outlook_email_search sender noreply@maestrolabs.com, subject "Summary:", received
   event-end → +90 min; read_resource the body). The recap Attendees block is the
   canonical attendee source. (A missing recap is NOT proof it wasn't a Teams meeting —
   Maestro free tier caps at 5 recaps/day, then goes silent. Fall back to content.)
5. Apply the rubric → write fields, Enriched = __YES__:
   - High: distinctive shared name/company/topic between note and event/recap → write
     attendees (recap, else event) to External Attendees as "Name <email>"; replace a
     placeholder Meeting name with the real title.
   - Low: nearest event but no corroboration → NO attendees, Needs Review = __YES__,
     candidate in Calendar Match.
   - No match: no event in window → Needs Review = __YES__ (a clearly self-named 1:1
     may be filled and left unflagged).
   - Proximity ALONE never backfills attendees. ALL attendees go to the External
     Attendees TEXT field (the person Attendees field is dead). Never overwrite a
     Summary Joe wrote.
   Fields: Enriched, External Attendees, Attendance (Attended|Did Not Attend|Team Recap),
   Match Confidence (High|Low|No match), Calendar Match ("<title> · <Google|Outlook> —
   <note>"), Event ID (verbatim), Calendar Source (Google|Outlook), Domain (LD|CB|
   Personal: LD=lumendata/salesforce/informatica/GuidePoint/ScanSource/offshore;
   CB=cloudbeast/Klabin/Ricavvo/LeverEdge/chytr/MCP; else Personal), Needs Review,
   Meeting name.

Do NOT do Direction B and do NOT do Phase 2. Return a compact report: per note
day·title→confidence→Domain/Source; every Needs Review row; VOID stubs; anomalies.
```

## 3. Direction B — missed-meeting recovery (per-day sweep)

Direction B is calendar-driven, not note-chunked, so run it **after** Direction A as a
separate sweep over the covered date range — one Sonnet agent per day (or a few days
each, ≤~5 days). Each agent: scan that day's **LumenData** (Outlook/Teams) calendar
events with **no matching note**; if a Maestro recap exists, create a note (title +
attendees from the recap, paste Purpose/Takeaways/summary/action items under
`## Team recap (Maestro)`, `Attendance = Team Recap`, `Match Confidence = High`,
`Enriched = __YES__`). No recap → skip (no stubs). Cloudbeast/Personal misses get
nothing. These agents must dedupe against notes already present (including ones just
created), since `notion-query-meeting-notes` can't see integration-created recap notes.

## 4. Dedupe sweep

After Direction B, verify no duplicate recap notes were created (e.g. a crashed agent
that partially persisted + its re-run). Use `notion-search` over the data source on the
**distinctive** Direction-B titles; each should return one note per date. Recurring
titles (e.g. "Weekly Event Marketing Sync") legitimately appear once per occurrence —
only a same-date pair is a duplicate. Void any true duplicate.

## 5. Aggregate

Emit a combined run summary: total counts of High / Low / No match / VOID; all notes
created from recaps; a single merged **review queue** — every `Needs Review` row with
its suggested match (the human gate before trusting hourly); and any failures.

## Reliability notes (learned in production)

- **Idempotency is the safety net.** Agents skip already-`Enriched` notes, so a crashed
  or suspended agent is recovered by simply re-launching its chunk — no duplicates.
- **Detect a dead agent by the real transcript mtime** — `…/subagents/agent-<id>.jsonl`
  (NOT the 116-byte `.output` symlink, whose size never changes). Frozen mtime +
  `TaskStop` returning "No task found" = dead; re-launch the chunk.
- **Do NOT do Phase 2** (clustering / scoping) — separate, heavier-model job. It
  consumes only High-confidence, non-flagged notes.

$ARGUMENTS
