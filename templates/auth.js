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
  signOut
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDHt49wno8cSNzo5eWpqRSCpSBjQA1k3Vc",
  authDomain: "verbose-61a0e.firebaseapp.com",
  projectId: "verbose-61a0e",
  storageBucket: "verbose-61a0e.firebasestorage.app",
  messagingSenderId: "741856051875",
  appId: "1:741856051875:web:8e06af97fd08edeebaf516",
  measurementId: "G-G81J151P5Z"
};

const app = initializeApp(firebaseConfig);
try { getAnalytics(app); } catch {}

const auth = getAuth(app);
const db = getFirestore(app);
const USERNAMES_COLLECTION = "usernames";

function normalizeUsername(username) {
  return (username || "").trim().toLowerCase().replace(/\s+/g, "");
}

/* ---------------- USER SAVE ---------------- */
function saveUser(user) {
  localStorage.setItem("googleUser", JSON.stringify({
    displayName: user.displayName || "User",
    photoURL: user.photoURL || null,
    email: user.email
  }));
}

/* ---------------- SIGN UP ---------------- */
export async function signUpWithEmail(email, password, displayName = "") {
  const usernameNorm = normalizeUsername(displayName);
  if (usernameNorm) {
    const ref = doc(db, USERNAMES_COLLECTION, usernameNorm);
    if ((await getDoc(ref)).exists()) throw new Error("Username taken");
  }

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) await updateProfile(cred.user, { displayName });

  if (usernameNorm) {
    await setDoc(doc(db, USERNAMES_COLLECTION, usernameNorm), { email });
  }

  saveUser(cred.user);
  window.location.href = "/home";
}

/* ---------------- SIGN IN ---------------- */
export async function signInWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  saveUser(cred.user);
  window.location.href = "/home";
}

/* ---------------- GOOGLE SIGN IN ---------------- */
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    saveUser(result.user);
    window.location.href = "/home";
  } catch (err) {
    if (err.code === "auth/popup-blocked") {
      await signInWithRedirect(auth, provider);
    } else {
      throw err;
    }
  }
}

export async function handleRedirectResult() {
  const result = await getRedirectResult(auth);
  if (result?.user) {
    saveUser(result.user);
    window.location.href = "/home";
  }
}

/* ---------------- LOGOUT ---------------- */
export async function logoutUser() {
  await signOut(auth);
  localStorage.removeItem("googleUser");
  window.location.href = "/";
}

/* ---------------- AUTH STATE ---------------- */
onAuthStateChanged(auth, (user) => {
  if (user) saveUser(user);
});

/* ---------------- INIT ---------------- */
document.addEventListener("DOMContentLoaded", handleRedirectResult);
