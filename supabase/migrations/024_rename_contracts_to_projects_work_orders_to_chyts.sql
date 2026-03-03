-- Rename: contracts -> projects, work_orders -> chyts, work_order_templates -> chyt_templates
-- Column renames: contract_id -> project_id, work_order_id -> chyt_id where applicable

-- 1. New enums (contract_* -> project_*)
create type project_status as enum ('draft', 'active', 'paused', 'closed');
create type project_type as enum ('one_off', 'master', 'retainer');

-- 2. Rename tables
alter table contracts rename to projects;
alter table work_orders rename to chyts;
alter table work_order_templates rename to chyt_templates;

-- 3. Migrate projects columns from contract_* enums to project_*
alter table projects alter column status type project_status using status::text::project_status;
alter table projects alter column type type project_type using type::text::project_type;
drop type if exists contract_status;
drop type if exists contract_type;

-- 4. Rename contract_id -> project_id
alter table chyts rename column contract_id to project_id;
alter table scheduled_jobs rename column contract_id to project_id;
alter table chyt_templates rename column contract_id to project_id;

-- 5. Rename work_order_id -> chyt_id (FKs now reference chyts)
alter table job_runs rename column work_order_id to chyt_id;
alter table agent_logs rename column work_order_id to chyt_id;
alter table knowledge rename column work_order_id to chyt_id;
alter table approvals rename column work_order_id to chyt_id;

-- 6. Drop old view and trigger/function
drop view if exists contract_stats;
drop trigger if exists trg_work_orders_assign_default_contract on chyts;
drop function if exists work_orders_assign_default_contract();
drop function if exists get_or_create_default_contract(uuid);
drop function if exists get_work_order(uuid);

-- 8. Recreate trigger + function for default project on chyts
create or replace function get_or_create_default_project(p_user_id uuid)
returns uuid as $$
declare v_id uuid;
begin
  if p_user_id is null then return null; end if;
  perform pg_advisory_xact_lock(hashtext(p_user_id::text)::bigint);
  select id into v_id from projects where user_id = p_user_id and is_default = true limit 1;
  if v_id is not null then return v_id; end if;
  insert into projects (user_id, name, type, status, is_default)
  values (p_user_id, 'Default', 'one_off', 'active', true)
  returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer;

create or replace function chyts_assign_default_project()
returns trigger as $$
begin
  if new.project_id is null and new.user_id is not null then
    new.project_id := get_or_create_default_project(new.user_id);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_chyts_assign_default_project
  before insert on chyts for each row execute function chyts_assign_default_project();

-- 9. View project_stats
create view project_stats as
select
  p.id as project_id,
  p.user_id,
  p.name,
  p.type,
  p.status,
  p.budget_limit,
  count(c.id) as total_chyts,
  count(c.id) filter (where c.status = 'completed') as completed,
  count(c.id) filter (where c.status = 'failed') as failed,
  count(c.id) filter (where c.status = 'running') as running,
  count(c.id) filter (where c.status = 'pending') as pending,
  count(c.id) filter (where c.status = 'draft') as draft,
  count(c.id) filter (where c.status = 'cancelled') as cancelled,
  coalesce(sum(c.total_cost), 0) as total_cost,
  coalesce(sum(c.tokens_input), 0) as total_tokens_input,
  coalesce(sum(c.tokens_output), 0) as total_tokens_output
from projects p
left join chyts c on c.project_id = p.id
group by p.id, p.user_id, p.name, p.type, p.status, p.budget_limit;

-- 10. get_chyt (replaces get_work_order)
create or replace function get_chyt(p_chyt_id uuid)
returns jsonb as $$
declare v_result jsonb;
begin
  select row_to_json(t)::jsonb into v_result
  from (
    select
      c.*,
      ar.repo_url,
      ar.default_branch,
      a.name as agent_name,
      a.system_prompt,
      a.default_config,
      p.id as project_id,
      p.name as project_name,
      p.type as project_type,
      p.status as project_status,
      p.account_name as project_account_name
    from chyts c
    left join agent_repos ar on ar.id = c.repo_id
    left join agents a on a.id = c.agent_id
    left join projects p on p.id = c.project_id
    where c.id = p_chyt_id
  ) t;
  return v_result;
end;
$$ language plpgsql security definer;

-- 11. run_scheduled_job: insert into chyts, set job_runs.chyt_id
create or replace function run_scheduled_job(p_job_id uuid)
returns void as $$
declare
  v_job record;
  v_job_run_id uuid;
  v_chyt_id uuid;
  v_template jsonb;
