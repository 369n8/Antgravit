-- ============================================================
-- FrotaApp — Add due_date to fines
-- 20260306000004_fines_due_date
-- ============================================================

ALTER TABLE public.fines ADD COLUMN IF NOT EXISTS due_date DATE;
