-- Salva o @username do bot do cliente (obtido via getMe após ativar o bot)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS telegram_bot_username TEXT;

COMMENT ON COLUMN public.clients.telegram_bot_username IS
  'Username do bot Telegram pessoal (ex: MeuBotFrota_bot). Usado para gerar links de vinculação.';
