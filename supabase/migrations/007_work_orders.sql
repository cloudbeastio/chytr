create table work_orders (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references agents(id) on delete set null,
  repo_id uuid references agent_repos(id) on delete set null,
  source work_order_source default 'cloud',
  objective text,
  status work_order_status default 'pending',
  branch_name text,
  cursor_agent_id text,
  pr_url text,
  summary text,
  error_message text,
  parent_work_order_id uuid references work_orders(id) on delete set null,
  tokens_input int default 0,
  tokens_output int default 0,
  total_cost numeric(10,6) default 0,
  model text,
  duration_ms int,
  lines jsonb,
  constraints jsonb default '{}',
  exploration_hints jsonb default '{}',
  reference_patterns jsonb default '{}',
  tools jsonb default '{}',
  verification jsonb default '{}',
  agent_config jsonb default '{}',
  environment jsonb default '{}',
  deliverables jsonb default '{}',
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  finished_at timestamptz
);
create index idx_work_orders_status on work_orders(status);
create index idx_work_orders_agent on work_orders(agent_id);
create index idx_work_orders_source on work_orders(source);
create index idx_work_orders_created on work_orders(created_at desc);
create trigger update_work_orders_updated_at
  before update on work_orders
  for each row execute function update_updated_at_column();
