-- Correlation-key coverage helper for agent_logs (P1b monitor).
-- Prefer the HTTP metric at GET /api/v1/metrics/correlation-coverage; this RPC
-- is for SQL dashboards / coo-daily style receipts.

create or replace function public.agent_logs_correlation_coverage(p_hours integer default 24)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with scoped as (
    select
      conversation_id,
      payload
    from agent_logs
    where created_at >= now() - make_interval(hours => greatest(1, least(coalesce(p_hours, 24), 168)))
      and (
        user_id = auth.uid()
        or auth.role() = 'service_role'
      )
  )
  select jsonb_build_object(
    'window_hours', greatest(1, least(coalesce(p_hours, 24), 168)),
    'total', count(*)::int,
    'with_conversation_id', count(*) filter (
      where conversation_id is not null and btrim(conversation_id) <> ''
    )::int,
    'with_cbmain', count(*) filter (
      where payload ? 'cbmain'
    )::int,
    'coverage_pct', case
      when count(*) = 0 then null
      else round(
        100.0 * count(*) filter (
          where conversation_id is not null and btrim(conversation_id) <> ''
        ) / count(*),
        2
      )
    end
  )
  from scoped;
$$;

revoke all on function public.agent_logs_correlation_coverage(integer) from public;
grant execute on function public.agent_logs_correlation_coverage(integer) to authenticated, service_role;

comment on function public.agent_logs_correlation_coverage(integer) is
  'P1b: % agent_logs with non-null conversation_id (+ cbmain presence) in a lookback window.';
