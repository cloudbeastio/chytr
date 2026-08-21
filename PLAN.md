# chytr — Project Plan & Status

## Overview

Single public repo, self-hosted agent platform w/ license key gating (n8n model).
Next.js 16 + Supabase + shadcn/ui + Tailwind CSS 4. Hooks skill for Cursor agent observability.
Register at www.chytr.ai for free license key; paid tiers unlock jobs/approvals/analytics.

**Repo**: `cloudbeastio/chytr`
**Supabase project**: `xbvbivmvrozdesdkormu` (us-east-1)

**Active plan**: [`docs/cockpit-port-plan.md`](docs/cockpit-port-plan.md) — port Cockpit task/desk/routine model (chyts=tasks, desks org chart, runtime adapters, routines mint todo, inbound webhooks).

---

## Phase Status

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Scaffold — repo, Next.js shell, Docker Compose, license activation, .env | DONE |
| 1 | Hooks skill — hooks.json, chytr-log.sh, session.sh, stop.sh, install.sh | DONE |
| 2a | Schema — 14 migrations, types, tables, views, RPCs, pg_cron | DONE |
| 2b | Edge Functions — 8 functions deployed | DONE |
| 3a | Knowledge extraction in agent-complete + dedup via embedding similarity | DONE |
| 3b | License system — lib/license.ts, JWT validation, feature checks, dev bypass | DONE |
| 4 | Dashboard UI — all pages scaffolded | DONE |
| 5a | Stripe webhook handler | DONE |
| 5b | Landing page + license API + deploy | TODO |
| — | Connect to hosted Supabase — link, push migrations, deploy functions | DONE |
| — | Auth enforcement — middleware, login page, callback, sign-out | DONE |

---

## Architecture

- **API-first**: All programmatic traffic uses Bearer API key (`CHYTR_API_KEY`). Create keys in Settings (session auth only for key CRUD).
- **Hooks** POST to `CHYTR_URL/api/v1/ingest` and `CHYTR_URL/api/v1/knowledge/query` (no edge function URLs).
- **Next.js API routes** under `/api/v1/`: ingest, knowledge/query, agents/launch, agents/complete, jobs, approvals/request, approvals/resolve. Auth via `lib/api-auth.ts`.
- **Edge functions** retained for embeddings only: `embed` (invoked server-side with user_id), `get-embedding` (text → vector, used by knowledge/query).
- **Scheduled jobs**: CRUD via `/api/v1/jobs` (API key). pg_cron entries are managed by DB trigger on `scheduled_jobs`; no edge function.
- **RLS**: All data tables have nullable `user_id` and RLS policies; no backfill.

### Deployments

All in one Vercel project. No separate api.chytr.ai project — license API lives in the app.

| Domain | What | Stack |
|--------|------|-------|
| `app.chytr.ai` | Dashboard + license API | Same codebase, CHYTR_MODE=cloud, Vercel |
| `www.chytr.ai` | Landing page (same Next.js app) | Vercel, rewrite or route group |
| `docs.chytr.ai` | Redirects to GitHub repo docs/ | DNS redirect |

---

## Two Deployment Modes

### CHYTR_MODE=self-hosted (default)
- Auth: license key only, single user, no OAuth
- Data: no RLS, no user_id scoping
- Credentials: env vars (.env file)
- Feature gating: license key JWT tier
- Instance phones home monthly to refresh key

### CHYTR_MODE=cloud (app.chytr.ai)
- Auth: Google/Microsoft OAuth + magic link via Supabase Auth
- Data: RLS on all tables, user_id scoping
- Credentials: Supabase Vault per user
- Feature gating: subscription tier from DB
- Usage enforcement: agent runs, log events, knowledge entries

### CHYTR_DEV_MODE=true (local development)
- Bypasses license AND auth checks entirely
- Runs as Team tier with all features unlocked
- Set in .env.local for local dev

---

## Feature Gating by Tier

| Feature | Free | Pro ($19/mo) | Team ($49/mo) |
|---------|------|--------------|---------------|
| Hooks + logging | Yes | Yes | Yes |
| Structured work orders | Yes (limits) | Yes | Yes |
| Real-time execution trace | Yes (limits) | Yes | Yes |
| Analytics | Yes (limits) | Yes | Yes |
| Log retention | 3 days | 30 days | 90 days |
| Agent repos | 2 | 10 | Unlimited |
| Scheduled jobs | No | Yes | Yes |
| Human-in-the-loop (approvals) | No | Yes | Yes |
| Knowledge loop (vector search) | No | 5k entries | 25k entries |
| Multi-user | No | No | Yes |

