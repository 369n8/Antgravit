-- Add telegram_username to tenants table
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS telegram_username TEXT;
