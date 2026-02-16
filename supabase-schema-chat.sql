-- ══════════════════════════════════════════════════
-- Verbose – Chat / Rooms / WebRTC Signaling Schema
-- Run this in the Supabase SQL Editor AFTER supabase-schema.sql
-- ══════════════════════════════════════════════════

-- ── Rooms ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,            -- short shareable room code
  name TEXT,                            -- optional display name
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  max_participants INT DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read active rooms they know the code for
CREATE POLICY "Authenticated users can read rooms"
  ON public.rooms FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Creator can update/delete
CREATE POLICY "Creator can update own rooms"
  ON public.rooms FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Creator can delete own rooms"
  ON public.rooms FOR DELETE
  USING (auth.uid() = created_by);

-- Any authenticated user can create rooms
CREATE POLICY "Authenticated users can create rooms"
  ON public.rooms FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE INDEX IF NOT EXISTS rooms_code_idx ON public.rooms(code);
CREATE INDEX IF NOT EXISTS rooms_created_by_idx ON public.rooms(created_by);

-- ── Room Participants ────────────────────────────
CREATE TABLE IF NOT EXISTS public.room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(room_id, user_id)
);

ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view room members"
  ON public.room_participants FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can join rooms"
  ON public.room_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave rooms"
  ON public.room_participants FOR DELETE
  USING (auth.uid() = user_id);

-- ── Room Messages (persisted chat) ──────────────
CREATE TABLE IF NOT EXISTS public.room_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text',              -- text | system | file
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room members can read messages"
  ON public.room_messages FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can send messages"
  ON public.room_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE INDEX IF NOT EXISTS room_messages_room_idx ON public.room_messages(room_id, created_at);

-- ── WebRTC Signaling ────────────────────────────
-- Ephemeral rows used for SDP exchange & ICE candidates.
-- Clean up old signals periodically.
CREATE TABLE IF NOT EXISTS public.room_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL = broadcast
  type TEXT NOT NULL,                    -- offer | answer | ice-candidate | hang-up
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.room_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room members can read signals"
  ON public.room_signals FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can send signals"
  ON public.room_signals FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Allow cleanup
CREATE POLICY "Users can delete own signals"
  ON public.room_signals FOR DELETE
  USING (auth.uid() = sender_id);

CREATE INDEX IF NOT EXISTS room_signals_room_idx ON public.room_signals(room_id, created_at);

-- ── Enable Realtime on signaling & messages ─────
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_signals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_participants;

-- ── Helper: generate a short alphanumeric room code ──
CREATE OR REPLACE FUNCTION public.generate_room_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- no 0/O/1/I ambiguity
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;
