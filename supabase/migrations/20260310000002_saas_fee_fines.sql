-- Migração: saas_fee em fines
-- Adiciona taxa da plataforma (SaaS) por multa processada

ALTER TABLE public.fines
ADD COLUMN IF NOT EXISTS saas_fee NUMERIC(10,2) DEFAULT 2.50;

COMMENT ON COLUMN public.fines.saas_fee IS 'Taxa da plataforma myfrot.ai por multa processada (R$ 2,50). Receita do SaaS, separada do lucro da locadora.';
