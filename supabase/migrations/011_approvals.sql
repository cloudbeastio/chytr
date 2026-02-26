create table approvals (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid references work_orders(id) on delete cascade not null,
  agent_id uuid references agents(id) on delete set null,
  question text not null,
  context jsonb default '{}',
  options jsonb default '[]',
  status approval_status default 'pending',
  decision text,
  decided_by text,
  decided_at timestamptz,
  expires_at timestamptz default (now() + interval '24 hours'),
  created_at timestamptz default now()
);
create index idx_approvals_status on approvals(status);
create index idx_approvals_work_order on approvals(work_order_id);
create index idx_approvals_expires on approvals(expires_at) where status = 'pending';
