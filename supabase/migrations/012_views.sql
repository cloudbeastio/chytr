create view agent_stats as
select
  a.id as agent_id,
  a.name,
  a.status,
  a.last_heartbeat,
  count(wo.id) as total_runs,
  count(wo.id) filter (where wo.status = 'completed') as completed,
  count(wo.id) filter (where wo.status = 'failed') as failed,
  count(wo.id) filter (where wo.status = 'running') as running,
  avg(wo.duration_ms) as avg_duration_ms,
  sum(wo.tokens_input) as total_tokens_in,
  sum(wo.tokens_output) as total_tokens_out,
  sum(wo.total_cost) as total_cost
from agents a
left join work_orders wo on wo.agent_id = a.id
group by a.id, a.name, a.status, a.last_heartbeat;

create view tool_stats as
select
  payload->>'tool_name' as tool_name,
  count(*) as call_count,
  count(*) filter (where (payload->>'success')::boolean = true) as success_count,
  count(*) filter (where (payload->>'success')::boolean = false) as failure_count,
  avg((payload->>'duration_ms')::int) as avg_duration_ms,
  max(created_at) as last_used_at
from agent_logs
where event_type = 'tool_call'
  and payload->>'tool_name' is not null
group by payload->>'tool_name';

create view skill_stats as
select
  payload->>'skill_name' as skill_name,
  al.agent_id,
  count(*) as load_count,
  max(al.created_at) as last_used_at
from agent_logs al
where al.event_type = 'skill_load'
  and payload->>'skill_name' is not null
group by payload->>'skill_name', al.agent_id;
