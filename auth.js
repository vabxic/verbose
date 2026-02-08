  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-analytics.js";
  import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    updateProfile,
    onAuthStateChanged,
  } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
  import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
  } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

  // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyDHt49wno8cSNzo5eWpqRSCpSBjQA1k3Vc",
    authDomain: "verbose-61a0e.firebaseapp.com",
    projectId: "verbose-61a0e",
    storageBucket: "verbose-61a0e.firebasestorage.app",
    messagingSenderId: "741856051875",
    appId: "1:741856051875:web:8e06af97fd08edeebaf516",
    measurementId: "G-G81J151P5Z"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  try {
    getAnalytics(app);
  } catch (_) {
    // Analytics may fail in some environments; auth still works
  }
  const auth = getAuth(app);
  const db = getFirestore(app);

  const USERNAMES_COLLECTION = "usernames";

  function normalizeUsername(username) {
    return (username || "").trim().toLowerCase().replace(/\s+/g, "");
  }

  // --- Username → email lookup (for login without email) ---
  export async function getEmailForUsername(username) {
    const normalized = normalizeUsername(username);
    if (!normalized) return null;
    const ref = doc(db, USERNAMES_COLLECTION, normalized);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data().email : null;
  }

  // --- Email/Password Sign Up (optionally register username for later login) ---
  export async function signUpWithEmail(email, password, displayName = "") {
    const usernameNorm = displayName ? normalizeUsername(displayName) : "";
    if (usernameNorm) {
      const ref = doc(db, USERNAMES_COLLECTION, usernameNorm);
      const existing = await getDoc(ref);
      if (existing.exists()) {
        const err = new Error("This username is already taken.");
        err.code = "auth/username-taken";
        throw err;
      }
    }
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName && userCredential.user) {
      await updateProfile(userCredential.user, { displayName });
    }
    if (usernameNorm && userCredential.user) {
      const ref = doc(db, USERNAMES_COLLECTION, usernameNorm);
      await setDoc(ref, { email: userCredential.user.email });
    }
    return userCredential.user;
  }

  // --- Email/Password Sign In ---
  export async function signInWithEmail(email, password) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  }

  // --- Sign in with email OR username (same password) ---
  export async function signInWithEmailOrUsername(emailOrUsername, password) {
    const value = (emailOrUsername || "").trim();
    if (!value || !password) return null;
    const isEmail = value.includes("@");
    const email = isEmail ? value : await getEmailForUsername(value);
    if (!email) {
      const err = new Error("No account found for that username.");
      err.code = "auth/user-not-found";
      throw err;
    }
    return signInWithEmail(email, password);
  }

  // --- Google Sign In (works for both sign up and sign in) ---
  // Tries popup first; falls back to redirect if popup is blocked
  export async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (err) {
      if (err.code === "auth/popup-blocked" || err.code === "auth/cancelled-popup-request") {
        await signInWithRedirect(auth, provider);
        return null; // Page will reload; getRedirectResult will run on load
      }
      throw err;
    }
  }

  // Call on page load to complete redirect sign-in
  export async function handleRedirectResult() {
    try {
      const result = await getRedirectResult(auth);
      if (result?.user) return result.user;
    } catch (err) {
      console.error("Google redirect sign-in error:", err);
      throw err;
    }
    return null;
  }

  // --- Auth state observer (e.g. close modal, redirect) ---
  export function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
  }

  // --- Wire up sign-in / sign-up UI (call after DOM ready) ---
  function showAuthError(selector, message) {
    const el = document.querySelector(selector);
    if (el) {
      el.textContent = message;
      el.className = "auth-msg error";
    }
  }
  function clearAuthError(selector) {
    const el = document.querySelector(selector);
    if (el) {
      el.textContent = "";
      el.className = "auth-msg";
    }
  }

  async function initAuthUI() {
    // After Google redirect, complete sign-in and close modal
    try {
      const redirectUser = await handleRedirectResult();
      if (redirectUser && typeof window.closeAuth === "function") window.closeAuth();
    } catch (_) {
      // Ignore; user may have cancelled or error already shown
    }

    const signinView = document.getElementById("auth-signin-view");
    const signupView = document.getElementById("auth-signup-view");
    const switchToSignup = document.getElementById("switch-to-signup");
    const switchToSignin = document.getElementById("switch-to-signin");

    if (switchToSignup) {
      switchToSignup.addEventListener("click", (e) => {
        e.preventDefault();
        if (signinView) signinView.style.display = "none";
        if (signupView) signupView.style.display = "block";
        clearAuthError("#auth-msg");
        clearAuthError("#auth-msg-signup");
      });
    }
    if (switchToSignin) {
      switchToSignin.addEventListener("click", (e) => {
        e.preventDefault();
        if (signupView) signupView.style.display = "none";
        if (signinView) signinView.style.display = "block";
        clearAuthError("#auth-msg");
        clearAuthError("#auth-msg-signup");
      });
    }

    function setButtonsLoading(loading) {
      const signinFormEl = document.getElementById("signin-form");
      const signupFormEl = document.getElementById("signup-form");
      const signinBtn = signinFormEl?.querySelector('button[type="submit"]');
      const signupBtn = signupFormEl?.querySelector('button[type="submit"]');
      const gSignin = document.getElementById("google-btn-signin");
      const gSignup = document.getElementById("google-btn-signup");
      [signinBtn, signupBtn, gSignin, gSignup].forEach((btn) => {
        if (btn) {
          btn.disabled = loading;
          if (loading && (btn === gSignin || btn === gSignup)) {
            btn.dataset.originalText = btn.textContent;
            btn.textContent = "Opening…";
          } else if (!loading && btn.dataset.originalText) {
            btn.textContent = btn.dataset.originalText;
          }
        }
      });
    }

    function getAuthErrorMessage(err, fallback) {
      const code = err?.code || "";
      if (code === "auth/unauthorized-domain") {
        return "This domain is not authorized. Add it in Firebase Console → Authentication → Settings → Authorized domains (e.g. localhost).";
      }
      if (code === "auth/operation-not-allowed") {
        return "Google sign-in is disabled. Enable it in Firebase Console → Authentication → Sign-in method.";
      }
      if (code === "auth/network-request-failed") {
        return "Network error. Check your connection and try again.";
      }
      if (code === "auth/too-many-requests") {
        return "Too many attempts. Please try again later.";
      }
      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        return "Invalid email or password.";
      }
      if (code === "auth/user-not-found") {
        return "No account found for that email or username.";
      }
      if (code === "auth/username-taken") {
        return err?.message || "This username is already taken.";
      }
      if (code === "auth/email-already-in-use") {
        return "An account with this email already exists. Sign in instead.";
      }
      if (code === "auth/weak-password") {
        return "Password should be at least 6 characters.";
      }
      return err?.message || fallback;
    }

    const signinForm = document.getElementById("signin-form");
    if (signinForm) {
      signinForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearAuthError("#auth-msg");
        const emailOrUsername = document.getElementById("signin-email")?.value?.trim();
        const password = document.getElementById("signin-password")?.value;
        if (!emailOrUsername || !password) return;
        setButtonsLoading(true);
        try {
          await signInWithEmailOrUsername(emailOrUsername, password);
          if (typeof window.closeAuth === "function") window.closeAuth();
        } catch (err) {
          showAuthError("#auth-msg", getAuthErrorMessage(err, "Sign in failed."));
        } finally {
          setButtonsLoading(false);
        }
      });
    }

    const signupForm = document.getElementById("signup-form");
    if (signupForm) {
      signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearAuthError("#auth-msg-signup");
        const email = document.getElementById("signup-email")?.value?.trim();
        const password = document.getElementById("signup-password")?.value;
        const displayName = document.getElementById("signup-username")?.value?.trim() || "";
        if (!email || !password) return;
        setButtonsLoading(true);
        try {
          await signUpWithEmail(email, password, displayName);
          if (typeof window.closeAuth === "function") window.closeAuth();
        } catch (err) {
          showAuthError("#auth-msg-signup", getAuthErrorMessage(err, "Sign up failed."));
        } finally {
          setButtonsLoading(false);
        }
      });
    }

    async function handleGoogleSignIn(msgSelector) {
      clearAuthError(msgSelector);
      setButtonsLoading(true);
      try {
        const user = await signInWithGoogle();
        if (user) {
          if (typeof window.closeAuth === "function") window.closeAuth();
        }
        // If null, redirect was started; page will reload
      } catch (err) {
        showAuthError(msgSelector, getAuthErrorMessage(err, "Google sign in failed."));
      } finally {
        setButtonsLoading(false);
      }
    }

    const googleBtnSignin = document.getElementById("google-btn-signin");
    const googleBtnSignup = document.getElementById("google-btn-signup");
    if (googleBtnSignin) googleBtnSignin.addEventListener("click", () => handleGoogleSignIn("#auth-msg"));
    if (googleBtnSignup) googleBtnSignup.addEventListener("click", () => handleGoogleSignIn("#auth-msg-signup"));
  }

  if (typeof document !== "undefined" && document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAuthUI);
  } else {
    initAuthUI();
  }