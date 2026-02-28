create type log_event_type as enum (
  'session_start','tool_call','tool_result','tool_failure',
  'shell_execution','file_edit','mcp_execution','skill_load',
  'agent_thought','agent_response','subagent_start','subagent_stop',
  'approval_requested','error','session_end'
);
create type agent_status as enum ('active','idle','offline','error');
create type work_order_status as enum ('pending','running','completed','failed','cancelled');
create type work_order_source as enum ('cloud','local','job');
create type approval_status as enum ('pending','resolved','expired');
create type job_run_status as enum ('pending','running','completed','failed');