Free tier: work orders, trace, and analytics included with limits. OSS self-hosted: same features, limits not enforced (you own the DB). Paid tiers: scheduled jobs, approvals, knowledge loop.

---

## What's Built

### Schema (14 migrations — all deployed)
- `001_extensions` — uuid-ossp, pgvector, pg_cron
- `002_types` — log_event_type enum (15 event types)
- `003_functions` — update_updated_at_column trigger
- `004_instance_config` — key-value store for license key
- `005_agents` — agent registry w/ heartbeat + notification_config
- `006_agent_repos` — agent ↔ GitHub repo links
- `007_work_orders` — full work order schema w/ token cols, JSONB fields
- `008_agent_logs` — structured hook event stream
- `009_knowledge` — pgvector embeddings, dedup via similarity
- `010_scheduled_jobs` — recurring work orders + job_runs
- `011_approvals` — human-in-the-loop decisions
- `012_views` — agent_stats, tool_stats, skill_stats
- `013_rpcs` — get_work_order, match_knowledge, upsert_knowledge
- `014_cron` — log cleanup, mark-offline, expire-approvals, run-jobs

### Edge Functions (8 — all deployed)
- `ingest-log` — normalize hook payload → structured event, update heartbeat
- `launch-agent` — license check → read WO → POST Cursor API
- `agent-complete` — update status, fetch tokens, extract knowledge, update job_run
- `embed` — gte-small 384d vectors, knowledge limit check
- `query-knowledge` — semantic search via match_knowledge RPC
- `run-scheduled-job` — (pro+) pg_cron → INSERT work order from template
- `request-approval` — (pro+) create approval, route to Slack/AgentMail
- `resolve-approval` — (pro+) receive decision, update approval

### Hooks Skill (packages/hooks-skill)
- `hooks.json` — lifecycle hook config
- `chytr-log.sh` — POST events to ingest-log
- `chytr-session.sh` — sessionStart handler, returns knowledge context
- `chytr-stop.sh` — DoD validation, followup_message if unfinished
- `install.sh` — one-line curl installer

### Dashboard Pages (all scaffolded)
- `/dashboard` — stats cards, leaderboards, recent activity
- `/work-orders` — list w/ filters (status, source, agent, repo)
- `/work-orders/[id]` — execution trace w/ Realtime streaming
- `/agents` — agent registry, health, stats, repo links
- `/knowledge` — vector search browser
- `/jobs` — scheduled jobs CRUD + run history (pro+)
- `/jobs/[id]` — job detail w/ run history
- `/approvals` — approval queue + history (pro+)
- `/settings` — license key, API keys, notifications
- `/usage` — usage meters + historical charts

### Auth (implemented)
- `middleware.ts` — session check, redirect to /login, dev mode bypass
- `app/login/page.tsx` — magic link only (Google/Microsoft commented out)
- `app/auth/callback/route.ts` — exchange code for session
- `components/dashboard/user-menu.tsx` — avatar + sign-out dropdown
- `lib/supabase.ts` — browser-safe client (`createSupabaseClient()`)
- `lib/supabase-server.ts` — `createSupabaseServerClient()` (cookies) + `createSupabaseServiceClient()` (service role)

### License System
- `lib/license.ts` — JWT validation via `jose`, feature checks, tier limits, dev bypass, `TIER_FEATURES` map
- `(activate)/activate/page.tsx` — license key entry screen
- `api/license/activate/route.ts` — validate + store license key

### Stripe Webhook
- `app/api/webhooks/stripe/route.ts` — handles checkout.session.completed, subscription.updated, subscription.deleted, invoice.payment_failed. Verifies signature. Stores stripe_customer_id, stripe_subscription_id, stripe_tier in instance_config.

### Docs (in repo)
- `docs/getting-started.md`
- `docs/install-hooks.md`
- `docs/work-orders.md`
- `docs/knowledge-loop.md`

---

## Existing UI Components (shadcn/ui)

All in `components/ui/`: alert, alert-dialog, badge, button, calendar, card, command, dialog, dropdown-menu, input, label, popover, progress, select, separator, sheet, skeleton, table, tabs, textarea, tooltip.

