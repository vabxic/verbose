-- ══════════════════════════════════════════════════
-- Verbose – Saved Rooms & Friend Requests Schema
-- Run this in the Supabase SQL Editor AFTER supabase-schema-chat.sql
-- ══════════════════════════════════════════════════

-- ── Saved Rooms ──────────────────────────────────
-- Users can "save" a room so it persists on their homepage
CREATE TABLE IF NOT EXISTS public.saved_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, room_id)
);

ALTER TABLE public.saved_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved rooms"
  ON public.saved_rooms FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can save rooms"
  ON public.saved_rooms FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave rooms"
  ON public.saved_rooms FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS saved_rooms_user_idx ON public.saved_rooms(user_id);

-- ── Friend Requests ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT,
  receiver_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | accepted | rejected
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sender_id, receiver_id)
);

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

-- Users can see requests they sent or received
CREATE POLICY "Users can view own friend requests"
  ON public.friend_requests FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can send friend requests
CREATE POLICY "Users can send friend requests"
  ON public.friend_requests FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Users can update requests they received (accept/reject)
CREATE POLICY "Receivers can update friend requests"
  ON public.friend_requests FOR UPDATE
  USING (auth.uid() = receiver_id);

-- Users can delete their own requests (cancel sent, or remove received)
CREATE POLICY "Users can delete own friend requests"
  ON public.friend_requests FOR DELETE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE INDEX IF NOT EXISTS friend_requests_sender_idx ON public.friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS friend_requests_receiver_idx ON public.friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS friend_requests_status_idx ON public.friend_requests(status);

-- ── Enable Realtime on friend_requests ──────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_rooms;
