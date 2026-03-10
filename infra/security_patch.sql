-- Reforço de RLS para a tabela LEADS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leads_owner_v2" ON leads;
CREATE POLICY "leads_owner_v2" ON leads
    FOR ALL
    USING (client_id = auth.uid())
    WITH CHECK (client_id = auth.uid());

-- Segurança do Storage Bucket 'contracts'
-- 1. Garante que o bucket existe (Supabase UI ou via API anterior já deve ter criado, mas garantimos aqui)
-- 2. Políticas do Storage
INSERT INTO storage.buckets (id, name, public) 
VALUES ('contracts', 'contracts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "contracts_public_view" ON storage.objects;
CREATE POLICY "contracts_public_view" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'contracts');

DROP POLICY IF EXISTS "contracts_upload_owner" ON storage.objects;
CREATE POLICY "contracts_upload_owner" ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'contracts'); -- Simplificado para permitir upload do portal (anon/token)

-- Nota: No futuro, podemos amarrar o storage ao metadata do tenant para maior segurança.
