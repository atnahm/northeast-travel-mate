import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Exposes public Firebase Web SDK client configuration from runtime container environment variables.
 * This allows Docker containers (e.g. Render / Cloud Run) built without build-time secrets in the
 * Dockerfile to still initialize Firebase Auth at runtime without hardcoding keys in source code.
 */
export async function GET() {
  return NextResponse.json({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  });
}