`cn()` utility at `lib/utils.ts`. Use `@/components/ui/*` imports.

---

## Phase 5b — TODO (3 tasks)

### TASK A: Landing Page

**Goal**: Replace current `app/page.tsx` (redirect-only) with a public marketing landing page.

**Files to create/edit**:

1. **`app/page.tsx`** — Replace entirely. Server component. Import and render all sections below. No auth checks, no redirects. Just renders the landing page.

2. **`components/landing/navbar.tsx`** — Client component (`'use client'`).
   - Left: `Activity` icon from lucide-react + "chytr" text
   - Center: anchor links — Features, Pricing, Docs (href `#features`, `#pricing`, `https://github.com/cloudbeastio/chytr/tree/main/docs`)
   - Right: `<Button variant="ghost" asChild><Link href="/login">Login</Link></Button>` + `<Button asChild><Link href="/login">Get Started</Link></Button>`
   - Fixed top, dark bg, blur backdrop

3. **`components/landing/hero.tsx`** — Server component.
   - `<Badge variant="secondary">Open Source Agent Platform</Badge>`
   - `<h1>` "Work Orders for AI Agents" — text-5xl md:text-7xl font-bold tracking-tight
   - `<p>` subtitle: "Define structured work orders, link to GitHub repos, and Cursor Cloud Agents execute autonomously — with full observability."
   - Two buttons: "Get Started Free" (`<Button size="lg" asChild><Link href="/login">`) and "View on GitHub" (`<Button variant="outline" size="lg">` linking to `https://github.com/cloudbeastio/chytr`)
   - Below: terminal-style code block showing `curl -fsSL https://chytr.ai/install.sh | sh` in a dark card w/ rounded corners, monospace font

4. **`components/landing/how-it-works.tsx`** — Server component.
   - Section heading: "How It Works" — `id="how-it-works"`
   - 3 numbered steps in a horizontal grid (md:grid-cols-3):
     1. "Install Hooks" — "One-line install adds the chytr skill to your Cursor agent. Lifecycle hooks capture every event."
     2. "Create Work Orders" — "Define objectives, constraints, repos. Fire via dashboard, API, or cron schedule."
     3. "Agents Execute" — "Cursor Cloud Agents pick up work orders. Full execution trace streams to your dashboard in real-time."
   - Each step: `<Card>` with step number badge, title (font-semibold), description (text-muted-foreground)

5. **`components/landing/features.tsx`** — Server component.
   - Section heading: "Everything You Need" — `id="features"`
   - 2x3 grid of `<Card>` (md:grid-cols-3), each with lucide icon + title + one-liner:
     - `ClipboardList` "Structured Work Orders" — "Full objective, constraints, hints, verification criteria."
     - `Activity` "Real-time Execution Trace" — "Stream every tool call, file edit, and checkpoint live."
     - `Brain` "Knowledge Loop" — "Auto-extract learnings into pgvector. Agents get smarter over time."
     - `Calendar` "Scheduled Jobs" — "Cron-based recurring work orders with run history."
     - `ShieldCheck` "Human-in-the-Loop" — "Approval gates via Slack or AgentMail before risky actions."
     - `BarChart3` "Usage Analytics" — "Token spend, cost tracking, agent performance leaderboards."
   - Cards: `p-6`, icon `h-8 w-8 text-primary mb-3`, title `text-lg font-semibold`, desc `text-sm text-muted-foreground`

6. **`components/landing/pricing.tsx`** — Client component (`'use client'`).
   - Section heading: "Simple Pricing" — `id="pricing"`
   - 3 `<Card>` in a row (md:grid-cols-3, max-w-4xl mx-auto):
   - **Free** ($0/mo): Hooks + logging, Dashboard, Knowledge (500 entries), 3-day log retention, 2 repos. CTA: "Get Started" button outline
   - **Pro** ($19/mo): Everything in Free + Scheduled jobs, Approvals, Analytics, 5k knowledge, 30-day logs, 10 repos. CTA: "Get Started" button default. Add `<Badge>Popular</Badge>` on this card. Give this card a ring/border highlight: `ring-2 ring-primary`
   - **Team** ($49/mo): Everything in Pro + Multi-user, 25k knowledge, 90-day logs, Unlimited repos. CTA: "Get Started" button outline
   - Feature list inside each card: use `Check` icon from lucide for each line item
   - All CTA buttons link to `/login`

