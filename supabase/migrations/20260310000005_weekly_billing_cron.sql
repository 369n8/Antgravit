-- Migration: weekly_billing_cron
-- Adiciona coluna week_start em payments para lookup eficiente
-- e agenda as Edge Functions de billing + reminder via pg_cron

-- ── payments.week_start ───────────────────────────────────────────────────────
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS week_start DATE;

COMMENT ON COLUMN public.payments.week_start IS 'Segunda-feira da semana de referência (gerado automaticamente pelo weekly-billing)';

CREATE INDEX IF NOT EXISTS idx_payments_week_start
  ON public.payments (tenant_id, week_start)
  WHERE week_start IS NOT NULL;

-- ── pg_cron: weekly-billing (toda segunda às 06:00 BRT = 09:00 UTC) ───────────
-- Requer extensão pg_cron habilitada no Supabase (Settings → Database → Extensions)
-- e a variável SUPABASE_URL configurada abaixo.
--
-- ATENÇÃO: substitua <PROJECT_REF> e <SERVICE_ROLE_KEY> pelos valores reais,
-- ou use o Supabase Dashboard → Edge Functions → Scheduled para configurar.

SELECT cron.schedule(
  'weekly-billing',
  '0 9 * * 1',  -- toda segunda-feira 09:00 UTC (06:00 BRT)
  $$
  SELECT net.http_post(
    url    := current_setting('app.supabase_functions_url') || '/weekly-billing',
    body   := '{}',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_key')
    )
  )
  $$
);

-- ── pg_cron: reminder-bot (toda sexta às 12:00 BRT = 15:00 UTC) ──────────────
SELECT cron.schedule(
  'reminder-bot',
  '0 15 * * 5',  -- toda sexta-feira 15:00 UTC (12:00 BRT)
  $$
  SELECT net.http_post(
    url    := current_setting('app.supabase_functions_url') || '/reminder-bot',
    body   := '{}',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_key')
    )
  )
  $$
);
