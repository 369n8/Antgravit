-- ============================================================
-- FrotaApp — SaaS B2B Upgrade
-- Migration: 20260307000001_saas_b2b_upgrade
--
-- Escopo:
--   1. Adicionar campos Stripe + limites à tabela clients
--   2. Corrigir constraint de status em tenants (adicionar 'pendente')
--   3. Reforçar RLS com WITH CHECK explícito em todas as tabelas
--      core (vehicles, tenants, payments, maintenance)
-- ============================================================


-- ============================================================
-- PARTE 1: Tabela clients — campos SaaS/Stripe
-- ============================================================

-- Stripe Connect: conta da locadora para receber pagamentos dos motoristas
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS stripe_account_id      TEXT,
  ADD COLUMN IF NOT EXISTS stripe_connect_status  TEXT NOT NULL DEFAULT 'pending'
    CHECK (stripe_connect_status IN ('pending', 'active', 'restricted', 'deauthorized'));

-- Stripe Billing: assinatura SaaS da locadora (paga para usar a plataforma)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status    TEXT NOT NULL DEFAULT 'trialing'
    CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid'));

-- Limite de veículos do plano (padrão: 10 para o tier Starter)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS vehicle_limit          SMALLINT NOT NULL DEFAULT 10;

-- Índices para lookups via webhook do Stripe (stripe_account_id → client, stripe_customer_id → client)
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_stripe_account
  ON public.clients(stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_stripe_customer
  ON public.clients(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_stripe_subscription
  ON public.clients(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;


-- ============================================================
-- PARTE 2: Corrigir constraint de status em tenants
--
-- O pré-cadastro (Cadastro.jsx) insere com status='pendente'.
-- A constraint original só permitia 'ativo' | 'encerrado',
-- causando erro 23514 em qualquer auto-cadastro de motorista.
-- ============================================================

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_status_check;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_status_check
  CHECK (status IN ('pendente', 'ativo', 'encerrado'));


-- ============================================================
-- PARTE 3: Auditoria e blindagem RLS Multi-Tenant
--
-- Diagnóstico das policies existentes:
--   - Todas as tabelas core usam FOR ALL USING (client_id = auth.uid())
--   - No PostgreSQL, FOR ALL sem WITH CHECK usa o USING como check
--     expression para INSERT/UPDATE, então a proteção já existe.
--   - Porém, ser explícito com WITH CHECK é obrigatório em SaaS:
--     evita ambiguidade em futuras alterações e auditorias.
--
-- Estratégia:
--   1. Dropar as policies genéricas "FOR ALL" existentes
--   2. Recriar com operações separadas + WITH CHECK explícito
--   3. Adicionar policy de INSERT anônimo para pre-cadastro
--      (já existente, mas garantindo idempotência)
-- ============================================================

-- ────────────────────────────────────────────
-- vehicles
-- ────────────────────────────────────────────
DROP POLICY IF EXISTS "vehicles: acesso pelo client dono" ON public.vehicles;

CREATE POLICY "vehicles: select próprio client"
  ON public.vehicles FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "vehicles: insert próprio client"
  ON public.vehicles FOR INSERT
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "vehicles: update próprio client"
  ON public.vehicles FOR UPDATE
  USING  (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "vehicles: delete próprio client"
  ON public.vehicles FOR DELETE
  USING (client_id = auth.uid());


-- ────────────────────────────────────────────
-- tenants
-- ────────────────────────────────────────────
DROP POLICY IF EXISTS "tenants: acesso pelo client dono" ON public.tenants;

CREATE POLICY "tenants: select próprio client"
  ON public.tenants FOR SELECT
  USING (client_id = auth.uid());

-- INSERT: autenticado (admin cadastrando manualmente)
CREATE POLICY "tenants: insert próprio client"
  ON public.tenants FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid());

-- INSERT: anônimo via pre-cadastro (status obrigatoriamente pendente)
DROP POLICY IF EXISTS "allow_anon_self_register" ON public.tenants;

CREATE POLICY "tenants: insert anonimo pre-cadastro"
  ON public.tenants FOR INSERT
  TO anon
  WITH CHECK (status = 'pendente');

CREATE POLICY "tenants: update próprio client"
  ON public.tenants FOR UPDATE
  USING  (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "tenants: delete próprio client"
  ON public.tenants FOR DELETE
  USING (client_id = auth.uid());


-- ────────────────────────────────────────────
-- payments
-- ────────────────────────────────────────────
DROP POLICY IF EXISTS "payments: acesso pelo client dono" ON public.payments;

CREATE POLICY "payments: select próprio client"
  ON public.payments FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "payments: insert próprio client"
  ON public.payments FOR INSERT
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "payments: update próprio client"
  ON public.payments FOR UPDATE
  USING  (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "payments: delete próprio client"
  ON public.payments FOR DELETE
  USING (client_id = auth.uid());


-- ────────────────────────────────────────────
-- maintenance
-- ────────────────────────────────────────────
DROP POLICY IF EXISTS "maintenance: acesso pelo client dono" ON public.maintenance;

CREATE POLICY "maintenance: select próprio client"
  ON public.maintenance FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "maintenance: insert próprio client"
  ON public.maintenance FOR INSERT
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "maintenance: update próprio client"
  ON public.maintenance FOR UPDATE
  USING  (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "maintenance: delete próprio client"
  ON public.maintenance FOR DELETE
  USING (client_id = auth.uid());


-- ────────────────────────────────────────────
-- checkins (adicionado em fleet_expansion)
-- ────────────────────────────────────────────
DROP POLICY IF EXISTS "checkins: acesso pelo client dono" ON public.checkins;

CREATE POLICY "checkins: select próprio client"
  ON public.checkins FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "checkins: insert próprio client"
  ON public.checkins FOR INSERT
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "checkins: update próprio client"
  ON public.checkins FOR UPDATE
  USING  (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "checkins: delete próprio client"
  ON public.checkins FOR DELETE
  USING (client_id = auth.uid());


-- ────────────────────────────────────────────
-- insurance
-- ────────────────────────────────────────────
DROP POLICY IF EXISTS "insurance: acesso pelo client dono" ON public.insurance;

CREATE POLICY "insurance: select próprio client"
  ON public.insurance FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "insurance: insert próprio client"
  ON public.insurance FOR INSERT
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "insurance: update próprio client"
  ON public.insurance FOR UPDATE
  USING  (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "insurance: delete próprio client"
  ON public.insurance FOR DELETE
  USING (client_id = auth.uid());


-- ────────────────────────────────────────────
-- fines
-- ────────────────────────────────────────────
DROP POLICY IF EXISTS "fines: acesso pelo client dono" ON public.fines;

CREATE POLICY "fines: select próprio client"
  ON public.fines FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "fines: insert próprio client"
  ON public.fines FOR INSERT
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "fines: update próprio client"
  ON public.fines FOR UPDATE
  USING  (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "fines: delete próprio client"
  ON public.fines FOR DELETE
  USING (client_id = auth.uid());
