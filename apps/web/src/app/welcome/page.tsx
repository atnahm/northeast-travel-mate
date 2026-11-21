"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Globe2, Mountain, ShieldCheck } from "lucide-react";
import { Card, Button } from "@/components/ui/Primitives";
import { LANGUAGE_OPTIONS } from "@/lib/i18n/translations";
import { useAppStore } from "@/lib/store/app-store";
import type { LangCode } from "@ne-mate/shared";

export default function WelcomeSplashPage() {
  const router = useRouter();
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);

  const choose = (code: LangCode) => {
    setLang(code);
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-between p-5 md:p-10 max-w-2xl mx-auto">
      <div className="h-2 w-full rounded-full woven-strip" aria-hidden="true" />

      <div className="my-auto py-8 space-y-6">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="NorthEast TravelMate" className="w-16 h-16 rounded-2xl shadow-sm object-contain bg-white" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-forest">NE Mate</h1>
            <p className="text-sm text-inkMuted">North-East India Travel Companion • v1.0</p>
          </div>
        </div>

        <Card className="p-5 bg-forest text-white border-none">
          <div className="flex items-start gap-3">
            <Mountain className="w-6 h-6 text-teaGold shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-lg">Choose your preferred language</p>
              <p className="text-sm text-white/85">
                Eight states — Arunachal Pradesh, Assam, Manipur, Meghalaya, Mizoram, Nagaland, Sikkim & Tripura. Works offline in hills and valleys.
              </p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="App language">
          {LANGUAGE_OPTIONS.map((opt) => {
            const active = lang === opt.code;
            return (
              <button
                key={opt.code}
                type="button"
                onClick={() => choose(opt.code)}
                className={`text-left rounded-card p-4 min-h-[76px] border-2 transition-all ${
                  active
                    ? "border-forest bg-forest/10 shadow-sm"
                    : "border-borderSubtle bg-surface hover:bg-mutedSurface"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold text-ink">{opt.nativeLabel}</span>
                  <span className="text-xs font-semibold uppercase tracking-wide text-inkMuted">{opt.englishLabel}</span>
                </div>
                <p className="text-xs text-inkMuted mt-1">{opt.hint}</p>
              </button>
            );
          })}
        </div>

        <Link
          href="/phrasebook"
          className="flex items-center justify-between rounded-card p-4 bg-surface border border-borderSubtle hover:bg-mutedSurface transition-colors min-h-[56px]"
        >
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-river" />
            <div>
              <p className="font-semibold text-sm">More regional languages & phrasebook</p>
              <p className="text-xs text-inkMuted">Mizo, Nagamese, Nepali, Assamese & Bengali travel phrases</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-inkMuted" />
        </Link>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button className="flex-1" onClick={() => router.push("/onboarding?tab=signin")}>
            <Globe2 className="w-5 h-5" />
            Sign In (Existing User)
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => router.push("/onboarding?tab=signup")}>
            Create New Account
          </Button>
        </div>
      </div>

      <p className="text-xs text-inkMuted text-center flex items-center justify-center gap-1.5 pb-2">
        <ShieldCheck className="w-4 h-4 text-forest" />
        Location is always opt-in. Verified permit records cite official government portals.
      </p>
    </div>
  );
}
