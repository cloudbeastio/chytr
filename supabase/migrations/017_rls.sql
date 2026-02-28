-- profiles
alter table profiles enable row level security;
create policy "users read own profile"   on profiles for select using (auth.uid() = id);
create policy "users update own profile" on profiles for update using (auth.uid() = id);

-- agents
alter table agents enable row level security;
create policy "users crud own agents" on agents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- agent_repos (child of agents)
alter table agent_repos enable row level security;
create policy "users crud own agent_repos" on agent_repos for all
  using (exists (select 1 from agents where agents.id = agent_repos.agent_id and agents.user_id = auth.uid()))
  with check (exists (select 1 from agents where agents.id = agent_repos.agent_id and agents.user_id = auth.uid()));

-- work_orders
alter table work_orders enable row level security;
create policy "users crud own work_orders" on work_orders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- agent_logs (child of work_orders)
alter table agent_logs enable row level security;
create policy "users read own agent_logs" on agent_logs for select
  using (exists (select 1 from work_orders where work_orders.id = agent_logs.work_order_id and work_orders.user_id = auth.uid()));
create policy "users insert own agent_logs" on agent_logs for insert
  with check (exists (select 1 from work_orders where work_orders.id = agent_logs.work_order_id and work_orders.user_id = auth.uid()));

-- knowledge (child of work_orders)
alter table knowledge enable row level security;
create policy "users read own knowledge" on knowledge for select
  using (exists (select 1 from work_orders where work_orders.id = knowledge.work_order_id and work_orders.user_id = auth.uid()));

-- approvals (child of work_orders)
alter table approvals enable row level security;
create policy "users crud own approvals" on approvals for all
  using (exists (select 1 from work_orders where work_orders.id = approvals.work_order_id and work_orders.user_id = auth.uid()))
  with check (exists (select 1 from work_orders where work_orders.id = approvals.work_order_id and work_orders.user_id = auth.uid()));

-- scheduled_jobs (child of agents)
alter table scheduled_jobs enable row level security;
create policy "users crud own scheduled_jobs" on scheduled_jobs for all
  using (exists (select 1 from agents where agents.id = scheduled_jobs.agent_id and agents.user_id = auth.uid()))
  with check (exists (select 1 from agents where agents.id = scheduled_jobs.agent_id and agents.user_id = auth.uid()));

-- job_runs (child of scheduled_jobs -> agents)
alter table job_runs enable row level security;
create policy "users crud own job_runs" on job_runs for all
  using (exists (
    select 1 from scheduled_jobs
    join agents on agents.id = scheduled_jobs.agent_id
    where scheduled_jobs.id = job_runs.job_id and agents.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from scheduled_jobs
    join agents on agents.id = scheduled_jobs.agent_id
    where scheduled_jobs.id = job_runs.job_id and agents.user_id = auth.uid()
  ));

-- instance_config stays open to authenticated users (read-only)
alter table instance_config enable row level security;
create policy "authenticated read instance_config" on instance_config for select to authenticated using (true);
