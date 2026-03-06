-- Add telegram_chat_id to tenants (numeric ID from Telegram, set via /start)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;
