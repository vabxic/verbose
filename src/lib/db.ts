/**
 * db.ts – Firebase Firestore & Storage (replaces supabase.ts)
 *
 * All database and file-storage operations now go through Firebase.
 * Authentication is handled by Firebase Auth (see firebase.ts).
 */

import { initializeApp, getApp, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';

// ---------------------------------------------------------------------------
// Firebase app (singleton: reuse if already initialised, or init once)
// ---------------------------------------------------------------------------
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID ?? '',
  ...(import.meta.env.VITE_FIREBASE_DATABASE_URL
    ? { databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL as string }
    : {}),
};

let app: FirebaseApp;
try {
  // Try to get existing app (safe on subsequent re-evaluations)
  app = getApp();
} catch {
  // App doesn't exist yet — initialize it once
  app = initializeApp(firebaseConfig);
}

/** Shared Firebase App instance (used by all modules) */
export { app };

/** Shared Firestore instance */
export const db = getFirestore(app);

/** Shared Firebase Storage instance (for file uploads) */
export const storage = getStorage(app);

/** Shared Realtime Database instance (used for presence). Null when VITE_FIREBASE_DATABASE_URL is not configured. */
export const rtdb = import.meta.env.VITE_FIREBASE_DATABASE_URL ? getDatabase(app) : null;

// ---------------------------------------------------------------------------
// User Profile types & helpers (previously in supabase.ts)
// ---------------------------------------------------------------------------

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
  const snap = await getDoc(doc(db, 'profiles', userId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as UserProfile;
};

export const updateUserProfile = async (
  userId: string,
  updates: Partial<Omit<UserProfile, 'id' | 'created_at'>>,
) => {
  const ref = doc(db, 'profiles', userId);
  const snap = await getDoc(ref);
  const payload = { ...updates, updated_at: new Date().toISOString() };

  if (snap.exists()) {
    await updateDoc(ref, payload);
  } else {
    await setDoc(ref, {
      id: userId,
      email: '',
      username: null,
      full_name: null,
      avatar_url: null,
      is_anonymous: false,
      created_at: new Date().toISOString(),
      ...payload,
    });
  }

  return { id: userId, ...payload };
};

/**
 * Resolve a username → email for sign-in.
 * Queries the Firestore `profiles` collection where username == lookup_username.
 */
export const getEmailByUsername = async (username: string): Promise<string | null> => {
  console.log('Looking up email for username:', username);
  const q = query(
    collection(db, 'profiles'),
    where('username', '==', username),
  );
  const snap = await getDocs(q);

  if (snap.empty) {
    console.log('Username not found in Firestore');
    return null;
  }

  const data = snap.docs[0].data();
  console.log('Resolved email:', data.email);
  return data.email ?? null;
};

/**
 * Ensure a profile document exists for a freshly-authenticated user.
 * Called from the auth provider after sign-up / first sign-in.
 */
export const ensureProfile = async (
  userId: string,
  defaults: Partial<UserProfile> = {},
) => {
  const ref = doc(db, 'profiles', userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      id: userId,
      email: defaults.email ?? '',
      username: defaults.username ?? null,
      full_name: defaults.full_name ?? null,
      avatar_url: defaults.avatar_url ?? null,
      is_anonymous: defaults.is_anonymous ?? false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
};
