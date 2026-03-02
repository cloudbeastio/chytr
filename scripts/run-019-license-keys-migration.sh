#!/usr/bin/env bash
# Run migration 019_license_keys.sql on the hosted Supabase DB.
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
  echo "1. Supabase Dashboard → your project → SQL Editor → New query"
  echo "2. Paste and run: supabase/migrations/019_license_keys.sql"
  echo "3. Then run: supabase migration repair --status applied 019"
  exit 1
fi

psql "$SUPABASE_DB_URL" -f supabase/migrations/019_license_keys.sql
echo "Migration 019 applied. Marking as applied in history..."
supabase migration repair --status applied 019
echo "Done."
