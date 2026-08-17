# CLAUDE.md — chytr

## CloudBeast knowledge graph
Business/project context for this repo lives in `cloudbeastio/cb-wiki-2` →
`entities/projects/chytr.md` (classification, client, decisions, open threads,
environment briefing). Query it via the cb-wiki MCP (`graph_search_entity`,
`graph_entity_timeline`) or cb-main RAG (`rag_search`) before product/relationship
decisions; log significant decisions back to that entity's `## Decisions & Events`
(add cb-wiki-2 to the session, or ask the wiki side to record it).

## What this repo is
Work orders for AI agents (product name **chytr** / table **chyts**). Next.js App
Router + Supabase + license-key gating (n8n model). Cloud: `app.chytr.ai`
(`CHYTR_MODE=cloud`). Self-host: Docker Compose. Deeper status: `PLAN.md`.

## Architecture (do not invent alternate paths)
Trigger → INSERT `chyts` → launch agent (Cursor API) → hooks POST
`/api/v1/ingest` → `agent_logs` + Realtime dashboard → completion → embed →
knowledge. After ingest, best-effort redacted push to cb-main
`chytr-log-ingest` (`CBMAIN_LOG_SYNC_*`; never fail ingest). Backfill:
`POST /api/v1/cbmain-sync/backfill`. Prefer Next `/api/v1/*` + `CHYTR_API_KEY`
over calling Edge URLs from hooks. Schema rename: `work_orders`→`chyts`,
`contracts`→`projects` (migration 024).

## Build / run
- Docker (preferred local): `cp .env.example .env` → `docker compose up` → http://localhost:3000
- Node: `npm install` → `npm run dev` (needs Supabase URL/keys)
- Prod build: `npm run build` / `npm start` (Dockerfile `output: 'standalone'`)
- No `npm test` script yet — do not assume one

## Deploy
- **Cloud:** one Vercel project — `app.chytr.ai` + `www.chytr.ai` (license API in-app)
- **Self-host:** Docker Compose (app + local Supabase stack)
- **Backend:** Supabase project (see PLAN.md); migrations under `supabase/migrations/`,
  functions under `supabase/functions/`
- One repo = one deploy source — do not deploy drifted copies from elsewhere

## Env vars (names only — never commit values)
See `.env.example`. Critical: `CHYTR_MODE`, `CHYTR_DEV_MODE` (local only),
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `CHYTR_LICENSE_KEY`, `CHYTR_API_KEY`,
`CHYTR_PUBLIC_URL`, `CURSOR_API_KEY`, `GITHUB_*`, Stripe keys, license RS256
`CHYTR_PRIVATE_KEY` / `CHYTR_PUBLIC_KEY`. Values live in Vercel / Supabase /
local `.env` — never in git or the wiki.

## Never touch / never do
- Never commit secret values or PEM private keys
- Never set `CHYTR_DEV_MODE=true` in production
- Do not start MCP OAuth / architect implementation unless Joe explicitly asks
  (wiki onboard is graph-only)
- Do not squash history that carries structured commit payloads if this repo
  adopts wiki-style commits later; follow existing PR conventions on `main`
- Prefer updating docs when renaming APIs (chyts vs work_orders drift)

## Packages
- `packages/hooks-skill` — Cursor hooks installer
- `packages/claude-hooks-skill` — Claude Code hooks variant

## Docs
`docs/getting-started.md`, `install-hooks.md`, `work-orders.md`,
`triggering-agents.md`, `knowledge-loop.md`, `api-work-orders.md`,
`install-hooks-claude.md`. Product plan: `PLAN.md`.
