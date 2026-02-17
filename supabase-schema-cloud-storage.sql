-- ══════════════════════════════════════════════════
-- Verbose – User-Owned Cloud Storage Schema
-- Run this in the Supabase SQL Editor AFTER supabase-schema-chat.sql
-- ══════════════════════════════════════════════════

-- ── User Cloud Settings ──────────────────────────
-- Each user can connect one or more cloud storage providers.
-- Tokens are stored here (encrypt at rest via Supabase vault for production).
CREATE TABLE IF NOT EXISTS public.user_cloud_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,                   -- 'google_drive' | 'dropbox' | 'onedrive'
  access_token TEXT NOT NULL,
  refresh_token TEXT,                       -- NULL for implicit-grant flows
  token_expires_at TIMESTAMPTZ,
  provider_email TEXT,                      -- user's email on that provider
  folder_id TEXT,                           -- root folder ID in the provider for Verbose files
  folder_name TEXT DEFAULT 'Verbose',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE public.user_cloud_settings ENABLE ROW LEVEL SECURITY;

-- Users can only see their own cloud settings
CREATE POLICY "Users can read own cloud settings"
  ON public.user_cloud_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cloud settings"
  ON public.user_cloud_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cloud settings"
  ON public.user_cloud_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cloud settings"
  ON public.user_cloud_settings FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_cloud_settings_user_idx
  ON public.user_cloud_settings(user_id, provider);

-- ── Extend room_files with cloud columns ─────────
-- These columns are NULL when using Supabase Storage (legacy),
-- and populated when stored in user-owned cloud.

-- Make storage_path nullable for cloud-hosted files (safe migration)
ALTER TABLE public.room_files
  ALTER COLUMN storage_path DROP NOT NULL;

-- Add cloud metadata columns
ALTER TABLE public.room_files
  ADD COLUMN IF NOT EXISTS cloud_provider TEXT,        -- 'google_drive' | 'dropbox' | NULL (supabase)
  ADD COLUMN IF NOT EXISTS cloud_file_id TEXT,         -- provider-specific file ID
  ADD COLUMN IF NOT EXISTS cloud_share_url TEXT;       -- public/shared download URL

-- Index for faster cloud file lookups
CREATE INDEX IF NOT EXISTS room_files_cloud_idx
  ON public.room_files(cloud_provider, cloud_file_id) WHERE cloud_provider IS NOT NULL;
