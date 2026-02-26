create table instance_config (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);
insert into instance_config (key, value) values
  ('instance_id', gen_random_uuid()::text),
  ('activated_at', '');
