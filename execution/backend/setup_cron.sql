-- ============================================================
-- setup_cron.sql — Agendamento do Briefing Matinal MyFrot
-- ============================================================
-- PRÉ-REQUISITOS (rodar UMA VEZ no Supabase SQL Editor):
--   As extensões pg_cron e pg_net já vêm habilitadas nos projetos
--   Supabase Pro/Free. Se não estiverem, habilite em:
--   Dashboard → Database → Extensions → pg_cron / pg_net
-- ============================================================

-- 1. Garantir extensões
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Remover job antigo se existir (idempotente)
SELECT cron.unschedule('daily-ai-report') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-ai-report'
);

-- 3. Agendar: todo dia às 11:00 UTC = 08:00 BRT
--    Ajuste a hora se seu fuso for diferente:
--      09:00 BRT → 12:00 UTC
--      08:00 BRT → 11:00 UTC  ← padrão aqui
SELECT cron.schedule(
  'daily-ai-report',           -- nome do job (único)
  '0 11 * * *',                -- cron expression: 11:00 UTC diário
  $$
    SELECT net.http_post(
      url     := 'https://bmwvigbktrypgkcbxlxi.supabase.co/functions/v1/daily-ai-report',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- ============================================================
-- ALTERNATIVA: Se current_setting não tiver a chave configurada,
-- use a chave diretamente (só em ambiente seguro, nunca commite):
-- ============================================================
-- SELECT cron.schedule(
--   'daily-ai-report',
--   '0 11 * * *',
--   $$
--     SELECT net.http_post(
--       url     := 'https://bmwvigbktrypgkcbxlxi.supabase.co/functions/v1/daily-ai-report',
--       headers := '{"Content-Type":"application/json","Authorization":"Bearer SUA_SERVICE_ROLE_KEY"}'::jsonb,
--       body    := '{}'::jsonb
--     );
--   $$
-- );

-- 4. Verificar que o job foi registrado
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname = 'daily-ai-report';

-- ============================================================
-- PARA TESTAR MANUALMENTE (disparo imediato de um cliente):
-- ============================================================
-- SELECT net.http_post(
--   url     := 'https://bmwvigbktrypgkcbxlxi.supabase.co/functions/v1/daily-ai-report',
--   headers := '{"Content-Type":"application/json","Authorization":"Bearer SUA_SERVICE_ROLE_KEY"}'::jsonb,
--   body    := '{"manual_for_client":"<uuid-do-client>"}'::jsonb
-- );
