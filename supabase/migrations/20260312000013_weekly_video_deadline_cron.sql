-- Cron: check-weekly-video-deadline — toda segunda às 09:00 BRT (12:00 UTC)
SELECT cron.schedule(
  'check-weekly-video-deadline',
  '0 12 * * 1',
  $$
  SELECT net.http_post(
    url    := current_setting('app.supabase_functions_url') || '/check-weekly-video-deadline',
    body   := '{}',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    )
  )
  $$
) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule;
