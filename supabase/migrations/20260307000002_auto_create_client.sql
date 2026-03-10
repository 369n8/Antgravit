-- ============================================================
-- FrotaApp — Auto-create client on signup
-- Migration: 20260307000002_auto_create_client
--
-- Quando um novo usuario se registra via Supabase Auth,
-- este trigger cria automaticamente a linha correspondente
-- na tabela public.clients com os dados iniciais.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.clients (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dropar trigger se já existir (idempotência)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Criar trigger que dispara APÓS inserção de novo usuário
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Backfill: criar registros para usuarios que ja existem
-- mas nao tem um clients correspondente
-- ============================================================
INSERT INTO public.clients (id, name, email)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'name', split_part(u.email::text, '@', 1)),
  u.email
FROM auth.users u
LEFT JOIN public.clients c ON c.id = u.id
WHERE c.id IS NULL
ON CONFLICT (id) DO NOTHING;
