-- ============================================================
-- FrotaApp v1 — Extensão de schema para suportar UI completa
-- Migração: 20260305000001_frotaapp_extend_schema
-- ============================================================

-- ── Vehicles: fotos e histórico de checklist (JSONB) ────────
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS photos           JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS checklist_history JSONB NOT NULL DEFAULT '[]';

-- ── Tenants: campos extras do formulário de cadastro ─────────
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS phone2              TEXT,
  ADD COLUMN IF NOT EXISTS app_rating         TEXT,
  ADD COLUMN IF NOT EXISTS bairro             TEXT,
  ADD COLUMN IF NOT EXISTS cidade             TEXT,
  ADD COLUMN IF NOT EXISTS estado             TEXT DEFAULT 'SP',
  ADD COLUMN IF NOT EXISTS cep                TEXT,
  ADD COLUMN IF NOT EXISTS payment_day        TEXT DEFAULT 'segunda-feira',
  ADD COLUMN IF NOT EXISTS payment_method     TEXT DEFAULT 'Pix',
  ADD COLUMN IF NOT EXISTS pix_key            TEXT,
  ADD COLUMN IF NOT EXISTS since              DATE,
  ADD COLUMN IF NOT EXISTS doc_photos         JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes              TEXT,
  ADD COLUMN IF NOT EXISTS emergency_name     TEXT,
  ADD COLUMN IF NOT EXISTS emergency_phone    TEXT,
  ADD COLUMN IF NOT EXISTS emergency_relation TEXT;
