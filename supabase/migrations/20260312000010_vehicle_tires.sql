-- Tabela de pneus por veículo
CREATE TABLE IF NOT EXISTS vehicle_tires (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES tenants(id) NOT NULL,
  position TEXT NOT NULL CHECK (position IN ('dianteiro_esq', 'dianteiro_dir', 'traseiro_esq', 'traseiro_dir', 'step')),
  dot_serial TEXT,
  brand TEXT,
  model TEXT,
  fabrication_week INTEGER,
  fabrication_year INTEGER,
  condition TEXT CHECK (condition IN ('nova', 'boa', 'regular', 'ruim')) DEFAULT 'boa',
  photo_url TEXT,
  registered_at TIMESTAMPTZ DEFAULT now(),
  registered_by uuid REFERENCES auth.users(id),
  UNIQUE(vehicle_id, position)
);

ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS battery_serial TEXT,
ADD COLUMN IF NOT EXISTS battery_brand TEXT,
ADD COLUMN IF NOT EXISTS battery_ah INTEGER,
ADD COLUMN IF NOT EXISTS battery_installed_at DATE,
ADD COLUMN IF NOT EXISTS battery_warranty_until DATE,
ADD COLUMN IF NOT EXISTS battery_photo_url TEXT;

ALTER TABLE vehicle_tires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_owner_tires" ON vehicle_tires
  FOR ALL USING (
    tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
    OR tenant_id = auth.uid()
  );
