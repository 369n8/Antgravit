-- Tabela de log de alertas enviados (evita duplicatas no mesmo dia)
CREATE TABLE IF NOT EXISTS alert_sent_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL,
  reference_date DATE,
  sent_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_log_date_type
  ON alert_sent_log(client_id, alert_type, sent_at);

-- Adicionar campos se não existirem
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS cnh_validade DATE;
