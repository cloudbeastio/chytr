alter table agents add column user_id uuid references auth.users(id) on delete cascade default auth.uid();
alter table work_orders add column user_id uuid references auth.users(id) on delete cascade default auth.uid();

create index idx_agents_user on agents(user_id);
create index idx_work_orders_user on work_orders(user_id);

-- Backfill existing rows to first auth user (if any exist)
do $$
declare
  first_uid uuid;
begin
  select id into first_uid from auth.users order by created_at limit 1;
  if first_uid is not null then
    update agents set user_id = first_uid where user_id is null;
    update work_orders set user_id = first_uid where user_id is null;
  end if;
end;
$$;
