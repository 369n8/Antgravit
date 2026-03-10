-- Ticket: Monopoly Engine — Tabela de Faturas
-- Rastreia faturas semanais geradas via Stripe para cada inquilino

CREATE TABLE IF NOT EXISTS invoices (
    id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id         UUID        NOT NULL REFERENCES clients(id)  ON DELETE CASCADE,
    tenant_id         UUID        NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
    stripe_session_id TEXT,
    stripe_invoice_id TEXT,
    amount            NUMERIC(10,2) NOT NULL,
    status            TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    payment_url       TEXT,
    week_label        TEXT,
    due_date          DATE,
    paid_at           TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_created ON invoices (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_client_status  ON invoices (client_id, status);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Admin (authenticated) lê/gerencia suas próprias faturas
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoices' AND policyname='owner_invoices') THEN
        CREATE POLICY owner_invoices ON invoices
            FOR ALL TO authenticated
            USING  (client_id = auth.uid())
            WITH CHECK (client_id = auth.uid());
    END IF;
END $$;

-- Portal (anon) lê as próprias faturas pelo tenant_id (token do portal)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoices' AND policyname='anon_read_invoices') THEN
        CREATE POLICY anon_read_invoices ON invoices
            FOR SELECT TO anon USING (true);
    END IF;
END $$;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_invoices_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoices_updated ON invoices;
CREATE TRIGGER trg_invoices_updated
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_invoices_timestamp();
