-- Cleanup expired logs based on license tier
select cron.schedule('cleanup-expired-logs', '0 3 * * *', $$
  delete from agent_logs
  where created_at < now() - (
    select case
      when value::jsonb->>'tier' = 'team' then interval '90 days'
      when value::jsonb->>'tier' = 'pro'  then interval '30 days'
      else interval '3 days'
    end
    from instance_config where key = 'license_decoded'
    limit 1
  );
$$);

-- Mark agents offline after 10 min silence
select cron.schedule('mark-agents-offline', '*/5 * * * *', $$
  update agents
  set status = 'offline'
  where status = 'active'
    and (last_heartbeat is null or last_heartbeat < now() - interval '10 minutes');
$$);

-- Expire pending approvals
select cron.schedule('expire-approvals', '0 * * * *', $$
  update approvals
  set status = 'expired'
  where status = 'pending'
    and expires_at is not null
    and expires_at < now();
$$);

-- Run due scheduled jobs via Next.js API
select cron.schedule('run-scheduled-jobs', '* * * * *', $$
  select net.http_post(
    url := current_setting('app.chytr_url') || '/api/v1/jobs/cron',
    body := json_build_object('job_id', id)::jsonb,
    headers := json_build_object(
      'Authorization', 'Bearer ' || current_setting('app.chytr_api_key'),
      'Content-Type', 'application/json'
    )::jsonb
  )
  from scheduled_jobs
  where enabled = true
    and next_run_at <= now()
    and (last_run_at is null or last_run_at < now() - interval '50 seconds');
$$);
