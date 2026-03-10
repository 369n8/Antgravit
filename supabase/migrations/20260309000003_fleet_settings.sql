-- Ticket: Motor de Captura Autônoma de Multas
-- Cofre de credenciais e configurações da frota

CREATE TABLE IF NOT EXISTS fleet_settings (
    id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id    UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    document     TEXT,                           -- CNPJ ou CPF da frota
    api_provider TEXT        DEFAULT 'mock'
                     CHECK (api_provider IN ('mock', 'infosimples', 'zapay', 'apibrasil')),
    api_key      TEXT,                           -- chave do provedor externo (futura)
    scan_enabled BOOLEAN     DEFAULT true,
    last_scan_at TIMESTAMPTZ,
    notes        TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (client_id)                           -- 1 config por cliente
);

ALTER TABLE fleet_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_fleet_settings" ON fleet_settings
    FOR ALL TO authenticated
    USING  (client_id = auth.uid())
    WITH CHECK (client_id = auth.uid());

-- Trigger updated_at automático
CREATE OR REPLACE FUNCTION update_fleet_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fleet_settings_updated ON fleet_settings;
CREATE TRIGGER trg_fleet_settings_updated
    BEFORE UPDATE ON fleet_settings
    FOR EACH ROW EXECUTE FUNCTION update_fleet_settings_timestamp();
