-- Migration: weekly_checks
-- Tabela para relatório semanal do locatário: km, nível de óleo, vídeo
-- O locatário envia presencialmente ou via formulário no Portal
-- O dono aprova ou rejeita pelo app

CREATE TABLE IF NOT EXISTS public.weekly_checks (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     UUID        NOT NULL REFERENCES public.clients(id)  ON DELETE CASCADE,
  tenant_id     UUID        REFERENCES public.tenants(id)           ON DELETE SET NULL,
  vehicle_id    UUID        REFERENCES public.vehicles(id)          ON DELETE SET NULL,
  week_start    DATE        NOT NULL,
  current_km    INTEGER,
  oil_level     TEXT        CHECK (oil_level IN ('ok', 'baixo', 'trocar')),
  video_url     TEXT,
  photo_url     TEXT,
  notes         TEXT,
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'submitted', 'approved', 'rejected')),
  submitted_at  TIMESTAMPTZ,
  approved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.weekly_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_checks: select próprio client"
  ON public.weekly_checks FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "weekly_checks: insert próprio client"
  ON public.weekly_checks FOR INSERT
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "weekly_checks: update próprio client"
  ON public.weekly_checks FOR UPDATE
  USING (client_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_weekly_checks_client ON public.weekly_checks(client_id, week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_checks_tenant ON public.weekly_checks(tenant_id, week_start);

COMMENT ON TABLE public.weekly_checks IS 'Relatório semanal do locatário: km, nível de óleo e vídeo do veículo';
COMMENT ON COLUMN public.weekly_checks.oil_level IS 'ok=normal, baixo=precisa completar, trocar=troca urgente';
