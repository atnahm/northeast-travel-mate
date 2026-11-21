"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ExternalLink, FileText, MapPin, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Primitives";
import type { CitizenType, LangCode } from "@ne-mate/shared";

export const COUNTRIES = [
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

export interface TravelerProfileStepProps {
  signedIn: boolean;
  isEditMode: boolean;
  fullName: string;
  setFullName: (v: string) => void;
  dob: string;
  setDob: (v: string) => void;
  lang: LangCode;
  setLang: (v: LangCode) => void;
  countrySearch: string;
  setCountrySearch: (v: string) => void;
  nationality: string;
  setNationality: (v: string) => void;
  citizenType: CitizenType;
  setCitizenType: (v: CitizenType) => void;
  filteredCountries: Array<{ code: string; name: string }>;
  isUnder18: boolean;
  guardianConsent: boolean;
  setGuardianConsent: (v: boolean) => void;
  busy: boolean;
  onSaveEdit: () => void;
  onContinueToConsent: () => void;
}

export function TravelerProfileStep({
  signedIn,
  isEditMode,
  fullName,
  setFullName,
  dob,
  setDob,
  lang,
  setLang,
  countrySearch,
  setCountrySearch,
  nationality,
  setNationality,
  citizenType,
  setCitizenType,
  filteredCountries,
  isUnder18,
  guardianConsent,
  setGuardianConsent,
  busy,
  onSaveEdit,
  onContinueToConsent,
}: TravelerProfileStepProps) {
  return (
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
        <Button className="w-full" disabled={busy} onClick={onSaveEdit}>
          {busy ? "Saving changes..." : "Save Profile Changes"}
        </Button>
      ) : (
        <Button className="w-full" onClick={onContinueToConsent}>
          Continue to Terms &amp; Consent
          <ArrowRight className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}

export interface ConsentTermsStepProps {
  privacyAccepted: boolean;
  setPrivacyAccepted: (v: boolean) => void;
  locationConsent: boolean;
  setLocationConsent: (v: boolean) => void;
  notifConsent: boolean;
  setNotifConsent: (v: boolean) => void;
  locationSkipped: boolean;
  setLocationSkipped: (v: boolean) => void;
  onRequestLocation: () => void;
  busy: boolean;
  onFinish: () => void;
}

export function ConsentTermsStep({
  privacyAccepted,
  setPrivacyAccepted,
  locationConsent,
  setLocationConsent,
  notifConsent,
  setNotifConsent,
  locationSkipped,
  setLocationSkipped,
  onRequestLocation,
  busy,
  onFinish,
}: ConsentTermsStepProps) {
  return (
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
          <Button variant="secondary" type="button" onClick={onRequestLocation}>
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

      <Button className="w-full" disabled={busy || !privacyAccepted} onClick={onFinish}>
        {busy ? "Recording consent & opening Home..." : "Accept & Open Home"}
      </Button>
    </div>
  );
}
