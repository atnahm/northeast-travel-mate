import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  connectAuthEmulator,
  type Auth,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

let emulatorConnected = false;

export function isFirebaseWebConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

export function getFirebaseWebApp(): FirebaseApp | null {
  if (!isFirebaseWebConfigured()) return null;
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseWebAuth(): Auth | null {
  const app = getFirebaseWebApp();
  if (!app) return null;
  const auth = getAuth(app);
  if (
    !emulatorConnected &&
    typeof window !== "undefined" &&
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true"
  ) {
    try {
      connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
      emulatorConnected = true;
    } catch {
      // ignore if already connected
    }
  }
  return auth;
}

export interface FirebaseAuthResult {
  idToken: string;
  displayName: string;
  email: string;
}

function formatFirebaseAuthError(err: unknown): Error {
  const code = (err as { code?: string })?.code || "";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
    return new Error("Incorrect email or password. If you are a new user, switch to 'Create Account'.");
  }
  if (code === "auth/email-already-in-use") {
    return new Error("An account with this email already exists. Please switch to 'Sign In'.");
  }
  if (code === "auth/weak-password") {
    return new Error("Password must be at least 6 characters.");
  }
  if (code === "auth/popup-closed-by-user") {
    return new Error("Google sign-in popup was closed before completing.");
  }
  return err instanceof Error ? err : new Error("Authentication failed. Please try again.");
}

export async function signInWithGoogleFirebase(): Promise<FirebaseAuthResult> {
  const auth = getFirebaseWebAuth();
  if (!auth) throw new Error("Firebase Web SDK not configured.");
  try {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const idToken = await cred.user.getIdToken();
    return {
      idToken,
      displayName: cred.user.displayName || "",
      email: cred.user.email || "",
    };
  } catch (err) {
    throw formatFirebaseAuthError(err);
  }
}

export async function loginWithEmailFirebase(email: string, password: string): Promise<FirebaseAuthResult> {
  const auth = getFirebaseWebAuth();
  if (!auth) throw new Error("Firebase Web SDK not configured.");
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await cred.user.getIdToken();
    return {
      idToken,
      displayName: cred.user.displayName || "",
      email: cred.user.email || email,
    };
  } catch (err) {
    throw formatFirebaseAuthError(err);
  }
}

export async function registerWithEmailFirebase(
  email: string,
  password: string,
  fullName?: string
): Promise<FirebaseAuthResult> {
  const auth = getFirebaseWebAuth();
  if (!auth) throw new Error("Firebase Web SDK not configured.");
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (fullName?.trim()) {
      await updateProfile(cred.user, { displayName: fullName.trim() }).catch(() => undefined);
    }
    const idToken = await cred.user.getIdToken(true);
    return {
      idToken,
      displayName: fullName?.trim() || cred.user.displayName || "",
      email: cred.user.email || email,
    };
  } catch (err) {
    throw formatFirebaseAuthError(err);
  }
}

export async function signInWithEmailFirebase(email: string, password: string, createIfMissing = true): Promise<string> {
  if (createIfMissing) {
    try {
      const res = await loginWithEmailFirebase(email, password);
      return res.idToken;
    } catch {
      const res = await registerWithEmailFirebase(email, password);
      return res.idToken;
    }
  }
  const res = await loginWithEmailFirebase(email, password);
  return res.idToken;
}

export async function signOutFirebase(): Promise<void> {
  const auth = getFirebaseWebAuth();
  if (auth) {
    await signOut(auth).catch(() => undefined);
  }
}
