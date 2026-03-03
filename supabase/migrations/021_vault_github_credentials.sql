-- GitHub credentials in Vault (per user). Schema is vault.
-- supabase_vault is pre-installed on Supabase projects; no extension create needed.

create table if not exists user_github_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  vault_secret_id uuid not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_user_github_credentials_user_id on user_github_credentials(user_id);

create trigger update_user_github_credentials_updated_at
  before update on user_github_credentials
  for each row execute function update_updated_at_column();

-- Store or update GitHub token for a user.
create or replace function set_user_github_token(p_user_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
  v_existing_id uuid;
begin
  if p_token is null or trim(p_token) = '' then
    delete from user_github_credentials where user_id = p_user_id;
    return;
  end if;

  select vault_secret_id into v_existing_id
  from user_github_credentials
  where user_id = p_user_id;

  if v_existing_id is not null then
    v_secret_id := vault.create_secret(p_token, 'github_' || p_user_id::text, 'GitHub token');
    update user_github_credentials set vault_secret_id = v_secret_id, updated_at = now() where user_id = p_user_id;
  else
    v_secret_id := vault.create_secret(p_token, 'github_' || p_user_id::text, 'GitHub token');
    insert into user_github_credentials (user_id, vault_secret_id)
    values (p_user_id, v_secret_id)
    on conflict (user_id) do update set vault_secret_id = excluded.vault_secret_id, updated_at = now();
  end if;
end;
$$;

-- Return GitHub token for a user. Called by backend only (service role). Never expose to client.
create or replace function get_user_github_token(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
  v_secret text;
begin
  select vault_secret_id into v_secret_id
  from user_github_credentials
  where user_id = p_user_id;

  if v_secret_id is null then
    return null;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where id = v_secret_id;

  return v_secret;
end;
$$;

-- Optional: return whether user has a GitHub credential (for GET /api/settings/github-token). No secret value.
create or replace function user_has_github_credential(p_user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from user_github_credentials where user_id = p_user_id);
$$;

grant execute on function set_user_github_token(uuid, text) to service_role;
grant execute on function get_user_github_token(uuid) to service_role;
grant execute on function user_has_github_credential(uuid) to service_role;
grant execute on function user_has_github_credential(uuid) to authenticated;
