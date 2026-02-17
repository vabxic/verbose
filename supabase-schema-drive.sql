-- ══════════════════════════════════════════════════
-- Verbose – Room Drive / File Storage Schema
-- Run this in the Supabase SQL Editor AFTER supabase-schema-chat.sql
-- ══════════════════════════════════════════════════

-- ── Room Files metadata ──────────────────────────
CREATE TABLE IF NOT EXISTS public.room_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uploader_name TEXT,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,              -- bytes
  mime_type TEXT,
  storage_path TEXT NOT NULL,             -- path inside the Supabase Storage bucket
  status TEXT DEFAULT 'uploading',        -- uploading | ready | failed
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.room_files ENABLE ROW LEVEL SECURITY;

-- Room members can see files belonging to any room they can see
CREATE POLICY "Authenticated users can read room files"
  ON public.room_files FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Uploader can insert
CREATE POLICY "Authenticated users can upload files"
  ON public.room_files FOR INSERT
  WITH CHECK (auth.uid() = uploader_id);

-- Uploader can update their own files (e.g. mark ready)
CREATE POLICY "Uploader can update own files"
  ON public.room_files FOR UPDATE
  USING (auth.uid() = uploader_id);

-- Uploader can delete own files
CREATE POLICY "Uploader can delete own files"
  ON public.room_files FOR DELETE
  USING (auth.uid() = uploader_id);

CREATE INDEX IF NOT EXISTS room_files_room_idx ON public.room_files(room_id, created_at);

-- ── Enable Realtime on room_files ────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_files;

-- ══════════════════════════════════════════════════
-- Storage bucket setup  (run once in SQL editor)
-- ══════════════════════════════════════════════════
-- Create a public bucket called "room-files".
-- In the Supabase dashboard → Storage, create the bucket manually
-- OR run the following (requires service_role or dashboard):
--
--   INSERT INTO storage.buckets (id, name, public)
--   VALUES ('room-files', 'room-files', false);
--
-- Then add RLS policies on the bucket:
--
--   CREATE POLICY "Authenticated users can upload"
--     ON storage.objects FOR INSERT
--     WITH CHECK (bucket_id = 'room-files' AND auth.uid() IS NOT NULL);
--
--   CREATE POLICY "Authenticated users can read"
--     ON storage.objects FOR SELECT
--     USING (bucket_id = 'room-files' AND auth.uid() IS NOT NULL);
--
--   CREATE POLICY "Uploader can delete"
--     ON storage.objects FOR DELETE
--     USING (bucket_id = 'room-files' AND auth.uid()::text = (storage.foldername(name))[2]);
