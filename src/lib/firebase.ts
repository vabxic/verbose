import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInAnonymously as firebaseSignInAnonymously,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { getEmailByUsername } from './supabase';

// Load Firebase config from environment (Vite) variables. Do NOT hardcode
// credentials directly in source — put them in a .env file at project root.
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID ?? '',
};

// Validate config early and provide actionable error messages.
const apiKey = firebaseConfig.apiKey?.toString() ?? '';
const projectId = firebaseConfig.projectId?.toString() ?? '';
if (!apiKey || apiKey.length < 20) {
  // A missing or too-short API key usually means the Vite env vars weren't
  // available at build time or you didn't restart the dev server after
  // creating `.env`/.env.local. Throw a clear error to guide the developer.
  throw new Error(
    'Missing or invalid Firebase API key. Set VITE_FIREBASE_API_KEY in .env or .env.local and restart the dev server.'
  );
}
if (!projectId) {
  throw new Error('Missing VITE_FIREBASE_PROJECT_ID in environment.');
}

const app = initializeApp(firebaseConfig);

/** Shared Firebase Auth instance */
export const auth = getAuth(app);

export type { User as FirebaseUser };
export { onAuthStateChanged };

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

export const signUpWithEmail = async (
  email: string,
  password: string,
  _username?: string,
  _fullName?: string
) => {
  // Firebase creates the user; username / fullName are stored in Supabase
  // profiles table separately (see updateUserProfile in supabase.ts).
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  return credential;
};

export const signInWithEmail = async (email: string, password: string) => {
  console.log('signInWithEmail called with:', email);
  const credential = await signInWithEmailAndPassword(auth, email, password);
  console.log('signInWithEmailAndPassword result:', credential);
  return credential;
};

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
};

export const signInWithGitHub = async () => {
  const provider = new GithubAuthProvider();
  return signInWithPopup(auth, provider);
};

export const signInAnonymously = async () => {
  return firebaseSignInAnonymously(auth);
};

export const signOut = async () => {
  return firebaseSignOut(auth);
};

export const getCurrentUser = () => auth.currentUser;

export const resetPassword = async (email: string) => {
  return sendPasswordResetEmail(auth, email, {
    url: `${window.location.origin}/reset-password`,
  });
};

export const signInWithMagicLink = async (email: string) => {
  return sendSignInLinkToEmail(auth, email, {
    url: `${window.location.origin}/auth/callback`,
    handleCodeInApp: true,
  });
};

/**
 * Sign in with either a username or email address.
 * Usernames are resolved to emails via the Supabase `get_email_by_username`
 * RPC and the actual sign-in is performed through Firebase Auth.
 */
export const signInWithUsername = async (usernameOrEmail: string, password: string) => {
  console.log('signInWithUsername called for:', usernameOrEmail);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmail = emailRegex.test(usernameOrEmail);

  if (isEmail) {
    console.log('Input is an email, signing in directly...');
    return signInWithEmail(usernameOrEmail, password);
  }

  // Resolve username → email via Supabase RPC (DB only, no Supabase Auth used)
  const email = await getEmailByUsername(usernameOrEmail);
  console.log('Resolved email:', email);

  if (!email) {
    throw new Error('Username not found');
  }

  return signInWithEmail(email, password);
};
