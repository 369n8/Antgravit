-- ============================================================
-- FrotaApp v1.0 — Schema Fixes & Completions
-- 20260306000006_schema_fixes_v1
-- ============================================================

-- ── 1. checkins: ampliar constraint de tipo para incluir 'exit' ──
--    O check-out de veículos usa checkin_type='exit'; a constraint
--    original só permitia 'entrega' | 'devolucao'.
ALTER TABLE public.checkins
  DROP CONSTRAINT IF EXISTS checkins_checkin_type_check;

ALTER TABLE public.checkins
  ADD CONSTRAINT checkins_checkin_type_check
  CHECK (checkin_type IN ('entrega', 'devolucao', 'exit'));

-- ── 2. payments: coluna receipt_url para comprovantes ───────────
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- ── 3. vehicles: coluna current_tenant_id para contratos ────────
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS current_tenant_id UUID
    REFERENCES public.tenants(id) ON DELETE SET NULL;

-- ── 4. fines: tornar vehicle_id opcional (OCR cria sem veículo) ─
--    A constraint NOT NULL impedia registrar multa antes de
--    identificar a placa via OCR.
ALTER TABLE public.fines
  ALTER COLUMN vehicle_id DROP NOT NULL;

-- ── 5. Storage Bucket: payment-receipts ─────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'payment-receipts upload auth'
    AND tablename = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "payment-receipts upload auth"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = ''payment-receipts'')';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'payment-receipts read public'
    AND tablename = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "payment-receipts read public"
      ON storage.objects FOR SELECT
      USING (bucket_id = ''payment-receipts'')';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'payment-receipts delete auth'
    AND tablename = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "payment-receipts delete auth"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = ''payment-receipts'')';
  END IF;
END $$;
