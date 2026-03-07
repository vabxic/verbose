import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Supabase is used exclusively for database and storage.
// Authentication is handled by Firebase (see src/lib/firebase.ts).
// ---------------------------------------------------------------------------

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    // Auth is handled by Firebase – disabling Supabase auth avoids the
    // Cross-Origin-Opener-Policy warning caused by its popup-closed check.
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    // Give realtime a generous timeout and let it reconnect automatically.
    realtime: {
      timeout: 30000,
      params: {
        eventsPerSecond: 10,
      },
    },
    global: {
      // Add a 20-second fetch timeout so hung requests fail fast instead of
      // accumulating and flooding the console.
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 20000);
        return fetch(input, { ...init, signal: controller.signal }).finally(() =>
          clearTimeout(id),
        );
      },
    },
  },
);

// Database types for user profiles
export interface UserProfile {
  id: string;   // Firebase UID
  email: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  is_anonymous: boolean;
}

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data;
};

export const updateUserProfile = async (
  userId: string,
  updates: Partial<Omit<UserProfile, 'id' | 'created_at'>>
) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Get email by username for sign-in (uses secure database function)
export const getEmailByUsername = async (username: string): Promise<string | null> => {
  console.log('Looking up email for username:', username);
  const { data, error } = await supabase.rpc('get_email_by_username', { lookup_username: username });

  console.log('RPC result - data:', data, 'error:', error);

  if (error) {
    console.error('Error looking up email by username:', error);
    return null;
  }

  // The RPC may return several shapes depending on Postgres/Supabase version:
  // - a plain string (the function returns TEXT)
  // - an array like [{ get_email_by_username: 'user@example.com' }]
  // - an object with a single key mapping to the email
  if (!data) return null;

  // If it's already a string, return it
  if (typeof data === 'string') return data;

  // If it's an array with an object, extract the first value
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object') {
      const vals = Object.values(first);
      if (vals.length > 0 && typeof vals[0] === 'string') return vals[0];
    }
  }

  // If it's an object, try to grab the first value
  if (typeof data === 'object') {
    const vals = Object.values(data as Record<string, any>);
    if (vals.length > 0 && typeof vals[0] === 'string') return vals[0];
  }

  return null;
};


