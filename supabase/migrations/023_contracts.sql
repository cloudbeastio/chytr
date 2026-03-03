-- Contract model: agreements above work orders
-- Enums
create type contract_status as enum ('draft', 'active', 'paused', 'closed');
create type contract_type as enum ('one_off', 'master', 'retainer');

-- contracts table
create table contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  description text,
  type contract_type not null default 'one_off',
  status contract_status not null default 'draft',
  account_name text,
  account_contact text,
  account_email text,
  account_phone text,
  schedule_config jsonb,
  budget_limit numeric(10,2),
  is_default boolean not null default false,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index idx_contracts_default_per_user on contracts(user_id) where is_default = true;
create index idx_contracts_user_id on contracts(user_id);
create index idx_contracts_status on contracts(status);
create trigger update_contracts_updated_at
  before update on contracts
  for each row execute function update_updated_at_column();

-- work_order_templates table
create table work_order_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  contract_id uuid references contracts(id) on delete set null,
  name text not null,
  description text,
  template jsonb not null default '{}',
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_work_order_templates_user_id on work_order_templates(user_id);
create index idx_work_order_templates_contract_id on work_order_templates(contract_id);
create trigger update_work_order_templates_updated_at
  before update on work_order_templates
  for each row execute function update_updated_at_column();

-- Add contract_id to work_orders and scheduled_jobs
alter table work_orders add column if not exists contract_id uuid references contracts(id) on delete set null;
create index idx_work_orders_contract_id on work_orders(contract_id);

alter table scheduled_jobs add column if not exists contract_id uuid references contracts(id) on delete set null;
create index idx_scheduled_jobs_contract_id on scheduled_jobs(contract_id);

-- Backfill: create default contract per user and link existing rows
do $$
declare
  v_user_id uuid;
  v_contract_id uuid;
begin
  for v_user_id in (
    select distinct user_id from work_orders where user_id is not null
    union
    select distinct user_id from scheduled_jobs where user_id is not null
  )
  loop
    select id into v_contract_id from contracts where user_id = v_user_id and is_default = true limit 1;
    if v_contract_id is null then
      insert into contracts (user_id, name, type, status, is_default)
      values (v_user_id, 'Default', 'one_off', 'active', true)
      returning id into v_contract_id;
    end if;
    if v_contract_id is not null then
      update work_orders set contract_id = v_contract_id where user_id = v_user_id and contract_id is null;
      update scheduled_jobs set contract_id = v_contract_id where user_id = v_user_id and contract_id is null;
    end if;
  end loop;
end $$;

-- Function: get or create default contract for user (for trigger)
create or replace function get_or_create_default_contract(p_user_id uuid)
returns uuid as $$
declare
  v_id uuid;
begin
  if p_user_id is null then
    return null;
  end if;
  perform pg_advisory_xact_lock(hashtext(p_user_id::text)::bigint);
  select id into v_id from contracts where user_id = p_user_id and is_default = true limit 1;
  if v_id is not null then
    return v_id;
  end if;
  insert into contracts (user_id, name, type, status, is_default)
  values (p_user_id, 'Default', 'one_off', 'active', true)
  returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer;

-- Trigger: auto-assign default contract on work_orders insert when contract_id is null
create or replace function work_orders_assign_default_contract()
returns trigger as $$
begin
  if new.contract_id is null and new.user_id is not null then
    new.contract_id := get_or_create_default_contract(new.user_id);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_work_orders_assign_default_contract
  before insert on work_orders
  for each row execute function work_orders_assign_default_contract();

