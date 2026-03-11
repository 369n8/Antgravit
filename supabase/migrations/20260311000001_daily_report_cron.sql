-- Migration: daily_report_cron
-- Agenda o daily-ai-report para disparar todo dia às 11:00 UTC (08:00 BRT)
-- Requer: pg_cron + pg_net habilitados no Supabase Dashboard
--         app.supabase_functions_url e app.supabase_service_key configurados

SELECT cron.schedule(
  'daily-ai-report',
  '0 11 * * *',  -- todos os dias às 11:00 UTC (08:00 BRT)
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_functions_url') || '/daily-ai-report',
    body    := '{}',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_key')
    )
  )
  $$
);
