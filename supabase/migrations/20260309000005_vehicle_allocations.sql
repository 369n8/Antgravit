-- Ticket: Motor de Atribuição Retroativa de Multas
-- Tabela de histórico imutável de locações + trigger automático + extensão do status de fines

-- ── 1. Tabela vehicle_allocations ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicle_allocations (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id  UUID        NOT NULL REFERENCES vehicles(id)  ON DELETE CASCADE,
    tenant_id   UUID        NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
    client_id   UUID        NOT NULL REFERENCES clients(id)   ON DELETE CASCADE,
    start_date  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_date    TIMESTAMPTZ,          -- NULL = locação ainda ativa
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca retroativa rápida por data
CREATE INDEX IF NOT EXISTS idx_va_vehicle_dates
    ON vehicle_allocations (vehicle_id, start_date, end_date);

-- RLS: dono da frota acessa apenas seus registros
ALTER TABLE vehicle_allocations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'vehicle_allocations' AND policyname = 'owner_vehicle_allocations'
    ) THEN
        CREATE POLICY owner_vehicle_allocations ON vehicle_allocations
            FOR ALL TO authenticated
            USING  (client_id = auth.uid())
            WITH CHECK (client_id = auth.uid());
    END IF;
END $$;

-- ── 2. Trigger: rastrear alocações ao mudar tenants.vehicle_id ───────────────
CREATE OR REPLACE FUNCTION trg_track_vehicle_allocation()
RETURNS TRIGGER AS $$
BEGIN
    -- Veículo sendo atribuído (novo ou troca)
    IF NEW.vehicle_id IS NOT NULL AND
       (OLD.vehicle_id IS NULL OR OLD.vehicle_id != NEW.vehicle_id) THEN

        -- Fechar alocação anterior se houve troca de veículo
        IF OLD.vehicle_id IS NOT NULL THEN
            UPDATE vehicle_allocations
            SET end_date = NOW()
            WHERE vehicle_id = OLD.vehicle_id
              AND tenant_id  = NEW.id
              AND end_date IS NULL;
        END IF;

        -- Abrir nova alocação
        INSERT INTO vehicle_allocations (vehicle_id, tenant_id, client_id, start_date)
        VALUES (NEW.vehicle_id, NEW.id, NEW.client_id, NOW());
    END IF;

    -- Veículo devolvido (vehicle_id limpo)
    IF NEW.vehicle_id IS NULL AND OLD.vehicle_id IS NOT NULL THEN
        UPDATE vehicle_allocations
        SET end_date = NOW()
        WHERE vehicle_id = OLD.vehicle_id
          AND tenant_id  = NEW.id
          AND end_date IS NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenants_track_allocation ON tenants;
CREATE TRIGGER trg_tenants_track_allocation
    AFTER UPDATE OF vehicle_id ON tenants
    FOR EACH ROW EXECUTE FUNCTION trg_track_vehicle_allocation();

-- ── 3. Estender status de fines: adicionar 'indicacao_feita' ─────────────────
-- Dropar constraint existente e recriar com o novo valor
ALTER TABLE fines DROP CONSTRAINT IF EXISTS fines_status_check;
ALTER TABLE fines ADD CONSTRAINT fines_status_check
    CHECK (status IN ('pendente', 'indicacao_feita', 'pago', 'contestado'));

-- ── 4. Backfill: popular vehicle_allocations com locações ativas atuais ──────
INSERT INTO vehicle_allocations (vehicle_id, tenant_id, client_id, start_date)
SELECT
    t.vehicle_id,
    t.id,
    t.client_id,
    COALESCE(t.since::TIMESTAMPTZ, t.created_at, NOW()) AS start_date
FROM tenants t
WHERE t.vehicle_id IS NOT NULL
  AND t.status = 'ativo'
ON CONFLICT DO NOTHING;