7. **`components/landing/footer.tsx`** — Server component.
   - Simple dark footer. Logo + "chytr" left, links right: GitHub, Docs, Login
   - `© 2025 CloudBeast. All rights reserved.` in text-xs text-muted-foreground

**Styling notes**:
- Dark theme (html has `className="dark"` in root layout — already set)
- Use existing globals.css theme vars, no new CSS
- Sections: `py-24 px-6` with `max-w-6xl mx-auto`
- Import icons from `lucide-react` (already in package.json)
- Import `Link` from `next/link`
- Import `Button` from `@/components/ui/button`, `Badge` from `@/components/ui/badge`, `Card` etc from `@/components/ui/card`
- Keep all imports at top of file, never inline

### TASK B: License API Routes

**Goal**: Add license key generation + refresh as Next.js API routes (replaces planned separate api.chytr.ai project).

**Existing context**:
- `lib/license.ts` already has `validateLicenseJWT()`, `TIER_FEATURES`, `LicensePayload` type
- `lib/supabase-server.ts` exports `createSupabaseServiceClient()`
- `jose` is already in package.json (used for JWT verification)
- `instance_config` table is a key-value store with columns: `key text PRIMARY KEY, value text`
- Stripe webhook (`app/api/webhooks/stripe/route.ts`) already stores `stripe_tier` in instance_config

**New env vars needed** (add to .env.example):
- `CHYTR_PRIVATE_KEY` — RS256 private key PEM for signing license JWTs
- `CHYTR_PUBLIC_KEY` — RS256 public key PEM for verifying (already referenced in lib/license.ts)

**Files to create**:

1. **`lib/license-issuer.ts`** — Server-only helper for signing license JWTs.
   ```
   Imports: SignJWT, importPKCS8 from 'jose'
   Imports: TIER_FEATURES, LicensePayload from './license'

   const CHYTR_PRIVATE_KEY = process.env.CHYTR_PRIVATE_KEY

   export async function generateLicenseJWT(email: string, tier: 'free' | 'pro' | 'team'): Promise<string>
     - If !CHYTR_PRIVATE_KEY throw Error('CHYTR_PRIVATE_KEY not configured')
     - Import private key via importPKCS8(CHYTR_PRIVATE_KEY, 'RS256')
     - Build payload matching LicensePayload shape:
       sub: crypto.randomUUID()
       email
       tier
       features: [...TIER_FEATURES[tier]]
       limits: { knowledge_entries, log_retention_days, agent_repos } based on tier
         free: 500, 3, 2
         pro: 5000, 30, 10
         team: 25000, 90, 999
     - Sign with new SignJWT(payload).setProtectedHeader({ alg: 'RS256' }).setIssuedAt().setExpirationTime('30d').sign(privateKey)
     - Return the signed JWT string
   ```

2. **`app/api/license/generate/route.ts`** — POST. Called after registration or Stripe checkout.
   ```
   Auth: requires Supabase session (use createSupabaseServerClient, check getUser)
   Body: { email?: string } — optional, defaults to session user email
   Logic:
     - Get authenticated user from Supabase session
     - If no user, return 401
     - Check instance_config for stripe_tier; default to 'free' if not found
     - Call generateLicenseJWT(email, tier)
     - Store in instance_config: license_key = jwt, license_decoded = JSON payload, activated_at = now
     - Return { license_key: jwt, tier }
   ```

3. **`app/api/license/refresh/route.ts`** — POST. Called by self-hosted instances to refresh expiring keys.
   ```
   No auth required (self-hosted instances call this with their key)
   Body: { license_key: string }
   Logic:
     - Validate the incoming JWT using existing validateLicenseJWT()
     - If invalid/expired > 7 days, return 403 { error: 'License expired' }
     - If expired <= 7 days (grace period), allow refresh
     - Extract email + tier from old JWT payload
     - Call generateLicenseJWT(email, tier) to issue new key
     - Return { license_key: newJwt, tier }
   Note: For expired-within-grace, catch the jose expiry error, decode payload manually via decodeJwt from jose, check if exp + 7 days > now
   ```

