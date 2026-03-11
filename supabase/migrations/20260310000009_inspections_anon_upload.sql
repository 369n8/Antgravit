-- Migration: inspections_anon_upload
-- Permite que locatários (anon) façam upload de vídeos de vistoria no Portal
-- O Portal usa chave anon pois locatários não têm conta Supabase

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'inspections: anon upload'
  ) THEN
    CREATE POLICY "inspections: anon upload"
      ON storage.objects FOR INSERT
      TO anon
      WITH CHECK (bucket_id = 'inspections');
  END IF;
END $$;
