import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials not found. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
);

function validateSupabaseUrl() {
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL is not set. Please set VITE_SUPABASE_URL in your .env file to your Supabase project URL (e.g. https://<project-ref>.supabase.co)');
  }
  const ok = /^https?:\/\/[a-z0-9-]+\.supabase\.co(?:\/.*)?$/i.test(supabaseUrl);
  if (!ok) {
    throw new Error(`VITE_SUPABASE_URL appears invalid: ${supabaseUrl}. It must match https://<project-ref>.supabase.co`);
  }
}

// Database types for user profiles
export interface UserProfile {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  is_anonymous: boolean;
}

// Auth helper functions
export const signUpWithEmail = async (
  email: string,
  password: string,
  username?: string,
  fullName?: string
) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        full_name: fullName,
      },
    },
  });

  if (error) throw error;
  return data;
};

export const signInWithEmail = async (email: string, password: string) => {
  console.log('signInWithEmail called with:', email);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  console.log('signInWithPassword result - data:', data, 'error:', error);

  if (error) {
    console.error('Auth error:', error.message);
    throw error;
  }
  return data;
};

export const signInWithGoogle = async () => {
  validateSupabaseUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });

  if (error) throw error;
  return data;
};

export const signInWithGitHub = async () => {
  validateSupabaseUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
  });

  if (error) throw error;
  return data;
};

export const signInAnonymously = async () => {
  const { data, error } = await supabase.auth.signInAnonymously();

  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
};

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
  
  const { data, error } = await supabase
    .rpc('get_email_by_username', { lookup_username: username });

  console.log('RPC result - data:', data, 'error:', error);

  if (error) {
    console.error('Error looking up email by username:', error);
    return null;
  }
  return data ?? null;
};

// Sign in with username or email and password
export const signInWithUsername = async (usernameOrEmail: string, password: string) => {
  console.log('signInWithUsername called for:', usernameOrEmail);
  
  // Check if the input is an email address
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmail = emailRegex.test(usernameOrEmail);
  
  if (isEmail) {
    // If it's an email, sign in directly with email
    console.log('Input is an email, signing in directly...');
    const result = await signInWithEmail(usernameOrEmail, password);
    console.log('signInWithEmail result:', result);
    return result;
  } else {
    // If it's a username, look up the email first
    const email = await getEmailByUsername(usernameOrEmail);
    console.log('Found email:', email);
    
    if (!email) {
      throw new Error('Username not found');
    }
    
    // Then sign in with the email
    console.log('Attempting signInWithEmail...');
    const result = await signInWithEmail(email, password);
    console.log('signInWithEmail result:', result);
    return result;
  }
};

// Send password reset email
export const resetPassword = async (email: string) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) throw error;
  return data;
};

// Sign in with magic link (passwordless email authentication)
export const signInWithMagicLink = async (email: string) => {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) throw error;
  return data;
};