4. **Update `app/api/webhooks/stripe/route.ts`** — After the `checkout.session.completed` case stores the tier, also regenerate the license key. Add after the `upsertStripeConfig` call:
   ```
   import { generateLicenseJWT } from '@/lib/license-issuer'
   
   // After upsertStripeConfig in checkout.session.completed:
   const email = session.customer_email ?? ''
   const licenseJwt = await generateLicenseJWT(email, tier)
   await upsertStripeConfig([
     ...existing rows...,
     { key: 'license_key', value: licenseJwt },
     { key: 'license_decoded', value: JSON.stringify(/* decoded payload */) },
   ])
   
   // Same for customer.subscription.updated case
   ```

### TASK C: Middleware Update

**Goal**: Make landing page and license API routes publicly accessible (no auth required).

**File to edit**: `middleware.ts`

**Change**: Update `PUBLIC_PATHS` array:
```
const PUBLIC_PATHS = ['/login', '/auth/callback', '/activate', '/api/license/refresh', '/api/webhooks']
```

**Also add**: Root path `/` must be public. Add this check after the PUBLIC_PATHS check:
```
if (pathname === '/') {
  return NextResponse.next()
}
```

### TASK D: Update .env.example

**File to edit**: `.env.example`

**Add these vars** (at the bottom):
```
# License JWT signing (RS256 key pair)
CHYTR_PRIVATE_KEY=
CHYTR_PUBLIC_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

---

## Dashboard Re-envision: All-Encompassing Agent Monitoring

**Goal**: Turn the dashboard from summary cards + recent activity into a single pane for fleet health, pipeline, performance, cost, and ops — with drill-down and optional time range.

### Pillars

| Pillar | What to show | Data source |
|--------|--------------|-------------|
| **Fleet** | Who's online, heartbeat, running count per agent, type/role | `agents`, `agent_stats` (running) |
| **Pipeline** | Funnel: pending → running → completed / failed / cancelled; throughput (today / 7d); queue depth | `work_orders` counts + time filters |
| **Performance** | Latency (avg, p50/p95 optional), tool success rate, skill usage | `agent_stats`, `tool_stats`, `skill_stats` |
| **Cost & tokens** | Input / output / total tokens; cost by agent or time; optional trend | `work_orders` sums, `agent_stats` |
| **Quality** | Completion vs failure rate; pending approvals; optional summary/error preview | `work_orders`, `approvals`, `summary` / `error_message` |
| **Ops** | Jobs: next run, last status; repos/hooks; recent errors | `scheduled_jobs`, `job_runs`, `agent_repos`, `agent_logs` (event_type = 'error') |

### Proposed layout (single "Mission Control" page)

1. **Header** — Title "Agent monitoring" or "Mission control", optional **time range** (Today / 7d / 30d) and **Refresh**.
2. **Row 1 — At-a-glance** — Keep 4 cards but make them **contextual**: e.g. Work orders (total), Active agents / total, Tool calls (in range), Pending approvals. Optional: small delta vs previous period.
3. **Row 2 — Pipeline + Fleet** — **Pipeline / mission board**: status breakdown (pending, running, completed, failed, cancelled) with **counts + % bar**. **Agent fleet**: list of agents with status dot, name, type, last heartbeat, running / completed / failed. Link to `/agents` and work-orders?agent_id=X.
4. **Row 3 — Leaderboards + Token usage** — Top agents (runs), top tools (calls), top skills (loads) from `agent_stats`, `tool_stats`, `skill_stats`. **Token usage**: input / output / total and cost for range. Optional in/out bar.
5. **Row 4 — Recent activity (detailed)** — Last N work orders with objective, **agent name**, repo, status, **summary or error snippet**, duration, time. Link to `/work-orders/[id]`.
6. **Optional row 5 — Ops** — Next scheduled jobs; recent errors from `agent_logs` (event_type = 'error').

### Data / backend

- **Existing**: `agent_stats`, `tool_stats`, `skill_stats`, `work_orders`, `agents`, `approvals`, `agent_logs`, `scheduled_jobs`, `job_runs`, `agent_repos`. No new tables for v1.
- **Optional**: View or RPC for `work_order_status_counts` / time-bucketed counts for range selector.
- **Single load**: One server component (or API route) running 4–6 parallel queries; pass props to sections. Prefer server components.

### Phasing

- **Phase A**: Pipeline bar, fleet list, leaderboards (real data), token usage, richer recent activity (agent, summary/error, duration). No time range.
- **Phase B**: Time range selector; wire counts and token sums to range; optional delta on cards.
- **Phase C**: Ops row (jobs + recent errors); optional latency percentiles.

### Unresolved questions (dashboard re-envision)

- Time range: URL (`?range=7d`) or local state?
- p50/p95 latency: new view or skip v1?
- Alerts (agent offline, failure rate): in-app only or email/Slack?
- Page title: "Mission control" vs "Dashboard"?
- Show knowledge learned count on dashboard?

---

## Repo Structure (updated)

```
chytr/
├── app/
│   ├── (activate)/activate/        # License activation (first boot)
│   ├── (dashboard)/                # Licensed dashboard routes
│   │   ├── dashboard/page.tsx      # Main stats dashboard
│   │   ├── work-orders/            # WO list + detail
│   │   ├── agents/                 # Agent registry
│   │   ├── knowledge/              # Vector knowledge browser
│   │   ├── jobs/                   # Scheduled jobs (pro+)
│   │   ├── approvals/              # Approval queue (pro+)
│   │   ├── settings/               # Config + credentials
│   │   ├── usage/                  # Usage meters
│   │   └── layout.tsx              # Dashboard shell + sidebar
│   ├── auth/callback/route.ts      # OAuth + magic link callback
│   ├── login/page.tsx              # Login (magic link, OAuth commented)
│   ├── api/
│   │   ├── license/activate/       # Validate + store license key
│   │   ├── license/generate/       # Issue new license JWT (TASK B)
│   │   ├── license/refresh/        # Refresh expiring license JWT (TASK B)
│   │   ├── webhooks/stripe/        # Stripe subscription events
│   │   ├── agents/                 # CRUD
│   │   ├── jobs/                   # CRUD + run
│   │   ├── approvals/              # Resolve
│   │   └── settings/               # Config
│   ├── layout.tsx                  # Root layout (dark theme, Inter font)
│   └── page.tsx                    # Landing page (TASK A)
├── components/
│   ├── landing/                    # Landing page sections (TASK A)
│   │   ├── navbar.tsx
│   │   ├── hero.tsx
│   │   ├── how-it-works.tsx
│   │   ├── features.tsx
│   │   ├── pricing.tsx
│   │   └── footer.tsx
│   ├── dashboard/                  # Stats, sidebar, user menu
│   ├── ui/                         # shadcn/ui primitives
│   └── ...
├── lib/
│   ├── license.ts                  # JWT validation + feature gating
│   ├── license-issuer.ts           # JWT signing (TASK B)
│   ├── supabase.ts                 # Browser client
│   ├── supabase-server.ts          # Server + service role clients
│   └── database.types.ts           # Generated types
├── packages/hooks-skill/           # Installable Cursor hooks
├── supabase/
│   ├── migrations/                 # 14 SQL migrations
│   ├── functions/                  # 8 Edge Functions
│   └── config.toml
├── docs/                           # Getting started, hooks, WOs, knowledge
├── middleware.ts                    # Auth enforcement
├── docker-compose.yml              # Supabase local + Next.js
├── .env.example                    # Template
└── README.md
```

---

## Env Vars

| Var | Required | Description |
|-----|----------|-------------|
| `CHYTR_MODE` | Yes | `self-hosted` or `cloud` |
| `CHYTR_DEV_MODE` | No | `true` bypasses license + auth |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `CHYTR_LICENSE_KEY` | Prod | License key (or entered via UI) |
| `CHYTR_PRIVATE_KEY` | Prod | RS256 private key PEM for signing license JWTs |
| `CHYTR_PUBLIC_KEY` | Prod | RS256 public key PEM for verifying license JWTs |
| `CURSOR_API_KEY` | For agents | Cursor Cloud Agent API key |
| `GITHUB_TOKEN` | For agents | GitHub repo access |
| `STRIPE_SECRET_KEY` | Prod | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Prod | Stripe webhook signing secret |
| `SLACK_WEBHOOK_URL` | Optional | Approval routing |
| `AGENTMAIL_API_KEY` | Optional | Approval routing |

---

## After Phase 5b (MANUAL / BLOCKED)

### Auth Providers (BLOCKED — needs credentials)
- Google OAuth — create OAuth app in Google Cloud Console
  - Redirect URI: `https://xbvbivmvrozdesdkormu.supabase.co/auth/v1/callback`
  - Paste Client ID + Secret into Supabase Dashboard → Auth → Providers → Google
