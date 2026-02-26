create table agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  system_prompt text,
  type text default 'cursor',
  default_config jsonb default '{}',
  status agent_status default 'idle',
  last_heartbeat timestamptz,
  notification_config jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_agents_status on agents(status);
create trigger update_agents_updated_at
  before update on agents
  for each row execute function update_updated_at_column();
