create table scheduled_jobs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  cron_expression text not null,
  agent_id uuid references agents(id) on delete set null,
  repo_id uuid references agent_repos(id) on delete set null,
  work_order_template jsonb not null default '{}',
  enabled boolean default true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table job_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references scheduled_jobs(id) on delete cascade not null,
  work_order_id uuid references work_orders(id) on delete set null,
  status job_run_status default 'pending',
  error_message text,
  started_at timestamptz default now(),
  finished_at timestamptz
);
create index idx_scheduled_jobs_enabled on scheduled_jobs(enabled);
create index idx_scheduled_jobs_next_run on scheduled_jobs(next_run_at) where enabled = true;
create index idx_job_runs_job on job_runs(job_id);
create trigger update_scheduled_jobs_updated_at
  before update on scheduled_jobs
  for each row execute function update_updated_at_column();
