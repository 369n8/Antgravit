-- ============================================================
-- FrotaApp — Expansão Operacional
-- 20260306000003_fleet_expansion
-- ============================================================

-- ── Storage Buckets ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('checkin-photos', 'checkin-photos', true),
  ('fine-photos',    'fine-photos',    true)
ON CONFLICT (id) DO NOTHING;

-- Políticas: autenticados sobem, público lê
CREATE POLICY "checkin upload auth"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'checkin-photos');

CREATE POLICY "checkin read public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'checkin-photos');

CREATE POLICY "checkin delete auth"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'checkin-photos');

CREATE POLICY "fine upload auth"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fine-photos');

CREATE POLICY "fine read public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fine-photos');

CREATE POLICY "fine delete auth"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'fine-photos');

-- ── Tabela: checkins ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.checkins (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID        NOT NULL REFERENCES public.clients(id)  ON DELETE CASCADE,
  vehicle_id   UUID        NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  tenant_id    UUID        REFERENCES public.tenants(id)           ON DELETE SET NULL,
  checkin_type TEXT        NOT NULL DEFAULT 'entrega'
                             CHECK (checkin_type IN ('entrega', 'devolucao')),
  mileage      NUMERIC(10,1),
  fuel_level   INT         CHECK (fuel_level BETWEEN 0 AND 100),
  photos       JSONB       NOT NULL DEFAULT '[]',
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checkins: acesso pelo client dono"
  ON public.checkins FOR ALL USING (client_id = auth.uid());

-- ── Tabela: insurance ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.insurance (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID        NOT NULL REFERENCES public.clients(id)  ON DELETE CASCADE,
  vehicle_id     UUID        NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  insurer        TEXT,
  policy_number  TEXT,
  pay_date       DATE,
  expiry_date    DATE,
  amount         NUMERIC(10,2) DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.insurance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insurance: acesso pelo client dono"
  ON public.insurance FOR ALL USING (client_id = auth.uid());

-- ── Tabela: fines ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fines (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID        NOT NULL REFERENCES public.clients(id)  ON DELETE CASCADE,
  vehicle_id      UUID        NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  tenant_id       UUID        REFERENCES public.tenants(id)           ON DELETE SET NULL,
  photo_url       TEXT,
  photo_path      TEXT,
  amount          NUMERIC(10,2) DEFAULT 0,
  date            DATE,
  description     TEXT,
  infraction_code TEXT,
  status          TEXT        NOT NULL DEFAULT 'pendente'
                                CHECK (status IN ('pendente', 'pago', 'contestado')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fines: acesso pelo client dono"
  ON public.fines FOR ALL USING (client_id = auth.uid());
