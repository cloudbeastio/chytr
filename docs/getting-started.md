# Getting started

## Prerequisites

- Docker + Docker Compose
- Node.js 20+ (for local development without Docker)
- A chytr license key — [get one free at www.chytr.ai/register](https://www.chytr.ai/register)

## Self-hosted with Docker Compose

```bash
git clone https://github.com/jlondrejcka/chytr
cd chytr
cp .env.example .env
```

Edit `.env`:
```
CHYTR_LICENSE_KEY=your-license-key-here
CURSOR_API_KEY=your-cursor-api-key  # optional, for launching Cloud Agents
```

Start:
```bash
docker compose up
```

Open http://localhost:3000. On first boot, you'll be asked to enter your license key if not set in `.env`.

## Local development (without Docker)

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Start local Supabase
supabase start

# Install deps
npm install

# Copy env
cp .env.example .env.local
# Fill in the Supabase URLs from `supabase status`

# Run migrations
supabase db push

# Start Next.js
npm run dev
```

## Next steps

1. [Install the hooks skill](install-hooks.md) into your agent repo
2. [Create your first work order](work-orders.md)
3. [Trigger an agent](triggering-agents.md)