- Microsoft/Azure OAuth — register app in Azure Portal
  - Redirect URI: `https://xbvbivmvrozdesdkormu.supabase.co/auth/v1/callback`
  - Paste Client ID + Secret into Supabase Dashboard → Auth → Providers → Azure
- Code is written and commented out in `app/login/page.tsx`, ready to uncomment

### Supabase Dashboard Config (MANUAL)
- Authentication → URL Configuration → set Site URL to production URL
- Add `http://localhost:3000` to Redirect URLs allowlist
- Custom SMTP for production email (currently using Supabase default mailer)

### Stripe Dashboard (MANUAL)
- Create Pro product ($19/mo) with metadata `tier: pro`
- Create Team product ($49/mo) with metadata `tier: team`
- Configure webhook endpoint pointing to `https://app.chytr.ai/api/webhooks/stripe`
- Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET` env var

### RS256 Key Pair (MANUAL)
- Generate: `openssl genrsa -out chytr-private.pem 2048 && openssl rsa -in chytr-private.pem -pubout -out chytr-public.pem`
- Set `CHYTR_PRIVATE_KEY` env var in Vercel to contents of chytr-private.pem
- Set `CHYTR_PUBLIC_KEY` env var in Vercel to contents of chytr-public.pem
- Optionally commit `public/chytr-public-key.pem` so self-hosted instances can verify

### DNS + Vercel (MANUAL)
- Add `app.chytr.ai` and `www.chytr.ai` as domains in Vercel project
- Add `docs.chytr.ai` as DNS redirect to `https://github.com/cloudbeastio/chytr/tree/main/docs`

