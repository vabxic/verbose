import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import {
  supabase,
  signInWithUsername,
  signUpWithEmail,
  signInWithGoogle,
  signInWithGitHub,
  signInAnonymously,
  signOut as supabaseSignOut,
  getUserProfile,
  resetPassword as supabaseResetPassword,
} from '../lib/supabase';
import type { UserProfile } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isAnonymous: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username?: string, fullName?: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signInGitHub: () => Promise<void>;
  signInAsAnonymous: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const isAnonymous = user?.is_anonymous ?? false;

  const fetchProfile = async (userId: string) => {
    try {
      const userProfile = await getUserProfile(userId);
      setProfile(userProfile);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    // Get initial session and validate user exists. Ensure loading always finishes.
    (async () => {
      try {
        // Add a timeout to avoid indefinite hanging
        const getSessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ timeout: true }), 12000));
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const result: any = await Promise.race([getSessionPromise, timeoutPromise]);

        if (result && result.timeout) {
          console.warn('getSession() timed out after 12s');
          setSession(null);
          setUser(null);
          return;
        }

        const { data: { session }, error } = result;
        if (error) {
          console.error('Error getting session:', error);
          setSession(null);
          setUser(null);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Double-check the user still exists (may have been deleted in dashboard)
          try {
            const { data: { user }, error: userErr } = await supabase.auth.getUser();
            if (userErr) {
              console.error('Error verifying user:', userErr);
              // clear session to force re-auth
              await supabase.auth.signOut();
              setSession(null);
              setUser(null);
            } else if (!user) {
              // user not found -> sign out locally
              await supabase.auth.signOut();
              setSession(null);
              setUser(null);
            } else {
              await fetchProfile(user.id);
            }
          } catch (err) {
            console.error('Unexpected error verifying user:', err);
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
          }
        }
      } catch (err) {
        console.error('Failed to get session:', err);
      } finally {
        setLoading(false);
      }
    })();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }

        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (username: string, password: string) => {
    setLoading(true);
    try {
      await signInWithUsername(username, password);
      // Don't set loading=false here - let onAuthStateChange handle it
      // This prevents a race condition where loading=false but user is still null
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await supabaseResetPassword(email);
    } catch (err) {
      console.error('Password reset failed:', err);
      throw err;
    }
  };

  const signUp = async (
    email: string,
    password: string,
    username?: string,
    fullName?: string
  ) => {
    setLoading(true);
    try {
      await signUpWithEmail(email, password, username, fullName);
    } finally {
      setLoading(false);
    }
  };

  const signInGoogle = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const signInGitHub = async () => {
    setLoading(true);
    try {
      await signInWithGitHub();
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const signInAsAnonymous = async () => {
    setLoading(true);
    try {
      // Add a timeout to avoid hanging if the auth call stalls
      const anonPromise = signInAnonymously();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Anonymous sign-in timed out')), 12000)
      );

      await Promise.race([anonPromise, timeoutPromise]);
      // Don't set loading=false here - let onAuthStateChange handle it
    } catch (err) {
      console.error('Anonymous sign-in failed:', err);
      setLoading(false);
      throw err;
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabaseSignOut();
      setUser(null);
      setSession(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    session,
    profile,
    loading,
    isAnonymous,
    signIn,
    signUp,
    signInGoogle,
    signInGitHub,
    signInAsAnonymous,
    signOut,
    refreshProfile,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
