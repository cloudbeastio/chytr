-- Add user_id to all data tables (nullable; no backfill; new rows set from API key)
alter table agents add column if not exists user_id uuid references auth.users(id);
alter table agent_repos add column if not exists user_id uuid references auth.users(id);
alter table work_orders add column if not exists user_id uuid references auth.users(id);
alter table agent_logs add column if not exists user_id uuid references auth.users(id);
alter table knowledge add column if not exists user_id uuid references auth.users(id);
alter table scheduled_jobs add column if not exists user_id uuid references auth.users(id);
alter table job_runs add column if not exists user_id uuid references auth.users(id);
alter table approvals add column if not exists user_id uuid references auth.users(id);
alter table instance_config add column if not exists user_id uuid references auth.users(id);

create index if not exists idx_agents_user_id on agents(user_id);
create index if not exists idx_agent_repos_user_id on agent_repos(user_id);
create index if not exists idx_work_orders_user_id on work_orders(user_id);
create index if not exists idx_agent_logs_user_id on agent_logs(user_id);
create index if not exists idx_knowledge_user_id on knowledge(user_id);
create index if not exists idx_scheduled_jobs_user_id on scheduled_jobs(user_id);
create index if not exists idx_job_runs_user_id on job_runs(user_id);
create index if not exists idx_approvals_user_id on approvals(user_id);

-- api_keys table for API key auth
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key_hash text not null,
  key_prefix text not null,
  name text not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz default now()
);
create unique index if not exists idx_api_keys_key_hash on api_keys(key_hash) where revoked_at is null;
create index if not exists idx_api_keys_user_id on api_keys(user_id);

-- Enable RLS on all tables
alter table instance_config enable row level security;
alter table agents enable row level security;
alter table agent_repos enable row level security;
alter table work_orders enable row level security;
alter table agent_logs enable row level security;
alter table knowledge enable row level security;
alter table scheduled_jobs enable row level security;
alter table job_runs enable row level security;
alter table approvals enable row level security;
alter table api_keys enable row level security;

-- Policies: user sees only own rows (user_id = auth.uid())
create policy "instance_config_select" on instance_config for select using (user_id = auth.uid() or user_id is null);
create policy "instance_config_insert" on instance_config for insert with check (user_id = auth.uid() or user_id is null);
create policy "instance_config_update" on instance_config for update using (user_id = auth.uid() or user_id is null);

create policy "agents_select" on agents for select using (user_id = auth.uid());
create policy "agents_insert" on agents for insert with check (user_id = auth.uid());
create policy "agents_update" on agents for update using (user_id = auth.uid());
create policy "agents_delete" on agents for delete using (user_id = auth.uid());

create policy "agent_repos_select" on agent_repos for select using (user_id = auth.uid());
create policy "agent_repos_insert" on agent_repos for insert with check (user_id = auth.uid());
create policy "agent_repos_update" on agent_repos for update using (user_id = auth.uid());
create policy "agent_repos_delete" on agent_repos for delete using (user_id = auth.uid());

create policy "work_orders_select" on work_orders for select using (user_id = auth.uid());
create policy "work_orders_insert" on work_orders for insert with check (user_id = auth.uid());
create policy "work_orders_update" on work_orders for update using (user_id = auth.uid());
create policy "work_orders_delete" on work_orders for delete using (user_id = auth.uid());

create policy "agent_logs_select" on agent_logs for select using (user_id = auth.uid());
create policy "agent_logs_insert" on agent_logs for insert with check (user_id = auth.uid());
create policy "agent_logs_delete" on agent_logs for delete using (user_id = auth.uid());

create policy "knowledge_select" on knowledge for select using (user_id = auth.uid());
create policy "knowledge_insert" on knowledge for insert with check (user_id = auth.uid());
create policy "knowledge_update" on knowledge for update using (user_id = auth.uid());
create policy "knowledge_delete" on knowledge for delete using (user_id = auth.uid());

create policy "scheduled_jobs_select" on scheduled_jobs for select using (user_id = auth.uid());
create policy "scheduled_jobs_insert" on scheduled_jobs for insert with check (user_id = auth.uid());
create policy "scheduled_jobs_update" on scheduled_jobs for update using (user_id = auth.uid());
create policy "scheduled_jobs_delete" on scheduled_jobs for delete using (user_id = auth.uid());

create policy "job_runs_select" on job_runs for select using (user_id = auth.uid());
create policy "job_runs_insert" on job_runs for insert with check (user_id = auth.uid());
create policy "job_runs_update" on job_runs for update using (user_id = auth.uid());
create policy "job_runs_delete" on job_runs for delete using (user_id = auth.uid());

create policy "approvals_select" on approvals for select using (user_id = auth.uid());
create policy "approvals_insert" on approvals for insert with check (user_id = auth.uid());
create policy "approvals_update" on approvals for update using (user_id = auth.uid());
create policy "approvals_delete" on approvals for delete using (user_id = auth.uid());

create policy "api_keys_select" on api_keys for select using (user_id = auth.uid());
create policy "api_keys_insert" on api_keys for insert with check (user_id = auth.uid());
create policy "api_keys_update" on api_keys for update using (user_id = auth.uid());

-- Knowledge RPCs: add p_user_id and scope by user
create or replace function match_knowledge(
  query_embedding vector(384),
  match_threshold float default 0.7,
  match_count int default 5,
  p_agent_type text default null,
  p_user_id uuid default null
)
returns table (
  id uuid,
  learning text,
  frequency int,
  last_seen_at timestamptz,
  similarity float
) as $$
begin
  return query
  select
    k.id,
    k.learning,
    k.frequency,
    k.last_seen_at,
    1 - (k.embedding <=> query_embedding) as similarity
  from knowledge k
  where
    (p_user_id is null or k.user_id = p_user_id)
    and (p_agent_type is null or k.agent_type = p_agent_type)
    and k.embedding is not null
    and 1 - (k.embedding <=> query_embedding) > match_threshold
  order by k.embedding <=> query_embedding
  limit match_count;
end;
$$ language plpgsql security definer;

create or replace function upsert_knowledge(
  p_learning text,
  p_embedding vector(384),
  p_work_order_id uuid default null,
  p_agent_type text default null,
  p_user_id uuid default null,
  p_similarity_threshold float default 0.92
)
returns uuid as $$
declare
  v_existing_id uuid;
  v_result_id uuid;
begin
  select id into v_existing_id
  from knowledge
  where (p_user_id is null or user_id = p_user_id)
    and embedding is not null
    and 1 - (embedding <=> p_embedding) > p_similarity_threshold
  order by embedding <=> p_embedding
  limit 1;

  if v_existing_id is not null then
    update knowledge
    set frequency = frequency + 1,
        last_seen_at = now()
    where id = v_existing_id;
    return v_existing_id;
  else
    insert into knowledge (learning, embedding, work_order_id, agent_type, user_id)
    values (p_learning, p_embedding, p_work_order_id, p_agent_type, p_user_id)
    returning id into v_result_id;
    return v_result_id;
  end if;
end;
$$ language plpgsql security definer;
