-- Adiciona colunas faltantes na tabela vehicles
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS current_km INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fuel_level INTEGER DEFAULT 0 CHECK (fuel_level >= 0 AND fuel_level <= 100),
  ADD COLUMN IF NOT EXISTS tire_condition TEXT DEFAULT 'bom' CHECK (tire_condition IN ('novo', 'bom', 'meia vida', 'troca necessaria')),
  ADD COLUMN IF NOT EXISTS docs_ipva DATE,
  ADD COLUMN IF NOT EXISTS docs_seguro DATE,
  ADD COLUMN IF NOT EXISTS docs_revisao DATE;

-- Atualiza registros existentes com valores padrao
UPDATE public.vehicles SET current_km = COALESCE(km, 0) WHERE current_km IS NULL;
