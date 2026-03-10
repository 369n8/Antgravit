-- Adicional: Segurança para o bucket de Storage
CREATE POLICY "Public Read Access" ON storage.objects FOR SELECT USING (bucket_id = 'contracts');
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'contracts');
