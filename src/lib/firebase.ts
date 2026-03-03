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
import { app, getEmailByUsername } from './db';

// Validate config early and provide actionable error messages.
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.toString() ?? '';
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.toString() ?? '';
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
  // Firebase creates the user; username / fullName are stored in Firestore
  // profiles collection separately (see updateUserProfile in db.ts).
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
 * Usernames are resolved to emails via the Firestore `profiles` collection
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

  // Resolve username → email via Firestore profiles collection
  const email = await getEmailByUsername(usernameOrEmail);
  console.log('Resolved email:', email);

  if (!email) {
    throw new Error('Username not found');
  }

  return signInWithEmail(email, password);
};
