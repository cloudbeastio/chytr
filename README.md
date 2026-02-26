# chytr

Work orders for AI agents. Define structured tasks, link them to GitHub repos, and Cursor Cloud Agents execute them — with full observability via hooks and a self-improving knowledge loop.

**Self-hosted, open source, license-key gated (n8n model).**

## Quick start

```bash
git clone https://github.com/jlondrejcka/chytr
cd chytr
cp .env.example .env
docker compose up
```

Open http://localhost:3000 → paste your license key → dashboard loads.

Get a free license key at [www.chytr.ai/register](https://www.chytr.ai/register).

## What it does

- **Work orders** — structured task definitions with objectives, work items, constraints, and definition of done
- **Agent launch** — inserting a work order triggers a Cursor Cloud Agent via the Cursor API
- **Hooks skill** — install into any repo to stream agent actions (tool calls, file edits, shell commands) to your dashboard in real time
- **Knowledge loop** — agent completions are auto-extracted to a vector knowledge base; future agents get relevant context injected at session start
- **Jobs** — schedule recurring work orders on a cron schedule (Pro)
- **Approvals** — agents can pause and request human input via Slack or AgentMail (Pro)

## Architecture

```
Trigger (UI / API / cron)
  → INSERT work_orders
  → DB Webhook → launch-agent Edge Function
  → Cursor Cloud Agent (with WORK_ORDER_ID)
  → hooks-skill POSTs events → ingest-log Edge Function
  → agent_logs → Supabase Realtime → dashboard
  → completion → agent-complete → embed → knowledge
```

## Install hooks skill

```bash
curl -sL https://raw.githubusercontent.com/jlondrejcka/chytr/main/packages/hooks-skill/install.sh | bash
```

Then set env vars:
```bash
export CHYTR_URL=https://your-supabase-url.supabase.co
export CHYTR_SERVICE_KEY=your-service-role-key
export WORK_ORDER_ID=the-work-order-id  # set per session
```

See [docs/install-hooks.md](docs/install-hooks.md) for full setup.

## Tiers

| Feature | Free | Pro ($19/mo) | Team ($49/mo) |
|---|---|---|---|
| Logging + dashboard | ✓ | ✓ | ✓ |
| Work orders + agents | ✓ | ✓ | ✓ |
| Knowledge (entries) | 500 | 5k | 25k |
| Log retention | 3 days | 30 days | 90 days |
| Scheduled jobs | — | ✓ | ✓ |
| Approvals | — | ✓ | ✓ |
| Advanced analytics | — | ✓ | ✓ |
| Agent repos | 2 | 10 | Unlimited |

Upgrade at [www.chytr.ai/pricing](https://www.chytr.ai/pricing).

## Deployment modes

**Self-hosted** (`CHYTR_MODE=self-hosted`): single user, no auth, credentials in env vars, license key gates features.

**Cloud** (`CHYTR_MODE=cloud`): multi-tenant, GitHub OAuth, credentials in Supabase Vault, RLS on all tables. Runs at [app.chytr.ai](https://app.chytr.ai).

## Environment variables

See [.env.example](.env.example) for all variables.

Required for self-hosted:
- `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon key
- `SUPABASE_SERVICE_ROLE_KEY` — service role key
- `CHYTR_LICENSE_KEY` — from www.chytr.ai

Optional:
- `CURSOR_API_KEY` — for launching Cloud Agents
- `GITHUB_TOKEN` — for repo access
- `SLACK_WEBHOOK_URL` — for approval notifications
- `AGENTMAIL_API_KEY` — for email approvals

## Docs

- [Getting started](docs/getting-started.md)
- [Install hooks skill](docs/install-hooks.md)
- [Work orders](docs/work-orders.md)
- [Triggering agents](docs/triggering-agents.md)
- [Knowledge loop](docs/knowledge-loop.md)
- [API reference](docs/api-reference.md)

## Stack

- Next.js 14 (App Router) + TypeScript
- Supabase (Postgres + Edge Functions + Realtime + pgvector)
- shadcn/ui + Tailwind CSS
- Docker Compose for local development

## License

MIT — free to self-host. License key required for activation (free at www.chytr.ai).
