create table knowledge (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid references work_orders(id) on delete set null,
  agent_type text,
  learning text not null,
  embedding vector(384),
  frequency int default 1,
  last_seen_at timestamptz default now(),
  created_at timestamptz default now()
);
create index idx_knowledge_agent_type on knowledge(agent_type);
create index idx_knowledge_embedding on knowledge using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
