-- Add telegram_username to clients profile table
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS telegram_username TEXT;
