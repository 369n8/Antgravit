-- Adicionar campos de vídeo semanal e aprovação na weekly_inspections
ALTER TABLE weekly_inspections
ADD COLUMN IF NOT EXISTS oil_level TEXT CHECK (oil_level IN ('ok', 'baixo', 'trocar')),
ADD COLUMN IF NOT EXISTS video_path TEXT,
ADD COLUMN IF NOT EXISTS video_approved BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS week_start DATE;

-- Bucket weekly-videos (criar via SQL storage API)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'weekly-videos',
  'weekly-videos',
  false,
  209715200,
  ARRAY['video/mp4','video/quicktime','video/x-msvideo','video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas do bucket
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'weekly-videos: authenticated upload'
  ) THEN
    CREATE POLICY "weekly-videos: authenticated upload"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'weekly-videos');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'weekly-videos: authenticated select'
  ) THEN
    CREATE POLICY "weekly-videos: authenticated select"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'weekly-videos');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'weekly-videos: anon upload'
  ) THEN
    CREATE POLICY "weekly-videos: anon upload"
      ON storage.objects FOR INSERT TO anon
      WITH CHECK (bucket_id = 'weekly-videos');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'weekly-videos: anon select'
  ) THEN
    CREATE POLICY "weekly-videos: anon select"
      ON storage.objects FOR SELECT TO anon
      USING (bucket_id = 'weekly-videos');
  END IF;
END $$;
