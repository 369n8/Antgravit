-- ============================================================
-- FrotaApp v1 - Schema Inicial
-- Migração: 20260305000000_frotaapp_initial_schema
-- ============================================================

-- ────────────────────────────────────────────
-- TABELA: clients
-- Donos das frotas (clientes do SaaS)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients: leitura pelo proprio dono"
  ON public.clients FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "clients: insercao pelo proprio dono"
  ON public.clients FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "clients: atualizacao pelo proprio dono"
  ON public.clients FOR UPDATE
  USING (auth.uid() = id);


-- ────────────────────────────────────────────
-- TABELA: vehicles
-- Veículos da frota vinculados a um client
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vehicles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('car', 'moto')),
  brand           TEXT,
  model           TEXT,
  year            INT,
  plate           TEXT,
  color           TEXT,
  km              NUMERIC(10,1) DEFAULT 0,
  fuel_level      INT DEFAULT 100 CHECK (fuel_level BETWEEN 0 AND 100),
  tire_condition  TEXT,
  status          TEXT NOT NULL DEFAULT 'disponivel'
                    CHECK (status IN ('locado', 'disponivel', 'manutencao')),
  rent_weekly     NUMERIC(10,2) DEFAULT 0,
  docs_ipva       DATE,
  docs_seguro     DATE,
  docs_revisao    DATE,
  fines           TEXT,
  dents           TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vehicles_client_id ON public.vehicles(client_id);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicles: acesso pelo client dono"
  ON public.vehicles FOR ALL
  USING (client_id = auth.uid());


-- ────────────────────────────────────────────
-- TABELA: tenants
-- Motoristas / Locatários
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  vehicle_id        UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  cpf               TEXT,
  rg                TEXT,
  birth_date        DATE,
  phone             TEXT,
  email             TEXT,
  cnh               TEXT,
  cnh_expiry        DATE,
  cnh_category      TEXT,
  app_used          TEXT,
  address           TEXT,
  emergency_contact TEXT,
  rent_weekly       NUMERIC(10,2) DEFAULT 0,
  deposits          NUMERIC(10,2) DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'ativo'
                      CHECK (status IN ('ativo', 'encerrado')),
  blacklisted       BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenants_client_id   ON public.tenants(client_id);
CREATE INDEX idx_tenants_vehicle_id  ON public.tenants(vehicle_id);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenants: acesso pelo client dono"
  ON public.tenants FOR ALL
  USING (client_id = auth.uid());


-- ────────────────────────────────────────────
-- TABELA: payments
-- Obrigações financeiras e pagamentos
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  week_label      TEXT,
  due_date        DATE,
  paid_date       DATE,
  value_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid_status     BOOLEAN NOT NULL DEFAULT false,
  payment_method  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_client_id ON public.payments(client_id);
CREATE INDEX idx_payments_tenant_id ON public.payments(tenant_id);
CREATE INDEX idx_payments_due_date  ON public.payments(due_date);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments: acesso pelo client dono"
  ON public.payments FOR ALL
  USING (client_id = auth.uid());


-- ────────────────────────────────────────────
-- TABELA: maintenance
-- Manutenções e despesas por veículo
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.maintenance (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  vehicle_id   UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL CHECK (event_type IN ('expense', 'schedule')),
  category     TEXT,
  date         DATE,
  description  TEXT,
  value_amount NUMERIC(10,2) DEFAULT 0,
  done         BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_maintenance_client_id  ON public.maintenance(client_id);
CREATE INDEX idx_maintenance_vehicle_id ON public.maintenance(vehicle_id);
CREATE INDEX idx_maintenance_date       ON public.maintenance(date);

ALTER TABLE public.maintenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maintenance: acesso pelo client dono"
  ON public.maintenance FOR ALL
  USING (client_id = auth.uid());
