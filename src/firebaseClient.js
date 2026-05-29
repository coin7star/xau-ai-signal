import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "firebase/auth";
import { get, getDatabase, ref, set, update } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

export const hasFirebaseClientConfig = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.databaseURL &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

export const app = hasFirebaseClientConfig ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getDatabase(app) : null;

if (auth) {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}

export function listenAuth(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, callback);
}

export async function loginWithEmail(email, password) {
  if (!auth) throw new Error("Firebase client ENV belum lengkap.");
  return await signInWithEmailAndPassword(auth, email, password);
}

export async function resetPasswordEmail(email) {
  if (!auth) throw new Error("Firebase client ENV belum lengkap.");
  if (!email) throw new Error("Isi email akun kamu dulu.");

  await sendPasswordResetEmail(auth, email, {
    url: window.location.origin,
    handleCodeInApp: false
  });

  return { ok: true };
}

export async function registerWithEmail(email, password) {
  if (!auth || !db) throw new Error("Firebase client ENV belum lengkap.");

  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await ensureUserProfile(credential.user);
  await sendVerificationEmail(credential.user);

  return credential;
}

export async function loginWithGoogle() {
  if (!auth || !db) throw new Error("Firebase client ENV belum lengkap.");

  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  await ensureUserProfile(credential.user);

  return credential;
}

export async function logout() {
  if (!auth) return;
  await signOut(auth);
}

export async function sendVerificationEmail(user = auth?.currentUser) {
  if (!user) throw new Error("User belum login.");
  if (user.emailVerified) return { ok: true, skipped: "already-verified" };

  await sendEmailVerification(user);
  return { ok: true };
}

export async function refreshCurrentUser() {
  if (!auth?.currentUser) return null;

  await reload(auth.currentUser);
  await ensureUserProfile(auth.currentUser);

  return auth.currentUser;
}

export async function ensureUserProfile(user) {
  if (!db || !user) return null;

  const userRef = ref(db, `users/${user.uid}`);
  const snapshot = await get(userRef);

  if (!snapshot.exists()) {
    const now = new Date().toISOString();

    const profile = {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || "",
      photoURL: user.photoURL || "",
      emailVerified: Boolean(user.emailVerified),
      role: "free",
      status: "active",
      premiumUntil: null,
      createdAt: now,
      updatedAt: now
    };

    await set(userRef, profile);
    return profile;
  }

  const current = snapshot.val() || {};

  const patch = {
    email: user.email || current.email || "",
    displayName: user.displayName || current.displayName || "",
    photoURL: user.photoURL || current.photoURL || "",
    emailVerified: Boolean(user.emailVerified),
    lastLoginAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await update(userRef, patch);

  return {
    ...current,
    ...patch
  };
}

export async function getUserProfile(uid) {
  if (!db || !uid) return null;

  const snapshot = await get(ref(db, `users/${uid}`));

  if (!snapshot.exists()) return null;

  return snapshot.val();
}

export function isPremiumProfile(profile) {
  if (!profile) return false;
  if (profile.role === "admin") return true;
  if (profile.role !== "premium") return false;

  const until = profile.premiumUntil || profile.expiredAt || null;
  if (!until) return false;

  return new Date(until).getTime() > Date.now();
}
