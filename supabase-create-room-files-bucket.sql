-- Create `room-files` bucket and RLS policies for Supabase Storage
-- IMPORTANT: The INSERT into storage.buckets requires elevated privileges
-- (run in the Supabase Dashboard SQL editor or with a service_role key).

-- 1) Create bucket (run only in Dashboard SQL editor with service role privileges)
INSERT INTO storage.buckets (id, name, public)
VALUES ('room-files', 'room-files', false);

-- 2) Row-level security policies for objects in the `room-files` bucket
CREATE POLICY "Authenticated users can upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'room-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'room-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Uploader can delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'room-files' AND auth.uid()::text = (storage.foldername(name))[2]);

-- Notes:
-- * If you prefer, create the bucket in Dashboard → Storage (New bucket),
--   then run only the three CREATE POLICY statements above in the SQL editor.
-- * Do NOT run the INSERT from client-side code or using the anon key.
