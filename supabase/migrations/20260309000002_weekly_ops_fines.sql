-- Ticket: Gestão Semanal & Automação de Multas
-- Adds billing_day to tenants, creates weekly_inspections, extends fines

-- 1. billing_day on tenants
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS billing_day TEXT DEFAULT 'monday'
        CHECK (billing_day IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday'));

-- 2. weekly_inspections table
CREATE TABLE IF NOT EXISTS weekly_inspections (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vehicle_id  UUID        REFERENCES vehicles(id) ON DELETE SET NULL,
    video_url   TEXT,
    current_km  INT,
    status      TEXT        DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE weekly_inspections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_inspections' AND policyname = 'anon_insert_inspections') THEN
        CREATE POLICY anon_insert_inspections ON weekly_inspections
            FOR INSERT TO anon WITH CHECK (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_inspections' AND policyname = 'anon_select_own_inspections') THEN
        CREATE POLICY anon_select_own_inspections ON weekly_inspections
            FOR SELECT TO anon USING (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_inspections' AND policyname = 'auth_manage_inspections') THEN
        CREATE POLICY auth_manage_inspections ON weekly_inspections
            FOR ALL TO authenticated
            USING (tenant_id IN (SELECT id FROM tenants WHERE client_id = auth.uid()));
    END IF;
END $$;

-- 3. Extend fines: add infraction_date (existing table uses 'date' col, this is explicit timestamp)
ALTER TABLE fines
    ADD COLUMN IF NOT EXISTS infraction_date TIMESTAMPTZ;

-- Backfill from existing 'date' column
UPDATE fines SET infraction_date = date::TIMESTAMPTZ WHERE infraction_date IS NULL AND date IS NOT NULL;
