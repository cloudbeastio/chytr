create table agent_logs (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid references work_orders(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
  event_type log_event_type not null,
  payload jsonb default '{}',
  sequence_number int,
  created_at timestamptz default now()
);
create index idx_agent_logs_work_order on agent_logs(work_order_id);
create index idx_agent_logs_event_type on agent_logs(event_type);
create index idx_agent_logs_created on agent_logs(created_at desc);
create index idx_agent_logs_agent on agent_logs(agent_id);

-- Enable realtime
alter table agent_logs replica identity full;
