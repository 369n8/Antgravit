-- Migração: fine_monetization
-- Adiciona suporte para lucro sobre multas e chargeback automático

ALTER TABLE public.fines 
ADD COLUMN IF NOT EXISTS admin_fee NUMERIC(10,2) DEFAULT 25.00,
ADD COLUMN IF NOT EXISTS spread_profit NUMERIC(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS chargeback_payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS fleet_paid_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS fleet_paid_amount NUMERIC(10,2);

COMMENT ON COLUMN public.fines.admin_fee IS 'Taxa administrativa cobrada do motorista pela gestão da multa';
COMMENT ON COLUMN public.fines.spread_profit IS 'Lucro obtido pelo dono da frota através do desconto no pagamento antecipado';
