"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Globe2, LogIn, UserCheck, UserPlus } from "lucide-react";
import { Button, Card } from "@/components/ui/Primitives";
import {
  ConsentTermsStep,
  COUNTRIES,
  TravelerProfileStep,
} from "@/components/onboarding/OnboardingSteps";
import { useAppStore } from "@/lib/store/app-store";
import {
  ensureFirebaseRuntimeConfig,
  isFirebaseWebConfigured,
  loginWithEmailFirebase,
  registerWithEmailFirebase,
  signInWithGoogleFirebase,
} from "@/lib/firebase/client";
import { apiFetch } from "@ne-mate/shared/api-client";
import type { CitizenType, LangCode, UserProfile } from "@ne-mate/shared";

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
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04-2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
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

  const [firebaseReady, setFirebaseReady] = useState<boolean>(isFirebaseWebConfigured());

  useEffect(() => {
    if (!firebaseReady) {
      ensureFirebaseRuntimeConfig().then((ready) => {
        if (ready) setFirebaseReady(true);
      });
    }
  }, [firebaseReady]);

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
        const authRes =
          authMode === "signin"
            ? await loginWithEmailFirebase(email, password)
            : await registerWithEmailFirebase(email, password, fullName.trim());
        const session = await establishCookieSession(authRes.idToken);
        handlePostAuthTransition(session, fullName.trim() || authRes.displayName, authRes.email);
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

  const handleDevDemoSignIn = async () => {
    setErr("");
    setBusy(true);
    try {
      const session = await establishCookieSession("poc:demo_traveler:demo_traveler%40nemate.in:Demo%20Traveler");
      handlePostAuthTransition(session, "Demo Traveler");
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

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => (isEditMode ? router.push("/settings") : setStep((s) => (s - 1) as 1 | 2))}
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

        {step === 1 && (
          <div className="space-y-4">
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
                  authMode === "signin" ? "bg-forest text-onPrimary shadow-sm" : "text-inkMuted hover:text-ink"
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
                  authMode === "signup" ? "bg-forest text-onPrimary shadow-sm" : "text-inkMuted hover:text-ink"
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
                <Button className="w-full" onClick={handleDevDemoSignIn} disabled={busy}>
                  <UserCheck className="w-5 h-5" />
                  Continue as Traveler ({fullName || "Demo"})
                </Button>
                <form onSubmit={handleEmailAuth} className="pt-2 border-t border-borderSubtle space-y-2">
                  <label htmlFor="local-auth-email" className="block text-xs font-semibold text-inkMuted">
                    Or continue with local email profile
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="local-auth-email"
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

        {step === 2 && (
          <TravelerProfileStep
            signedIn={signedIn}
            isEditMode={isEditMode}
            fullName={fullName}
            setFullName={setFullName}
            dob={dob}
            setDob={setDob}
            lang={lang}
            setLang={setLang}
            countrySearch={countrySearch}
            setCountrySearch={setCountrySearch}
            nationality={nationality}
            setNationality={setNationality}
            citizenType={citizenType}
            setCitizenType={setCitizenType}
            filteredCountries={filteredCountries}
            isUnder18={isUnder18}
            guardianConsent={guardianConsent}
            setGuardianConsent={setGuardianConsent}
            busy={busy}
            onSaveEdit={() => saveProfileAndFinish("/settings")}
            onContinueToConsent={() => {
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
          />
        )}

        {step === 3 && (
          <ConsentTermsStep
            privacyAccepted={privacyAccepted}
            setPrivacyAccepted={setPrivacyAccepted}
            locationConsent={locationConsent}
            setLocationConsent={setLocationConsent}
            notifConsent={notifConsent}
            setNotifConsent={setNotifConsent}
            locationSkipped={locationSkipped}
            setLocationSkipped={setLocationSkipped}
            onRequestLocation={requestLocation}
            busy={busy}
            onFinish={() => saveProfileAndFinish("/")}
          />
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
