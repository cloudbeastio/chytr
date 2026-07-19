-- MCP tool-call audit log (decision exhaust for /api/mcp tools/call).
-- Additive only — no changes to existing /api/v1/* paths.

create table if not exists mcp_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  api_key_id uuid references api_keys(id) on delete set null,
  auth_kind text not null check (auth_kind in ('pat', 'oauth')),
  tool text not null,
  args_hash text,
  status text not null check (status in ('ok', 'error')),
  duration_ms integer,
  error text
);

create index if not exists idx_mcp_audit_log_created on mcp_audit_log (created_at desc);
create index if not exists idx_mcp_audit_log_user on mcp_audit_log (user_id, created_at desc);
create index if not exists idx_mcp_audit_log_tool on mcp_audit_log (tool, created_at desc);

alter table mcp_audit_log enable row level security;

-- Service role writes from /api/mcp; no direct client policies (audit is server-only).
drop policy if exists "deny all mcp_audit_log" on mcp_audit_log;
create policy "deny all mcp_audit_log" on mcp_audit_log
  for all using (false) with check (false);

comment on table mcp_audit_log is 'MCP tools/call audit — written by app/api/mcp; not client-readable.';
