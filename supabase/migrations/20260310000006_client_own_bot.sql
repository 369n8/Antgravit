-- Migration: client_own_bot
-- Cada cliente (dono da frota) configura seu próprio bot do Telegram.
-- O bot_token é armazenado no banco e usado pelas Edge Functions em vez do
-- TELEGRAM_BOT_TOKEN global, que deixa de existir como dependência central.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT;

COMMENT ON COLUMN public.clients.telegram_bot_token IS
  'Token do bot Telegram pessoal do dono da frota (criado via @BotFather). '
  'Substitui o TELEGRAM_BOT_TOKEN global — cada cliente tem seu próprio bot.';

-- Índice para lookup rápido pelo chat_id (já existe na maioria dos projetos)
-- Garante que existe telegram_chat_id também
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