---

## Phase 6 — Onboarding Wizard + Quick Start (TODO)

### TASK E: Onboarding Wizard

**Goal**: After first login, guide user through setup. Detects what's configured and what's not.

**Route**: `app/(dashboard)/onboarding/page.tsx` (also redirect here from `/dashboard` if onboarding incomplete)

**Wizard steps** (stepper UI, each step has a check/incomplete indicator):

1. **Install Hooks** — Show the curl command for their platform. Detect: check if any `agent_logs` rows exist with `event_type = 'session_start'` — if yes, hooks are working.
   - Display: `curl -fsSL https://raw.githubusercontent.com/cloudbeastio/chytr/main/packages/hooks-skill/install.sh | bash`
   - Show env vars needed: `CHYTR_URL`, `CHYTR_SERVICE_KEY`
   - Auto-fill values from the user's instance (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) with copy buttons

2. **API Key** — Generate or display the Supabase service role key. User copies it to:
   - Their `.env` file in the target project
   - Cursor settings (if using cloud agents)
   - Detect: check instance_config for a stored API key or just show the key from env

3. **Assign Work Order** — Create or select a work order for the current project:
   - "Create new" — minimal form: objective (text), optional repo select
   - "Use existing" — dropdown of `status = 'pending'` or `status = 'running'` work orders
   - For local dev: auto-create a "General development" work order if none exist
   - Returns the `WORK_ORDER_ID` for the user to set in their env
   - Detect: check if any work_orders exist

4. **Verify** — Show a "waiting for first event" screen. Poll `agent_logs` for any row. Once one appears, show success + link to dashboard.

**State tracking**: Store onboarding progress in `instance_config` key `onboarding_status` (JSON: `{ hooks_installed: bool, api_key_copied: bool, work_order_created: bool, first_event_received: bool }`). Dashboard layout checks this; if incomplete, shows banner linking to `/onboarding`.

**Components**:
- `components/onboarding/step-install.tsx` — curl command + env vars + copy buttons
- `components/onboarding/step-api-key.tsx` — API key display + copy
- `components/onboarding/step-work-order.tsx` — create/select work order form
- `components/onboarding/step-verify.tsx` — polling for first event
- `components/onboarding/onboarding-wizard.tsx` — stepper shell, step state, navigation

**API routes needed**:
- `POST /api/onboarding/status` — read/update onboarding state in instance_config
- `GET /api/onboarding/check` — returns { hooks_installed, has_work_orders, has_events } by querying tables

---

## Unresolved Questions

- License refresh grace period: 7-day lockout or degrade to free? → **7-day grace, then degrade to free**
- Team plan multi-user: single key covers instance or per-seat? → **Single key covers instance**
- Cursor API token endpoint: does GET /v1/agents/{id} return token/cost data?
- Agent heartbeat: 10min offline threshold too aggressive for long-running agents?
- Approval expiry: default TTL? 24h? Configurable per agent?
