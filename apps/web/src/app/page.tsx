"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, ErrorState, Skeleton, StatusBadge } from "@/components/ui/Primitives";
import { useAppStore } from "@/lib/store/app-store";
import { t } from "@/lib/i18n/translations";
import {
  formatCitizenProfileLabel,
  getPlaceEditorialMeta,
  getPlacePermitSummary,
  STATE_FULL_NAMES,
} from "@/lib/places/place-media";
import { apiFetch } from "@ne-mate/shared/api-client";
import type { AlertItem, Place, Trip } from "@ne-mate/shared";

const STATE_PERMIT_OVERVIEW = [
  { code: "AS", name: "Assam", ruleIndian: "Open entry", ruleForeign: "Open entry (park entry for Kaziranga)", requiresPermitIndian: false },
  { code: "ML", name: "Meghalaya", ruleIndian: "Open entry", ruleForeign: "Open entry", requiresPermitIndian: false },
  { code: "TR", name: "Tripura", ruleIndian: "Open entry", ruleForeign: "Open entry", requiresPermitIndian: false },
  { code: "AR", name: "Arunachal Pradesh", ruleIndian: "ILP required before Bhalukpong / Naharlagun", ruleForeign: "PAP required", requiresPermitIndian: true },
  { code: "NL", name: "Nagaland", ruleIndian: "ILP required beyond Dimapur checkgate", ruleForeign: "Online registration required", requiresPermitIndian: true },
  { code: "MZ", name: "Mizoram", ruleIndian: "ILP required at Lengpui / Vairengte / Sairang", ruleForeign: "Registration required", requiresPermitIndian: true },
  { code: "MN", name: "Manipur", ruleIndian: "ILP required at Imphal / Mao Gate", ruleForeign: "Registration required", requiresPermitIndian: true },
  { code: "SK", name: "Sikkim", ruleIndian: "Gangtok open · Permit for Tsomgo, Nathula & North Sikkim", ruleForeign: "RAP required at Rangpo / Melli", requiresPermitIndian: true },
] as const;

