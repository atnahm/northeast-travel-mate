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
let runtimeConfigLoaded = false;

export function isFirebaseWebConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

/**
 * Loads public Firebase Web SDK configuration from the server's runtime environment
 * (/api/auth/config) when the Docker image was built without build-time NEXT_PUBLIC_* args.
 */
export async function ensureFirebaseRuntimeConfig(): Promise<boolean> {
  if (isFirebaseWebConfigured()) return true;
  if (runtimeConfigLoaded || typeof window === "undefined") return isFirebaseWebConfigured();
  runtimeConfigLoaded = true;
  try {
    const resp = await fetch("/api/auth/config", { cache: "no-store" });
    if (!resp.ok) return false;
    const data = await resp.json();
    if (data?.apiKey && data?.projectId) {
      firebaseConfig.apiKey = String(data.apiKey);
      firebaseConfig.authDomain = String(data.authDomain || "");
      firebaseConfig.projectId = String(data.projectId);
      firebaseConfig.storageBucket = String(data.storageBucket || "");
      firebaseConfig.messagingSenderId = String(data.messagingSenderId || "");
      firebaseConfig.appId = String(data.appId || "");
      return true;
    }
  } catch {
    // ignore network failure and fall back to local/PoC session mode
  }
  return isFirebaseWebConfigured();
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

function isDomainOrProviderConfigError(err: unknown): boolean {
  const code = (err as { code?: string })?.code || "";
  const msg = err instanceof Error ? err.message : String(err || "");
  return (
    code === "auth/unauthorized-domain" ||
    code === "auth/operation-not-allowed" ||
    code === "auth/configuration-not-found" ||
    msg.includes("unauthorized-domain") ||
    msg.includes("operation-not-allowed") ||
    msg.includes("configuration-not-found")
  );
}

function buildCloudPocToken(email: string, displayName?: string): FirebaseAuthResult {
  const cleanEmail = (email || "traveler@nemate.in").trim().toLowerCase();
  const slug = cleanEmail.split("@")[0].replace(/[^a-z0-9_]/g, "_") || "traveler";
  const name = (displayName || slug.replace(/_/g, " ")).trim();
  const encodedEmail = encodeURIComponent(cleanEmail);
  const encodedName = encodeURIComponent(name);
  return {
    idToken: `poc:${slug}:${encodedEmail}:${encodedName}`,
    displayName: name,
    email: cleanEmail,
  };
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
    if (isDomainOrProviderConfigError(err)) {
      return buildCloudPocToken("google_traveler@nemate.in", "Google Traveler");
    }
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
    if (isDomainOrProviderConfigError(err)) {
      return buildCloudPocToken(email);
    }
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
    if (isDomainOrProviderConfigError(err)) {
      return buildCloudPocToken(email, fullName);
    }
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
