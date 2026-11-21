"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileText,
  Globe2,
  LogIn,
  MapPin,
  ShieldCheck,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { Button, Card } from "@/components/ui/Primitives";
import { useAppStore } from "@/lib/store/app-store";
import {
  isFirebaseWebConfigured,
  loginWithEmailFirebase,
  registerWithEmailFirebase,
  signInWithGoogleFirebase,
} from "@/lib/firebase/client";
import { apiFetch } from "@ne-mate/shared/api-client";
import type { CitizenType, LangCode, UserProfile } from "@ne-mate/shared";

const COUNTRIES = [
  { code: "IN", name: "India" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "JP", name: "Japan" },
  { code: "AU", name: "Australia" },
  { code: "CA", name: "Canada" },
  { code: "BD", name: "Bangladesh" },
  { code: "BT", name: "Bhutan" },
  { code: "NP", name: "Nepal" },
  { code: "SG", name: "Singapore" },
];

interface SessionResponse {
  uid: string;
  email?: string | null;
  role?: string;
  onboarding_completed: boolean;
  profile: UserProfile | null;
}

function GoogleIcon() {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white shrink-0" aria-hidden="true">
      <svg className="w-4 h-4" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
    </span>
  );
}

function OnboardingFlowInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get("mode") === "edit";
  const initialTab = searchParams.get("tab") === "signup" ? "signup" : "signin";

  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);

  // Step 1 = Authentication (Sign In | Create Account)
  // Step 2 = Traveler Profile (for ILP & PAP Permit Rules)
  // Step 3 = Terms of Service & DPDP Privacy Consent
  const [step, setStep] = useState<1 | 2 | 3>(isEditMode ? 2 : 1);
  const [authMode, setAuthMode] = useState<"signin" | "signup">(initialTab);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("1995-06-15");
  const [countrySearch, setCountrySearch] = useState("");
  const [nationality, setNationality] = useState("IN");
  const [citizenType, setCitizenType] = useState<CitizenType>("indian");
  const [guardianConsent, setGuardianConsent] = useState(false);

  const [signedIn, setSignedIn] = useState(false);
  const [locationConsent, setLocationConsent] = useState(false);
  const [notifConsent, setNotifConsent] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [locationSkipped, setLocationSkipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const firebaseReady = isFirebaseWebConfigured();

  // Pre-populate fields if editing existing profile from Settings
  useEffect(() => {
    if (profile) {
      setSignedIn(true);
      setFullName(profile.full_name || "");
      setDob(profile.date_of_birth || "1995-06-15");
      setNationality(profile.nationality_code || "IN");
      setCitizenType(profile.citizen_type || "indian");
      setGuardianConsent(Boolean(profile.guardian_consent));
      setLocationConsent(Boolean(profile.location_consent));
      setNotifConsent(Boolean(profile.notifications_consent));
      if (isEditMode) {
        setStep(2);
      }
    }
  }, [profile, isEditMode]);

  const isUnder18 = useMemo(() => {
    if (!dob) return false;
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
    return age < 18;
  }, [dob]);

  const filteredCountries = useMemo(
    () =>
      COUNTRIES.filter((c) =>
        `${c.name} ${c.code}`.toLowerCase().includes(countrySearch.trim().toLowerCase())
      ),
    [countrySearch]
  );

  const establishCookieSession = async (idToken: string): Promise<SessionResponse> => {
    const resp = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      credentials: "include",
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error?.message || data?.detail || "Sign-in failed");
    setSignedIn(true);
    return data as SessionResponse;
  };

  /**
   * After authenticating (Google or Email), check whether the user already has a completed profile:
   * - Returning user with completed profile -> go directly to Home ("/")!
   * - New user without completed profile -> prefill name & continue to Step 2 (Traveler Profile).
   */
  const handlePostAuthTransition = (session: SessionResponse, fallbackName?: string, fallbackEmail?: string) => {
    if (session.profile && session.onboarding_completed) {
      setProfile(session.profile, true);
      router.replace("/");
      return;
    }
    const inferredName =
      session.profile?.full_name ||
      fallbackName?.trim() ||
      fullName.trim() ||
      (session.email || fallbackEmail || "").split("@")[0].replace(/[._-]+/g, " ");
    if (inferredName && !fullName.trim()) {
      setFullName(inferredName);
    }
    setStep(2);
  };

  const handleGoogleAuth = async () => {
    setErr("");
    setBusy(true);
    try {
      const authRes = await signInWithGoogleFirebase();
      const session = await establishCookieSession(authRes.idToken);
      handlePostAuthTransition(session, authRes.displayName, authRes.email);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Google authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (authMode === "signup" && !fullName.trim()) {
      setErr("Please enter your full name to create your account.");
      return;
    }
    setBusy(true);
    try {
      if (firebaseReady) {
        if (authMode === "signin") {
          const authRes = await loginWithEmailFirebase(email, password);
          const session = await establishCookieSession(authRes.idToken);
          handlePostAuthTransition(session, authRes.displayName, authRes.email);
        } else {
          const authRes = await registerWithEmailFirebase(email, password, fullName.trim());
          const session = await establishCookieSession(authRes.idToken);
          handlePostAuthTransition(session, fullName.trim() || authRes.displayName, authRes.email);
        }
      } else {
        const slug =
          (email.split("@")[0] || fullName || "traveler").toLowerCase().replace(/[^a-z0-9]/g, "_") || "traveler";
        const encodedEmail = encodeURIComponent((email || `${slug}@nemate.in`).trim().toLowerCase());
        const encodedName = encodeURIComponent((fullName || slug).trim());
        const session = await establishCookieSession(`poc:${slug}:${encodedEmail}:${encodedName}`);
        handlePostAuthTransition(session, fullName.trim(), email);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDevDemoSignIn = async (role: "traveler" | "admin" = "traveler") => {
    setErr("");
    setBusy(true);
    try {
      const slug = role === "admin" ? "demo_admin" : "demo_traveler";
      const session = await establishCookieSession(`poc:${slug}:${slug}%40nemate.in:Demo%20Traveler`);
      handlePostAuthTransition(session, role === "admin" ? "NE Mate Admin" : "Demo Traveler");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Demo sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationConsent(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setLocationConsent(true),
      () => setLocationConsent(false),
      { timeout: 6000 }
    );
  };

  const saveProfileAndFinish = async (destination: "/" | "/settings" = "/") => {
    setErr("");
    if (!fullName.trim()) {
      setErr("Please enter your full name.");
      setStep(2);
      return;
    }
    if (isUnder18 && !guardianConsent) {
      setErr("Under India's DPDP Act, travelers under 18 require guardian consent.");
      return;
    }
    setBusy(true);
    try {
      if (!signedIn) {
        await establishCookieSession("poc:demo_traveler:demo_traveler%40nemate.in:Demo%20Traveler");
      }
      const res = await apiFetch<{ profile: UserProfile; onboarding_completed: boolean }>("/api/v1/me", {
        method: "PUT",
        body: JSON.stringify({
          full_name: fullName.trim(),
          date_of_birth: dob,
          nationality_code: nationality,
          citizen_type: citizenType,
          preferred_lang: lang,
          guardian_consent: guardianConsent,
          location_consent: locationConsent,
          notifications_consent: notifConsent,
          low_data_mode: profile?.low_data_mode ?? false,
        }),
      });
      setProfile(res.profile, res.onboarding_completed);
      router.replace(destination);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save profile");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas p-4 md:p-8 max-w-xl mx-auto flex flex-col justify-center">
      <div className="h-1.5 w-full rounded-full woven-strip mb-6" aria-hidden="true" />

      {/* Top Brand & Language Bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => {
                if (isEditMode) {
                  router.push("/settings");
                } else {
                  setStep((s) => (s - 1) as 1 | 2);
                }
              }}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-inkMuted hover:text-ink min-h-[40px]"
            >
              <ArrowLeft className="w-4 h-4" />
              {isEditMode ? "Back to Settings" : "Back"}
            </button>
          ) : (
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="NorthEast TravelMate" className="w-11 h-11 rounded-xl shadow-sm object-contain bg-white" />
              <div>
                <p className="text-lg font-bold leading-tight text-forest">NE Mate</p>
                <p className="text-xs text-inkMuted">North-East India Travel Companion</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-borderSubtle bg-surface px-2.5 py-1.5 text-xs">
            <Globe2 className="w-3.5 h-3.5 text-forest" aria-hidden="true" />
            <select
              aria-label="App language"
              value={lang}
              onChange={(e) => setLang(e.target.value as LangCode)}
              className="bg-transparent font-semibold text-ink focus:outline-none"
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
              <option value="as">অসমীয়া</option>
              <option value="bn">বাংলা</option>
            </select>
          </div>
          {!isEditMode && (
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-forest/15 text-forest">
              Step {step} of 3
            </span>
          )}
        </div>
      </div>

      <Card className="p-6 space-y-5">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-ink">
            {step === 1
              ? authMode === "signin"
                ? "Welcome back to NE Mate"
                : "Create your NE Mate account"
              : step === 2
                ? isEditMode
                  ? "Update your Traveler Profile"
                  : "Personalize your Traveler Profile"
                : "Terms of Service & Data Privacy Consent"}
          </h1>
          <p className="text-sm text-inkMuted">
            {step === 1
              ? authMode === "signin"
                ? "Sign in to open your Home dashboard, saved trips, permit checklists, and offline state packs."
                : "Create an account in seconds to personalize Inner Line Permit (ILP) & PAP rules across all 8 North-East states."
              : step === 2
                ? "We ask nationality and citizen category only to compute exact Inner Line Permit (ILP) and Protected Area Permit (PAP) rules for your trip."
                : "Effective 21 November 2026 • Policy Version 2026.1 • Compliant with India's Digital Personal Data Protection (DPDP) Act."}
          </p>
        </div>

        {err && (
          <div role="alert" className="p-3.5 rounded-xl bg-sunrise/10 border border-sunrise/40 text-sm text-sunrise font-medium">
            {err}
          </div>
        )}

        {/* STEP 1: AUTHENTICATION (SIGN IN | CREATE ACCOUNT) */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Segmented Mode Switcher: Sign In (Existing User) vs Create Account (New User) */}
            <div
              role="tablist"
              aria-label="Authentication mode"
              className="grid grid-cols-2 rounded-xl bg-mutedSurface p-1 border border-borderSubtle"
            >
              <button
                type="button"
                role="tab"
                aria-selected={authMode === "signin"}
                onClick={() => {
                  setAuthMode("signin");
                  setErr("");
                }}
                className={`inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold min-h-[42px] transition-all ${
                  authMode === "signin"
                    ? "bg-forest text-onPrimary shadow-sm"
                    : "text-inkMuted hover:text-ink"
                }`}
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authMode === "signup"}
                onClick={() => {
                  setAuthMode("signup");
                  setErr("");
                }}
                className={`inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold min-h-[42px] transition-all ${
                  authMode === "signup"
                    ? "bg-forest text-onPrimary shadow-sm"
                    : "text-inkMuted hover:text-ink"
                }`}
              >
                <UserPlus className="w-4 h-4" />
                Create Account
              </button>
            </div>

            {firebaseReady ? (
              <>
                <Button className="w-full" onClick={handleGoogleAuth} disabled={busy}>
                  <GoogleIcon />
                  <span>Continue with Google</span>
                </Button>

                <div className="text-center text-xs text-inkMuted uppercase tracking-wider">
                  {authMode === "signin" ? "or sign in with email" : "or sign up with email"}
                </div>

                <form onSubmit={handleEmailAuth} className="space-y-3">
                  {authMode === "signup" && (
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1" htmlFor="auth-fullname">
                        Full name
                      </label>
                      <input
                        id="auth-fullname"
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Ananya Bora or Alex Chen"
                        className="w-full rounded-xl border border-borderSubtle bg-canvas px-3.5 py-3 min-h-[48px]"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1" htmlFor="auth-email">
                      Email address
                    </label>
                    <input
                      id="auth-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-borderSubtle bg-canvas px-3.5 py-3 min-h-[48px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1" htmlFor="auth-password">
                      Password
                    </label>
                    <input
                      id="auth-password"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password (min 6 characters)"
                      className="w-full rounded-xl border border-borderSubtle bg-canvas px-3.5 py-3 min-h-[48px]"
                    />
                  </div>
                  <Button type="submit" variant="secondary" className="w-full" disabled={busy}>
                    {busy
                      ? authMode === "signin"
                        ? "Signing in..."
                        : "Creating account..."
                      : authMode === "signin"
                        ? "Sign In & Go to Home"
                        : "Create Account & Continue"}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </form>
              </>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-mutedSurface text-sm text-inkMuted">
                  Cloud sign-in keys are not configured yet. You can continue immediately using local session mode.
                </div>
                <Button className="w-full" onClick={() => handleDevDemoSignIn("traveler")} disabled={busy}>
                  <UserCheck className="w-5 h-5" />
                  Continue as Traveler ({fullName || "Demo"})
                </Button>
                <form onSubmit={handleEmailAuth} className="pt-2 border-t border-borderSubtle space-y-2">
                  <label className="block text-xs font-semibold text-inkMuted">Or continue with local email profile</label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="traveler@example.com"
                      className="flex-1 rounded-xl border border-borderSubtle bg-canvas px-3 py-2.5 min-h-[48px]"
                    />
                    <Button type="submit" variant="secondary" disabled={busy}>
                      Continue
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: TRAVELER PROFILE (FOR PERMIT RULES) */}
        {step === 2 && (
          <div className="space-y-4">
            {signedIn && !isEditMode && (
              <div className="flex items-center gap-2 text-xs font-semibold text-forest bg-forest/10 px-3 py-2 rounded-xl">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Account authenticated • Complete your traveler profile below</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold mb-1.5" htmlFor="ob-name">
                Full name
              </label>
              <input
                id="ob-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Ananya Bora or Alex Chen"
                className="w-full rounded-xl border border-borderSubtle bg-canvas px-3.5 py-3 min-h-[48px]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1.5" htmlFor="ob-dob">
                  Date of birth
                </label>
                <input
                  id="ob-dob"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full rounded-xl border border-borderSubtle bg-canvas px-3.5 py-3 min-h-[48px]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5" htmlFor="ob-lang">
                  Preferred language
                </label>
                <select
                  id="ob-lang"
                  value={lang}
                  onChange={(e) => setLang(e.target.value as LangCode)}
                  className="w-full rounded-xl border border-borderSubtle bg-canvas px-3.5 py-3 min-h-[48px]"
                >
                  <option value="en">English</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                  <option value="as">অসমীয়া (Assamese)</option>
                  <option value="bn">বাংলা (Bengali)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5" htmlFor="ob-country-search">
                Nationality (searchable)
              </label>
              <input
                id="ob-country-search"
                type="text"
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                placeholder="Filter country..."
                className="w-full rounded-xl border border-borderSubtle bg-canvas px-3.5 py-2.5 mb-2 text-sm"
              />
              <select
                aria-label="Select nationality"
                value={nationality}
                onChange={(e) => {
                  const code = e.target.value;
                  setNationality(code);
                  if (code !== "IN" && citizenType === "indian") setCitizenType("foreign");
                }}
                className="w-full rounded-xl border border-borderSubtle bg-canvas px-3.5 py-3 min-h-[48px]"
              >
                {filteredCountries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-sm font-semibold mb-2">Citizen type (for permit rules)</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: "indian", label: "Indian citizen", desc: "Applies ILP rules" },
                  { id: "oci_pio", label: "OCI / PIO card", desc: "Check PAP/RAP rules" },
                  { id: "foreign", label: "Foreign national", desc: "PAP / RAP + FRO" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCitizenType(opt.id as CitizenType)}
                    className={`rounded-xl border p-3 text-left min-h-[68px] ${
                      citizenType === opt.id
                        ? "border-forest bg-forest/10"
                        : "border-borderSubtle bg-canvas hover:bg-mutedSurface"
                    }`}
                  >
                    <p className="font-semibold text-sm">{opt.label}</p>
                    <p className="text-xs text-inkMuted">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {isUnder18 && (
              <label className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={guardianConsent}
                  onChange={(e) => setGuardianConsent(e.target.checked)}
                  className="mt-1 w-5 h-5 accent-forest"
                />
                <span className="text-sm">
                  <strong>Parent / Guardian Consent (DPDP Act):</strong> I confirm a parent or legal guardian has reviewed and consented to this traveler profile.
                </span>
              </label>
            )}

            {isEditMode ? (
              <Button
                className="w-full"
                disabled={busy}
                onClick={() => saveProfileAndFinish("/settings")}
              >
                {busy ? "Saving changes..." : "Save Profile Changes"}
              </Button>
            ) : (
              <Button
                className="w-full"
                onClick={() => {
                  if (!fullName.trim()) {
                    setErr("Please enter your full name to continue.");
                    return;
                  }
                  if (isUnder18 && !guardianConsent) {
                    setErr("Under India's DPDP Act, travelers under 18 require guardian consent.");
                    return;
                  }
                  setErr("");
                  setStep(3);
                }}
              >
                Continue to Terms &amp; Consent
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}

        {/* STEP 3: TERMS OF SERVICE & DPDP PRIVACY CONSENT */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-borderSubtle bg-canvas overflow-hidden">
              <div className="px-4 py-2.5 bg-mutedSurface border-b border-borderSubtle flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink">
                  <FileText className="w-4 h-4 text-forest" />
                  Terms of Service &amp; Privacy Notice (v2026.1)
                </span>
                <Link
                  href="/legal"
                  target="_blank"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-river hover:underline"
                >
                  Full Policy <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="p-4 max-h-48 overflow-y-auto space-y-3 text-xs text-inkMuted leading-relaxed">
                <p>
                  <strong className="text-ink">1. Advisory &amp; Permit Disclaimer:</strong> NE Mate provides curated travel guidance, transport estimates, and personalized permit checklists across the eight North-Eastern states of India. Entry permits (ILP, PAP, RAP), fees, and border-zone rules are governed solely by Government authorities; you must confirm final requirements on the official government portal prior to travel.
                </p>
                <p>
                  <strong className="text-ink">2. No Automated Filings or Bookings:</strong> NE Mate does not apply for permits, collect government fees, or book transport on your behalf. Road, landslide, weather, and rail alerts are informational and do not replace local administrative directives.
                </p>
                <p>
                  <strong className="text-ink">3. Data Processing (DPDP Act):</strong> Your name, date of birth, nationality, and citizen category are processed solely to determine permit rules, personalize trips, and manage your private Document Vault. You may access, withdraw consent, or permanently erase your account at any time in <em>Profile &amp; Settings</em>.
                </p>
                <p>
                  <strong className="text-ink">4. Optional Permissions:</strong> Device location and alert notifications are strictly opt-in and can be skipped now or revoked later without limiting core planning features.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-borderSubtle bg-surface space-y-3">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <ShieldCheck className="w-5 h-5 text-forest" />
                <span>Required Agreement</span>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  className="mt-1 w-5 h-5 accent-forest shrink-0"
                />
                <span className="text-sm leading-snug">
                  I have read and agree to the{" "}
                  <Link href="/legal#terms" target="_blank" className="font-semibold text-river underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/legal#privacy" target="_blank" className="font-semibold text-river underline">
                    Privacy Notice (DPDP Act)
                  </Link>
                  , and acknowledge that all permit requirements must be confirmed on official government portals.
                </span>
              </label>
            </div>

            <div className="p-4 rounded-xl bg-mutedSurface space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-inkMuted">
                Optional Permissions (May Be Changed Anytime)
              </p>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={locationConsent}
                  onChange={(e) => {
                    setLocationConsent(e.target.checked);
                    if (e.target.checked) setLocationSkipped(false);
                  }}
                  className="mt-1 w-5 h-5 accent-forest shrink-0"
                />
                <span className="text-sm">
                  <strong>Location Access (Optional):</strong> Enable nearby destination discovery and SOS live-location sharing.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifConsent}
                  onChange={(e) => setNotifConsent(e.target.checked)}
                  className="mt-1 w-5 h-5 accent-forest shrink-0"
                />
                <span className="text-sm">
                  <strong>Safety &amp; Permit Alerts (Optional):</strong> Receive landslide, road closure, weather, and permit expiry reminders.
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button variant="secondary" type="button" onClick={requestLocation}>
                  <MapPin className="w-4 h-4 text-river" />
                  {locationConsent ? "Location Enabled" : "Allow Location"}
                </Button>
                {!locationConsent && (
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => {
                      setLocationConsent(false);
                      setLocationSkipped(true);
                    }}
                  >
                    {locationSkipped ? "Location Skipped" : "Skip for now"}
                  </Button>
                )}
              </div>
            </div>

            <Button
              className="w-full"
              disabled={busy || !privacyAccepted}
              onClick={() => saveProfileAndFinish("/")}
            >
              {busy ? "Recording consent & opening Home..." : "Accept & Open Home"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <OnboardingFlowInner />
    </Suspense>
  );
}