export default function HomePage() {
  const lang = useAppStore((s) => s.lang);
  const profile = useAppStore((s) => s.profile);
  const lowDataMode = useAppStore((s) => s.lowDataMode);

  const placesQ = useQuery({
    queryKey: ["home-featured", lang],
    queryFn: () => apiFetch<{ items: Place[] }>(`/api/v1/places/search?featured=true&lang=${lang}`),
  });

  const alertsQ = useQuery({
    queryKey: ["home-alerts", lang],
    queryFn: () => apiFetch<{ items: AlertItem[] }>(`/api/v1/alerts?lang=${lang}`),
  });

  const tripsQ = useQuery({
    queryKey: ["home-trips"],
    queryFn: () => apiFetch<{ items: Trip[] }>("/api/v1/trips"),
    retry: false,
  });

  const activeTrip = tripsQ.data?.items?.[0];
  const topAlert = alertsQ.data?.items?.[0];
  const firstName = profile?.full_name ? profile.full_name.trim().split(/\s+/)[0] : "";
  const citizenLabel = formatCitizenProfileLabel(profile?.citizen_type, profile?.nationality_code);
  const isForeign = profile?.citizen_type === "foreign" || profile?.citizen_type === "oci_pio";

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Editorial Masthead Banner */}
        <section
          style={{ backgroundColor: "#1F5E4B", color: "#FFFFFF" }}
          className="rounded-card overflow-hidden border border-borderSubtle bg-forest text-white p-6 md:p-8 shadow-soft"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
            <div className="space-y-2.5">
              <p style={{ color: "#E7C275" }} className="text-xs font-semibold uppercase tracking-wider">
                {t(lang, "tagline")}
              </p>
              <h1 style={{ color: "#FFFFFF" }} className="font-display text-2xl md:text-4xl font-semibold tracking-tight leading-tight">
                {firstName ? `Good day, ${firstName}` : t(lang, "welcomeBanner")}
              </h1>
              <p style={{ color: "rgba(255,255,255,0.92)" }} className="text-sm md:text-base max-w-2xl leading-relaxed">
                Entry rules, railheads, and mountain transit advisories configured for{" "}
                <strong style={{ color: "#FFFFFF" }} className="font-semibold">{citizenLabel}</strong>.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5 shrink-0">
              <Link
                href="/travel"
                style={{ backgroundColor: "#FFFFFF", color: "#183D32" }}
                className="inline-flex items-center rounded-xl px-4 py-2.5 min-h-[44px] text-sm font-semibold shadow-sm hover:opacity-95 transition-opacity"
              >
                Trains and Road Routes
              </Link>
              <Link
                href="/onboarding?mode=edit"
                style={{ backgroundColor: "#14382C", color: "#FFFFFF", borderColor: "rgba(255,255,255,0.45)" }}
                className="inline-flex items-center rounded-xl border px-4 py-2.5 min-h-[44px] text-sm font-semibold hover:opacity-95 transition-opacity"
              >
                Traveler Profile
              </Link>
            </div>
          </div>
        </section>

        {/* Active Road & Weather Advisory Strip */}
        {topAlert && (
          <Link href="/safety" className="block">
            <Card className="p-4 border-[#E5B8A8] dark:border-[#703122] bg-[#FFF6F2] dark:bg-[#2B1610] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:opacity-95 transition-opacity">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-[#9E2A0E] dark:text-[#FFC4B2] shrink-0 mt-0.5" strokeWidth={1.8} />
                <div className="space-y-0.5">
                  <p className="font-semibold text-sm text-ink">
                    {STATE_FULL_NAMES[topAlert.state_code] || topAlert.state_code} Highway Advisory: {topAlert.title}
                  </p>
                  <p className="text-xs text-inkMuted line-clamp-2">{topAlert.body}</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-[#9E2A0E] dark:text-[#FFC4B2] underline underline-offset-4 whitespace-nowrap">
                Read full advisory
              </span>
            </Card>
          </Link>
        )}

        {/* Active Itinerary (when a trip exists) */}
        {activeTrip && (
          <section className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xl font-semibold tracking-tight">{t(lang, "continueTrip")}</h2>
              <Link href="/trips" className="text-xs font-semibold text-river underline underline-offset-4">
                All saved itineraries
              </Link>
            </div>
            <Link href={`/trips/${activeTrip.id}`}>
              <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-forest transition-colors">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge kind="approved" label={activeTrip.status} />
                    <span className="text-xs text-inkMuted">
                      {activeTrip.start_date} to {activeTrip.end_date}
                    </span>
                  </div>
                  <h3 className="font-display text-xl font-semibold">{activeTrip.title}</h3>
                  <p className="text-sm text-inkMuted">
                    Departing {activeTrip.origin_text} · Party of {activeTrip.party_size} · Planned budget ₹{activeTrip.budget_inr.toLocaleString("en-IN")}
                  </p>
                </div>
                <span className="text-sm font-semibold text-forest underline underline-offset-4 whitespace-nowrap">
                  Open day-by-day log
                </span>
              </Card>
            </Link>
          </section>
        )}

        {/* 8-State Entry & Permit Readiness Desk (Replaces duplicated sidebar nav tiles) */}
        <section aria-labelledby="readiness-heading" className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
            <div>
              <h2 id="readiness-heading" className="font-display text-xl font-semibold tracking-tight">
                {t(lang, "quickActions")}
              </h2>
              <p className="text-xs text-inkMuted">
                Current entry requirements across all eight states for {citizenLabel}. Select a state to open its official portal checklist.
              </p>
            </div>
            <Link href="/permits" className="text-xs font-semibold text-river underline underline-offset-4">
              Open Permit Wizard
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {STATE_PERMIT_OVERVIEW.map((st) => {
              const needsPermit = isForeign ? st.code !== "AS" && st.code !== "ML" && st.code !== "TR" : st.requiresPermitIndian;
              const ruleText = isForeign ? st.ruleForeign : st.ruleIndian;
              return (
                <Link key={st.code} href={`/permits?state=${st.code}`}>
                  <Card className="p-3.5 h-full hover:border-forest transition-colors flex flex-col justify-between gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-display font-semibold text-base text-ink">{st.name}</p>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                          needsPermit
                            ? "bg-statusCheckBg text-statusCheckFg border border-sunrise/30"
                            : "bg-statusApprovedBg text-statusApprovedFg"
                        }`}
                      >
                        {needsPermit ? "Permit" : "Open"}
                      </span>
                    </div>
                    <p className="text-xs text-inkMuted leading-relaxed">{ruleText}</p>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Seasonal Field Guide with Regional Photography & Context-Aware Permit Labels */}
        <section aria-labelledby="best-heading" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
            <div>
              <h2 id="best-heading" className="font-display text-xl md:text-2xl font-semibold tracking-tight">
                {t(lang, "bestThisMonth")}
              </h2>
              <p className="text-xs text-inkMuted">
                Practical transit notes, range timings, and entry rules for current dry-season routes.
              </p>
            </div>
            <Link href="/explore" className="text-xs font-semibold text-river underline underline-offset-4">
              Browse full 8-state directory
            </Link>
          </div>

          {placesQ.isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <Skeleton className="h-72" />
              <Skeleton className="h-72" />
              <Skeleton className="h-72" />
            </div>
          )}

          {placesQ.isError && (
            <ErrorState message={(placesQ.error as Error).message} onRetry={() => placesQ.refetch()} />
          )}

          {placesQ.data && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {placesQ.data.items.slice(0, 6).map((pl) => {
                const media = getPlaceEditorialMeta(pl.id, pl.state_code, pl.curated_notes);
                const permitInfo = getPlacePermitSummary(
                  pl.state_code,
                  pl.permit_area_id,
                  profile?.citizen_type || "indian"
                );
                const stateFullName = STATE_FULL_NAMES[pl.state_code] || pl.state_code;

                return (
                  <Link key={pl.id} href={`/explore/${pl.id}`} className="group block h-full">
                    <Card className="overflow-hidden h-full flex flex-col justify-between hover:border-forest transition-colors">
                      <div>
                        {/* Regional Photograph Header (respects Low-Data Mode) */}
                        {!lowDataMode && (
                          <div className="relative h-44 w-full overflow-hidden bg-mutedSurface">
                            <img
                              src={media.imageUrl}
                              alt={media.imageCaption}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
                            <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                              <span
                                style={{ backgroundColor: "rgba(17, 23, 21, 0.85)", color: "#FFFFFF" }}
                                className="text-xs font-semibold px-2.5 py-1 rounded-md shadow-sm"
                              >
                                {stateFullName}
                              </span>
                              <span
                                style={
                                  permitInfo.required
                                    ? { backgroundColor: "#FFEDD5", color: "#7C2D12", borderColor: "#F97316" }
                                    : { backgroundColor: "#DCFCE7", color: "#14532D", borderColor: "#16A34A" }
                                }
                                className="text-[11px] font-semibold px-2.5 py-1 rounded-md border shadow-sm"
                              >
                                {permitInfo.badgeLabel}
                              </span>
                            </div>
                            <p className="absolute bottom-2.5 left-3 right-3 text-[11px] text-white/90 font-medium truncate">
                              {media.elevationOrTransit}
                            </p>
                          </div>
                        )}

                        <div className="p-4 space-y-2">
                          {lowDataMode && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-forest">{stateFullName}</span>
                              <span className="text-xs font-medium text-inkMuted">{permitInfo.badgeLabel}</span>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-1.5">
                            {pl.categories.slice(0, 2).map((cat) => (
                              <span
                                key={cat}
                                className="text-[11px] font-medium capitalize px-2 py-0.5 rounded bg-mutedSurface text-inkMuted"
                              >
                                {cat}
                              </span>
                            ))}
                          </div>

                          <h3 className="font-display text-lg font-semibold leading-snug text-ink group-hover:text-forest transition-colors">
                            {pl.name}
                          </h3>
                          <p className="text-sm text-inkMuted leading-relaxed">
                            {media.fieldNote || pl.curated_notes}
                          </p>
                        </div>
                      </div>

                      <div className="px-4 py-3 border-t border-borderSubtle bg-canvas/50 flex items-center justify-between text-xs">
                        <span className="font-semibold text-river group-hover:underline underline-offset-4">
                          {permitInfo.ctaLabel}
                        </span>
                        <span className="text-inkMuted">{stateFullName}</span>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
