-- ============================================================
-- FrotaApp — RLS: Políticas de Acesso para Locatários
-- 20260307000000_rls_tenant_access
--
-- Modelo:
--   Admin (fleet owner) → acesso total via client_id = auth.uid()
--                         (já coberto pelas policies existentes)
--   Locatário autenticado → SELECT apenas nos próprios dados
--     Identificação: auth.email() = tenants.email
--
-- NOTA: Para que locatários tenham acesso, precisam de uma conta
-- Supabase Auth com o mesmo e-mail cadastrado em tenants.email.
-- ============================================================

-- ── payments: locatário vê apenas os próprios registros ──────
CREATE POLICY "payments: locatario le proprios"
  ON public.payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   public.tenants t
      WHERE  t.id    = payments.tenant_id
      AND    t.email = auth.email()
    )
  );

-- ── checkins: locatário vê apenas os checkins do veículo dele ─
CREATE POLICY "checkins: locatario le proprios"
  ON public.checkins
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   public.tenants t
      WHERE  t.id    = checkins.tenant_id
      AND    t.email = auth.email()
    )
  );

-- ── vehicles: locatário vê apenas o veículo vinculado a ele ──
CREATE POLICY "vehicles: locatario le proprio"
  ON public.vehicles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   public.tenants t
      WHERE  t.vehicle_id = vehicles.id
      AND    t.email      = auth.email()
    )
  );
