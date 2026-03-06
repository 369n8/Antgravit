-- ============================================================
-- FrotaApp — Create vehicle-photos Storage Bucket
-- 20260306000005_vehicle_photos_bucket
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-photos', 'vehicle-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "vehicle-photos upload auth"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vehicle-photos');

CREATE POLICY "vehicle-photos read public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vehicle-photos');

CREATE POLICY "vehicle-photos delete auth"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vehicle-photos');
