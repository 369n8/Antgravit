-- Cron: daily-expiry-check — todos os dias às 10:30 UTC (07:30 BRT)
SELECT cron.schedule(
  'daily-expiry-check',
  '30 10 * * *',
  $$
  SELECT net.http_post(
    url    := current_setting('app.supabase_functions_url') || '/daily-expiry-check',
    body   := '{}',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    )
  )
  $$
) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule;
