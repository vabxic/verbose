-- ══════════════════════════════════════════════════
-- Verbose – DM Signals (WebRTC for Direct Messages)
-- Run this in the Supabase SQL Editor AFTER supabase-schema-friends-chat.sql
-- ══════════════════════════════════════════════════

-- Ephemeral rows used for SDP exchange & ICE candidates in DMs.
-- Clean up old signals periodically.
CREATE TABLE IF NOT EXISTS public.dm_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL,              -- deterministic channel ID: sorted user IDs joined
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                    -- offer | answer | ice-candidate | hang-up
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.dm_signals ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read DM signals
CREATE POLICY "Users can read DM signals"
  ON public.dm_signals FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Authenticated users can send DM signals
CREATE POLICY "Users can send DM signals"
  ON public.dm_signals FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Users can delete their own DM signals (cleanup)
CREATE POLICY "Users can delete own DM signals"
  ON public.dm_signals FOR DELETE
  USING (auth.uid() = sender_id);

CREATE INDEX IF NOT EXISTS dm_signals_channel_idx ON public.dm_signals(channel_id, created_at);

-- ── Enable Realtime ──────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_signals;