-- RLS for contracts
alter table contracts enable row level security;
create policy "users crud own contracts" on contracts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- RLS for work_order_templates
alter table work_order_templates enable row level security;
create policy "users crud own work_order_templates" on work_order_templates for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- View: contract_stats
create view contract_stats as
select
  c.id as contract_id,
  c.user_id,
  c.name,
  c.type,
  c.status,
  c.budget_limit,
  count(wo.id) as total_work_orders,
  count(wo.id) filter (where wo.status = 'completed') as completed,
  count(wo.id) filter (where wo.status = 'failed') as failed,
  count(wo.id) filter (where wo.status = 'running') as running,
  count(wo.id) filter (where wo.status = 'pending') as pending,
  count(wo.id) filter (where wo.status = 'draft') as draft,
  count(wo.id) filter (where wo.status = 'cancelled') as cancelled,
  coalesce(sum(wo.total_cost), 0) as total_cost,
  coalesce(sum(wo.tokens_input), 0) as total_tokens_input,
  coalesce(sum(wo.tokens_output), 0) as total_tokens_output
from contracts c
left join work_orders wo on wo.contract_id = c.id
group by c.id, c.user_id, c.name, c.type, c.status, c.budget_limit;

-- Update get_work_order to include contract fields
create or replace function get_work_order(p_work_order_id uuid)
returns jsonb as $$
declare
  v_result jsonb;
begin
  select row_to_json(t)::jsonb into v_result
  from (
    select
      wo.*,
      ar.repo_url,
      ar.default_branch,
      a.name as agent_name,
      a.system_prompt,
      a.default_config,
      c.id as contract_id,
      c.name as contract_name,
      c.type as contract_type,
      c.status as contract_status,
      c.account_name as contract_account_name
    from work_orders wo
    left join agent_repos ar on ar.id = wo.repo_id
    left join agents a on a.id = wo.agent_id
    left join contracts c on c.id = wo.contract_id
    where wo.id = p_work_order_id
  ) t;
  return v_result;
end;
$$ language plpgsql security definer;

-- Update run_scheduled_job to set contract_id on spawned work order
create or replace function run_scheduled_job(p_job_id uuid)
returns void as $$
declare
  v_job record;
  v_job_run_id uuid;
  v_work_order_id uuid;
  v_template jsonb;
begin
  select id, user_id, agent_id, repo_id, work_order_template, enabled, contract_id
  into v_job
  from scheduled_jobs
  where id = p_job_id and enabled = true;

  if not found or not v_job.enabled or v_job.user_id is null then
    return;
  end if;

  v_template := coalesce(v_job.work_order_template, '{}'::jsonb);

  insert into job_runs (job_id, user_id, status)
  values (p_job_id, v_job.user_id, 'running')
  returning id into v_job_run_id;

  insert into work_orders (
    user_id,
    contract_id,
    agent_id,
    repo_id,
    source,
    status,
    objective,
    lines,
    constraints,
    exploration_hints,
    reference_patterns,
    tools,
    verification,
    agent_config,
    environment,
    deliverables,
    metadata
  )
  values (
    v_job.user_id,
    v_job.contract_id,
    v_job.agent_id,
    v_job.repo_id,
    'job',
    'pending',
    v_template->>'objective',
    coalesce(v_template->'lines', '[]'::jsonb),
    coalesce(v_template->'constraints', '{}'::jsonb),
    coalesce(v_template->'exploration_hints', '{}'::jsonb),
    coalesce(v_template->'reference_patterns', '{}'::jsonb),
    coalesce(v_template->'tools', '{}'::jsonb),
    coalesce(v_template->'verification', '{}'::jsonb),
    coalesce(v_template->'agent_config', '{}'::jsonb),
    coalesce(v_template->'environment', '{}'::jsonb),
    coalesce(v_template->'deliverables', '{}'::jsonb),
    jsonb_build_object('job_id', p_job_id, 'job_run_id', v_job_run_id)
  )
  returning id into v_work_order_id;

  update job_runs
  set work_order_id = v_work_order_id
  where id = v_job_run_id;

  update scheduled_jobs
  set last_run_at = now()
  where id = p_job_id;
end;
$$ language plpgsql security definer;

-- Drop parent_work_order_id from work_orders
alter table work_orders drop column if exists parent_work_order_id;
