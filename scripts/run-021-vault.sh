#!/usr/bin/env bash
# Run migration 021_vault_github_credentials.sql on the hosted Supabase DB.
# Set SUPABASE_DB_URL in .env.local (Database → Connection string → URI in Supabase Dashboard).
set -e
cd "$(dirname "$0")/.."

if [ -f .env.local ]; then
  set -a
  source .env.local
  set +a
fi

if [ -z "$SUPABASE_DB_URL" ]; then
  echo "SUPABASE_DB_URL not set. To run this migration:"
  echo "1. Supabase Dashboard → your project → Project Settings → Database → Connection string (URI)"
  echo "2. Add to .env.local: SUPABASE_DB_URL=<that URI>"
  echo "3. Re-run: ./scripts/run-021-vault.sh"
  echo "Or paste and run supabase/migrations/021_vault_github_credentials.sql in SQL Editor."
  exit 1
fi

psql "$SUPABASE_DB_URL" -f supabase/migrations/021_vault_github_credentials.sql
echo "Migration 021 applied. Marking as applied in history..."
npx supabase migration repair --status applied 021
echo "Done."
