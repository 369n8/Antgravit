-- Migration: pix_payments
-- Adiciona campos PIX (Efí Bank) na tabela payments
-- e garante que tenants tem telegram_chat_id para receber cobranças

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS pix_charge_id   TEXT,
  ADD COLUMN IF NOT EXISTS pix_qr_code     TEXT,
  ADD COLUMN IF NOT EXISTS pix_copy_paste  TEXT,
  ADD COLUMN IF NOT EXISTS pix_expires_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pix_paid_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pix_txid        TEXT;

-- Tenants já têm telegram_chat_id (migration anterior), garantir que existe
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- Índice para busca rápida por pix_charge_id (webhook de confirmação)
CREATE INDEX IF NOT EXISTS idx_payments_pix_charge ON public.payments(pix_charge_id)
  WHERE pix_charge_id IS NOT NULL;

COMMENT ON COLUMN public.payments.pix_charge_id  IS 'ID da cobrança no Efí Bank';
COMMENT ON COLUMN public.payments.pix_qr_code    IS 'URL da imagem do QR Code PIX';
COMMENT ON COLUMN public.payments.pix_copy_paste IS 'Código PIX copia-e-cola (EMV)';
COMMENT ON COLUMN public.payments.pix_expires_at IS 'Expiração da cobrança PIX (padrão 24h)';
COMMENT ON COLUMN public.payments.pix_paid_at    IS 'Timestamp da confirmação automática do Efí Bank';
COMMENT ON COLUMN public.payments.pix_txid       IS 'txid único gerado para rastreamento da transação';
