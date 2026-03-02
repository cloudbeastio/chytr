create table if not exists license_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key_hash text not null,
  key_prefix text not null,
  name text not null,
  tier text not null check (tier in ('free', 'pro', 'team')),
  activated_instance_id text,
  created_at timestamptz default now(),
  revoked_at timestamptz
);
create unique index if not exists idx_license_keys_key_hash on license_keys(key_hash) where revoked_at is null;
create index if not exists idx_license_keys_user_id on license_keys(user_id);

alter table license_keys enable row level security;

create policy "license_keys_select" on license_keys for select using (user_id = auth.uid());
create policy "license_keys_insert" on license_keys for insert with check (user_id = auth.uid());
create policy "license_keys_update" on license_keys for update using (user_id = auth.uid());
