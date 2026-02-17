-- ══════════════════════════════════════════════════
-- Verbose – Direct Messages & Presence Schema
-- Run this in the Supabase SQL Editor AFTER supabase-schema-social.sql
-- ══════════════════════════════════════════════════

-- ── Direct Messages (Friend-to-Friend persistent chat) ──
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text',  -- text | file | system
  file_metadata JSONB,       -- { fileName, fileSize, mimeType, url } for file messages
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Users can read DMs they sent or received
CREATE POLICY "Users can read own DMs"
  ON public.direct_messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can send DMs
CREATE POLICY "Users can send DMs"
  ON public.direct_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Users can delete their own DMs (for clear chat)
CREATE POLICY "Users can delete own DMs"
  ON public.direct_messages FOR DELETE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can update DMs they received (mark as read)
CREATE POLICY "Users can update received DMs"
  ON public.direct_messages FOR UPDATE
  USING (auth.uid() = receiver_id);

CREATE INDEX IF NOT EXISTS dm_sender_idx ON public.direct_messages(sender_id, created_at);
CREATE INDEX IF NOT EXISTS dm_receiver_idx ON public.direct_messages(receiver_id, created_at);
CREATE INDEX IF NOT EXISTS dm_conversation_idx ON public.direct_messages(sender_id, receiver_id, created_at);

-- ── User Presence ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_online BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can see presence
CREATE POLICY "Anyone can read presence"
  ON public.user_presence FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Users can update their own presence
CREATE POLICY "Users can upsert own presence"
  ON public.user_presence FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own presence"
  ON public.user_presence FOR UPDATE
  USING (auth.uid() = user_id);

-- ── Enable Realtime ──────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