begin
  select id, user_id, agent_id, repo_id, work_order_template, enabled, project_id
  into v_job from scheduled_jobs where id = p_job_id and enabled = true;
  if not found or not v_job.enabled or v_job.user_id is null then return; end if;
  v_template := coalesce(v_job.work_order_template, '{}'::jsonb);

  insert into job_runs (job_id, user_id, status)
  values (p_job_id, v_job.user_id, 'running')
  returning id into v_job_run_id;

  insert into chyts (
    user_id, project_id, agent_id, repo_id, source, status, objective,
    lines, constraints, exploration_hints, reference_patterns, tools,
    verification, agent_config, environment, deliverables, metadata
  )
  values (
    v_job.user_id, v_job.project_id, v_job.agent_id, v_job.repo_id, 'job', 'pending',
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
  returning id into v_chyt_id;

  update job_runs set chyt_id = v_chyt_id where id = v_job_run_id;
  update scheduled_jobs set last_run_at = now() where id = p_job_id;
end;
$$ language plpgsql security definer;

-- 12. upsert_knowledge: p_work_order_id -> p_chyt_id, column knowledge.chyt_id
create or replace function upsert_knowledge(
  p_learning text,
  p_embedding vector(384),
  p_chyt_id uuid default null,
  p_agent_type text default null,
  p_similarity_threshold float default 0.92,
  p_user_id uuid default null
)
returns uuid as $$
declare v_existing_id uuid; v_result_id uuid;
begin
  select id into v_existing_id from knowledge
  where embedding is not null and 1 - (embedding <=> p_embedding) > p_similarity_threshold
  order by embedding <=> p_embedding limit 1;
  if v_existing_id is not null then
    update knowledge set frequency = frequency + 1, last_seen_at = now() where id = v_existing_id;
    return v_existing_id;
  end if;
  insert into knowledge (learning, embedding, chyt_id, agent_type, user_id)
  values (p_learning, p_embedding, p_chyt_id, p_agent_type, p_user_id)
  returning id into v_result_id;
  return v_result_id;
end;
$$ language plpgsql security definer;

-- 13. RLS: drop old policies (contracts/projects, work_orders/chyts, work_order_templates/chyt_templates)
alter table projects drop policy if exists "users crud own contracts";
alter table projects drop policy if exists "contracts_select";
alter table projects drop policy if exists "contracts_insert";
alter table projects drop policy if exists "contracts_update";
alter table projects drop policy if exists "contracts_delete";

alter table chyts drop policy if exists "users crud own work_orders";
alter table chyts drop policy if exists "work_orders_select";
alter table chyts drop policy if exists "work_orders_insert";
alter table chyts drop policy if exists "work_orders_update";
alter table chyts drop policy if exists "work_orders_delete";

alter table chyt_templates drop policy if exists "users crud own work_order_templates";
alter table chyt_templates drop policy if exists "work_order_templates_select";
alter table chyt_templates drop policy if exists "work_order_templates_insert";
alter table chyt_templates drop policy if exists "work_order_templates_update";
alter table chyt_templates drop policy if exists "work_order_templates_delete";

-- 14. RLS: child tables (agent_logs, knowledge, approvals) reference work_orders -> chyts
alter table agent_logs drop policy if exists "users read own agent_logs";
alter table agent_logs drop policy if exists "users insert own agent_logs";
create policy "users read own agent_logs" on agent_logs for select
  using (exists (select 1 from chyts where chyts.id = agent_logs.chyt_id and chyts.user_id = auth.uid()));
create policy "users insert own agent_logs" on agent_logs for insert
  with check (exists (select 1 from chyts where chyts.id = agent_logs.chyt_id and chyts.user_id = auth.uid()));

alter table knowledge drop policy if exists "users read own knowledge";
create policy "users read own knowledge" on knowledge for select
  using (exists (select 1 from chyts where chyts.id = knowledge.chyt_id and chyts.user_id = auth.uid()));

alter table approvals drop policy if exists "users crud own approvals";
create policy "users crud own approvals" on approvals for all
  using (exists (select 1 from chyts where chyts.id = approvals.chyt_id and chyts.user_id = auth.uid()))
  with check (exists (select 1 from chyts where chyts.id = approvals.chyt_id and chyts.user_id = auth.uid()));

-- 15. RLS: projects, chyts, chyt_templates
create policy "users crud own projects" on projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users crud own chyts" on chyts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users crud own chyt_templates" on chyt_templates for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 16. Triggers on projects/chyt_templates (updated_at)
drop trigger if exists update_contracts_updated_at on projects;
create trigger update_projects_updated_at before update on projects for each row execute function update_updated_at_column();
drop trigger if exists update_work_order_templates_updated_at on chyt_templates;
create trigger update_chyt_templates_updated_at before update on chyt_templates for each row execute function update_updated_at_column();
drop trigger if exists update_work_orders_updated_at on chyts;
create trigger update_chyts_updated_at before update on chyts for each row execute function update_updated_at_column();
