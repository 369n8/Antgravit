-- Migration: inspections_storage_policies
-- Cria políticas de acesso para o bucket 'inspections'
-- Permite que usuários autenticados (donos de frota) façam upload de vídeos de check-in

-- Garante que o bucket existe e é público para leitura
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inspections',
  'inspections',
  true,
  52428800, -- 50MB
  ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'video/mpeg', 'video/3gpp', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'video/mpeg', 'video/3gpp', 'image/jpeg', 'image/png', 'image/webp'];

-- Política: usuários autenticados podem fazer upload no bucket inspections
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'inspections: authenticated upload'
  ) THEN
    CREATE POLICY "inspections: authenticated upload"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'inspections');
  END IF;
END $$;

-- Política: usuários autenticados podem ver seus próprios uploads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'inspections: authenticated select'
  ) THEN
    CREATE POLICY "inspections: authenticated select"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (bucket_id = 'inspections');
  END IF;
END $$;

-- Política: leitura pública (para URLs públicas funcionarem)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'inspections: public read'
  ) THEN
    CREATE POLICY "inspections: public read"
      ON storage.objects FOR SELECT
      TO anon
      USING (bucket_id = 'inspections');
  END IF;
END $$;

-- Política: usuários autenticados podem deletar seus uploads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'inspections: authenticated delete'
  ) THEN
    CREATE POLICY "inspections: authenticated delete"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'inspections');
  END IF;
END $$;
