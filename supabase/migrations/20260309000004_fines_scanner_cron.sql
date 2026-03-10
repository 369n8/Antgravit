-- Automated Fines Scanner — Extensions + Cron Schedule
-- pg_net: HTTP calls from PostgreSQL
-- pg_cron: Cron job scheduler
-- Both are now enabled on the remote project via Management API.
-- This migration is idempotent — safe to re-apply.

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule fines-scanner to run daily at 03:00 BRT (06:00 UTC)
-- Removes existing job first to allow idempotent re-runs
SELECT cron.unschedule('fines-scanner-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'fines-scanner-daily'
);

SELECT cron.schedule(
  'fines-scanner-daily',
  '0 6 * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/fines-scanner',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);
