"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Scale, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Primitives";

export default function LegalPage() {
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-inkMuted hover:text-ink min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Onboarding
          </Link>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-statusVerifiedBg text-statusVerifiedFg border border-river">
            Policy v2026.1 • Effective 21 Nov 2026
          </span>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-ink">Terms of Service &amp; Privacy Notice</h1>
          <p className="text-sm text-inkMuted">
            Governing access to NE Mate (North-East India Travel Companion) across Arunachal Pradesh, Assam, Manipur, Meghalaya, Mizoram, Nagaland, Sikkim, and Tripura.
          </p>
        </div>

        {/* Terms of Service */}
        <Card id="terms" className="p-6 space-y-5 scroll-mt-24">
          <div className="flex items-center gap-2.5 border-b border-borderSubtle pb-3">
            <Scale className="w-5 h-5 text-forest" />
            <h2 className="text-xl font-bold">1. Terms of Service</h2>
          </div>

          <section className="space-y-2 text-sm leading-relaxed">
            <h3 className="font-bold text-base">1.1 Nature of Service &amp; Advisory Scope</h3>
            <p className="text-inkMuted">
              NE Mate is an informational travel planning and navigation companion. It provides curated destination guides, estimated multi-modal transport comparisons, offline reference packs, and personalized Inner Line Permit (ILP), Protected Area Permit (PAP), and Restricted Area Permit (RAP) checklists.
            </p>
          </section>

          <section className="space-y-2 text-sm leading-relaxed">
            <h3 className="font-bold text-base">1.2 Official Permit &amp; Regulatory Verification</h3>
            <p className="text-inkMuted">
              Entry permits, border-zone rules, fees, and checkpoint procedures are determined solely by the Government of India and the respective State Governments. While curated entries display a &ldquo;Last verified&rdquo; date, regulations may change without notice. You agree to confirm all requirements, eligibility, and fees directly on the linked official government portal before traveling.
            </p>
          </section>

          <section className="space-y-2 text-sm leading-relaxed">
            <h3 className="font-bold text-base">1.3 No Automated Filings, Bookings, or Guarantees</h3>
            <p className="text-inkMuted">
              NE Mate does not submit permit applications, process government payments, or issue travel tickets on your behalf. Road, landslide, weather, and railway status feeds are provided on an &ldquo;as-available&rdquo; basis for situational awareness and do not substitute for instructions from local administration, police, or transport authorities.
            </p>
          </section>

          <section className="space-y-2 text-sm leading-relaxed">
            <h3 className="font-bold text-base">1.4 Emergency &amp; Safety Tools</h3>
            <p className="text-inkMuted">
              Emergency helpline shortcuts (including 112), nearby medical/police lookup, check-in timers, and location sharing depend on device hardware, cellular coverage, and third-party telecom networks. Never rely solely on a web application in life-threatening situations.
            </p>
          </section>

          <section className="space-y-2 text-sm leading-relaxed">
            <h3 className="font-bold text-base">1.5 Responsible Travel &amp; Acceptable Use</h3>
            <p className="text-inkMuted">
              You agree to respect local communities, restricted zones, wildlife sanctuary rules, and plastic-free ecological guidelines throughout North-East India, and not to misuse, scrape, or attempt unauthorized access to platform services or other travelers&apos; accounts.
            </p>
          </section>
        </Card>

        {/* Privacy Notice */}
        <Card id="privacy" className="p-6 space-y-5 scroll-mt-24">
          <div className="flex items-center gap-2.5 border-b border-borderSubtle pb-3">
            <ShieldCheck className="w-5 h-5 text-river" />
            <h2 className="text-xl font-bold">2. Privacy Notice (India DPDP Act Compliance)</h2>
          </div>

          <section className="space-y-2 text-sm leading-relaxed">
            <h3 className="font-bold text-base">2.1 Personal Data Collected &amp; Purpose Limitation</h3>
            <ul className="list-disc pl-5 text-inkMuted space-y-1">
              <li><strong>Account &amp; Profile Details</strong> (name, email, date of birth, nationality, citizen type, preferred language): Used strictly to compute accurate permit checklists, personalize trip itineraries, and localize the interface.</li>
              <li><strong>Traveler Content</strong> (trips, saved places, expense logs, chat threads, uploaded Document Vault files): Stored privately for your account and shared only with co-travelers you explicitly invite.</li>
              <li><strong>Optional Location &amp; Notifications</strong>: Collected only when you grant explicit opt-in consent. Precise coordinates and uploaded ID documents are never logged in plain server logs.</li>
            </ul>
          </section>

          <section className="space-y-2 text-sm leading-relaxed">
            <h3 className="font-bold text-base">2.2 Children&apos;s Personal Data (Under 18)</h3>
            <p className="text-inkMuted">
              In accordance with India&apos;s Digital Personal Data Protection (DPDP) Act, travelers under 18 years of age require explicit parent or legal guardian consent prior to creating a traveler profile.
            </p>
          </section>

          <section className="space-y-2 text-sm leading-relaxed">
            <h3 className="font-bold text-base">2.3 Consent Records, Retention &amp; Your Rights</h3>
            <p className="text-inkMuted">
              Every consent grant or withdrawal is recorded with policy version and timestamp. You may review your profile, modify optional permissions, export your trips, or permanently erase your account and all associated data at any time from <strong>Profile &amp; Settings → Delete My Account</strong>.
            </p>
          </section>

          <div className="p-3.5 rounded-xl bg-mutedSurface text-xs text-inkMuted flex items-start gap-2">
            <FileText className="w-4 h-4 text-forest shrink-0 mt-0.5" />
            <span>
              Offline map geometry is provided with attribution to OpenStreetMap contributors; online interactive maps are governed by the applicable mapping provider terms.
            </span>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
