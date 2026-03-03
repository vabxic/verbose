import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  auth,
  onAuthStateChanged,
  signInWithUsername,
  signUpWithEmail,
  signInWithGoogle,
  signInWithGitHub,
  signInAnonymously,
  signOut as firebaseSignOut,
  resetPassword as firebaseResetPassword,
  signInWithMagicLink as firebaseMagicLink,
  type FirebaseUser,
} from '../lib/firebase';
import {
  getUserProfile,
} from '../lib/db';
import type { UserProfile } from '../lib/db';

type AppUser = {
  id: string;
  email?: string | null;
  user_metadata?: {
    full_name?: string | null;
    name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
    picture?: string | null;
  } | null;
  is_anonymous?: boolean;
};

interface AuthContextType {
  user: AppUser | null;
  session: AppUser | null;  // mirrors `user`; Firebase has no separate session object
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
  signInWithMagicLink: (email: string) => Promise<void>;
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
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const isAnonymous = user?.is_anonymous ?? false;

  const normalizeFirebaseUser = (fu: FirebaseUser | null): AppUser | null => {
    if (!fu) return null;
    return {
      id: fu.uid,
      email: fu.email ?? null,
      user_metadata: {
        full_name: fu.displayName ?? null,
        name: fu.displayName ?? null,
        username: null,
        avatar_url: (fu as any).photoURL ?? null,
        picture: (fu as any).photoURL ?? null,
      },
      is_anonymous: (fu as any).isAnonymous ?? false,
    };
  };

  const fetchProfile = async (userId: string) => {
    try {
      // Add timeout to prevent infinite loading
      const profilePromise = getUserProfile(userId);
      const timeoutPromise = new Promise<null>((resolve) => 
        setTimeout(() => resolve(null), 5000)
      );
      
      const userProfile = await Promise.race([profilePromise, timeoutPromise]);
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
    // Firebase fires onAuthStateChanged immediately with the current user
    // (or null), so we never need to call getSession() separately.
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const appUser = normalizeFirebaseUser(firebaseUser);
      setUser(appUser);
      setSession(appUser);

      if (firebaseUser) {
        await fetchProfile(firebaseUser.uid);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
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
      await firebaseResetPassword(email);
    } catch (err) {
      console.error('Password reset failed:', err);
      throw err;
    }
  };

  const signInWithMagicLink = async (email: string) => {
    try {
      await firebaseMagicLink(email);
    } catch (err) {
      console.error('Magic link sign-in failed:', err);
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
    // Clear state immediately so the UI switches to the landing page
    // without showing a long loading spinner.
    setUser(null);
    setSession(null);
    setProfile(null);
    try {
      await firebaseSignOut();
    } catch (err) {
      console.error('Sign-out error:', err);
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
    signInWithMagicLink,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
