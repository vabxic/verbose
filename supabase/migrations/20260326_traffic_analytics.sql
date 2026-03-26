-- Supabase SQL Migration for Traffic Analytics
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create page_views table to track individual page visits
CREATE TABLE IF NOT EXISTS public.page_views (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID NOT NULL,
  visitor_id UUID NOT NULL,
  page_path TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  device_type TEXT CHECK (device_type IN ('desktop', 'mobile', 'tablet')) DEFAULT 'desktop',
  traffic_source TEXT CHECK (traffic_source IN ('direct', 'social', 'organic', 'referral')) DEFAULT 'direct',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create active_sessions table to track currently active users
CREATE TABLE IF NOT EXISTS public.active_sessions (
  id UUID PRIMARY KEY,
  visitor_id UUID NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  device_type TEXT CHECK (device_type IN ('desktop', 'mobile', 'tablet')) DEFAULT 'desktop',
  is_new_visitor BOOLEAN DEFAULT false
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON public.page_views (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_session_id ON public.page_views (session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_visitor_id ON public.page_views (visitor_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_last_active ON public.active_sessions (last_active_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies to allow anonymous inserts and reads (for public traffic tracking)
-- Policy for page_views: allow anyone to insert and select
CREATE POLICY "Allow anonymous page view inserts" ON public.page_views
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous page view reads" ON public.page_views
  FOR SELECT USING (true);

-- Policy for active_sessions: allow anyone to insert, update, and select
CREATE POLICY "Allow anonymous session inserts" ON public.active_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous session updates" ON public.active_sessions
  FOR UPDATE USING (true);

CREATE POLICY "Allow anonymous session reads" ON public.active_sessions
  FOR SELECT USING (true);

CREATE POLICY "Allow anonymous session deletes" ON public.active_sessions
  FOR DELETE USING (true);

-- Enable Realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.page_views;
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_sessions;

-- Create a function to clean up old sessions (inactive for more than 30 minutes)
CREATE OR REPLACE FUNCTION cleanup_old_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM public.active_sessions
  WHERE last_active_at < NOW() - INTERVAL '30 minutes';
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to clean up old sessions every 5 minutes
-- Note: This requires pg_cron extension which may need to be enabled in Supabase dashboard
-- SELECT cron.schedule('cleanup-sessions', '*/5 * * * *', 'SELECT cleanup_old_sessions()');

-- Grant necessary permissions
GRANT ALL ON public.page_views TO anon;
GRANT ALL ON public.page_views TO authenticated;
GRANT ALL ON public.active_sessions TO anon;
GRANT ALL ON public.active_sessions TO authenticated;
