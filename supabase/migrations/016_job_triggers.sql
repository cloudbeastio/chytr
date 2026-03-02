-- Function: run a single scheduled job (insert work order from template, job_run, update last_run_at)
-- Called by pg_cron for each scheduled job.
create or replace function run_scheduled_job(p_job_id uuid)
returns void as $$
declare
  v_job record;
  v_job_run_id uuid;
  v_work_order_id uuid;
  v_template jsonb;
begin
  select id, user_id, agent_id, repo_id, work_order_template, enabled
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

-- Trigger function: manage pg_cron entries when scheduled_jobs rows change
create or replace function manage_scheduled_job_cron()
returns trigger as $$
declare
  v_job_name text;
  v_cmd text;
begin
  if tg_op = 'DELETE' then
    v_job_name := 'job_' || old.id::text;
    perform cron.unschedule(v_job_name);
    return old;
  end if;

  if tg_op = 'UPDATE' then
    v_job_name := 'job_' || old.id::text;
    perform cron.unschedule(v_job_name);
    if new.enabled = false then
      return new;
    end if;
  end if;

  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.enabled = true) then
    v_job_name := 'job_' || new.id::text;
    v_cmd := format('SELECT run_scheduled_job(%L)', new.id);
    perform cron.schedule(v_job_name, new.cron_expression, v_cmd);
  end if;

  return coalesce(new, old);
end;
$$ language plpgsql security definer;

create trigger trg_manage_scheduled_job_cron
  after insert or update or delete on scheduled_jobs
  for each row
  execute function manage_scheduled_job_cron();

-- Remove the old run-scheduled-jobs cron that used pg_net to call the edge function
select cron.unschedule('run-scheduled-jobs');

-- Backfill: schedule cron for existing enabled jobs that have user_id
do $$
declare
  r record;
begin
  for r in select id, cron_expression from scheduled_jobs where enabled = true and user_id is not null
  loop
    perform cron.schedule('job_' || r.id::text, r.cron_expression, format('SELECT run_scheduled_job(%L)', r.id));
  end loop;
end $$;
