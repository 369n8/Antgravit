-- Cron adicional: segunda-feira às 10:00 UTC (07:00 BRT)
-- O daily-ai-report detecta segunda internamente e envia o briefing estratégico
SELECT cron.schedule(
  'monday-strategic-briefing',
  '0 10 * * 1',
  $$
  SELECT net.http_post(
    url    := current_setting('app.supabase_functions_url') || '/daily-ai-report',
    body   := '{}',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    )
  )
  $$
) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule;
