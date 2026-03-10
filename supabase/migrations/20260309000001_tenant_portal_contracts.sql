-- Ticket: CRM Lead to Tenant & Portal Integration
-- Adds portal_access_status to tenants and creates contracts table

-- 1. Add portal_access_status to tenants
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS contract_signature_url TEXT,
    ADD COLUMN IF NOT EXISTS contract_signed_at     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS portal_access_status   TEXT DEFAULT 'pending_contract'
        CHECK (portal_access_status IN ('pending_contract', 'active', 'suspended'));

-- 2. Backfill: tenants que já assinaram → active
UPDATE tenants
SET portal_access_status = 'active'
WHERE contract_signature_url IS NOT NULL
  AND (portal_access_status IS NULL OR portal_access_status = 'pending_contract');

-- 3. Create contracts table
CREATE TABLE IF NOT EXISTS contracts (
    id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    status       TEXT        DEFAULT 'pending_signature'
                     CHECK (status IN ('pending_signature', 'active', 'expired', 'terminated')),
    document_url TEXT,
    signed_at    TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RLS on contracts
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- Anon can read contracts (app-level filter by tenant_id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'contracts' AND policyname = 'anon_read_contracts'
    ) THEN
        CREATE POLICY anon_read_contracts ON contracts
            FOR SELECT TO anon USING (true);
    END IF;
END $$;

-- Authenticated clients can manage their tenants' contracts
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'contracts' AND policyname = 'auth_manage_contracts'
    ) THEN
        CREATE POLICY auth_manage_contracts ON contracts
            FOR ALL TO authenticated
            USING (
                tenant_id IN (
                    SELECT id FROM tenants WHERE client_id = auth.uid()
                )
            );
    END IF;
END $$;
