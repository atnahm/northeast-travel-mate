"use client";

import React from "react";
import Link from "next/link";
import { Bus, Car, FileCheck2, MapPin, Ship } from "lucide-react";
import { Card, StatusBadge } from "@/components/ui/Primitives";
import { useAppStore } from "@/lib/store/app-store";
import { t } from "@/lib/i18n/translations";
import { formatDuration } from "@/lib/trains/local-data";
import type { PermitHint, RailheadDestination, RailheadOption } from "@ne-mate/shared";

interface LastMileBridgeCardProps {
  destination: RailheadDestination;
  railhead: RailheadOption;
  sameRailhead?: boolean;
  permitHint?: PermitHint | null;
}

const MODE_LABEL: Record<string, { label: string; icon: React.ReactNode }> = {
  shared_sumo: { label: "Shared Sumo / Cruiser", icon: <Car className="w-4 h-4 text-forest" /> },
  self_drive: { label: "Private cab / self-drive", icon: <Car className="w-4 h-4 text-river" /> },
  bus: { label: "State / regional bus", icon: <Bus className="w-4 h-4 text-forest" /> },
  ferry: { label: "Brahmaputra IWT ferry", icon: <Ship className="w-4 h-4 text-river" /> },
};

export function LastMileBridgeCard({
  destination,
  railhead,
  sameRailhead = false,
  permitHint,
}: LastMileBridgeCardProps) {
  const lang = useAppStore((s) => s.lang);
  const verifiedDate = railhead.road?.lastVerifiedAt || "unverified";

  return (
    <Card className="p-4 md:p-5 border-forest/40 bg-forest/5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-forest flex items-center gap-1.5">
            <MapPin className="w-4 h-4" aria-hidden="true" />
            {sameRailhead ? t(lang, "sameRailheadTitle") : t(lang, "lastMileTitle")}
          </p>
          <h3 className="text-base font-bold text-ink">
            {railhead.name} ({railhead.code}) → {destination.name}
          </h3>
        </div>
        <StatusBadge
          kind={railhead.road?.lastVerifiedAt ? "verified" : "needs_check"}
          label={t(lang, "approxVerifiedLabel", { date: verifiedDate })}
        />
      </div>

      {/* Approximate distance & drive time */}
      <div className="flex flex-wrap gap-4 text-sm">
        {railhead.roadKm != null && railhead.roadKm > 0 && (
          <span>
            Distance: <strong>~{railhead.roadKm} km</strong>
          </span>
        )}
        {railhead.driveMinutes != null && railhead.driveMinutes > 0 && (
          <span>
            Drive time: <strong>~{formatDuration(railhead.driveMinutes)}</strong>
          </span>
        )}
      </div>

      {/* Mode chips */}
      {railhead.modes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {railhead.modes.map((m) => {
            const cfg = MODE_LABEL[m] || { label: m, icon: <Car className="w-4 h-4" /> };
            return (
              <span
                key={m}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface border border-borderSubtle px-3 py-1.5 text-xs font-semibold text-ink"
              >
                {cfg.icon}
                {cfg.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Additional ferry / connecting legs (e.g. Majuli) */}
      {destination.legs && destination.legs.length > 0 && (
        <div className="text-xs text-inkMuted space-y-1">
          {destination.legs.map((leg) => (
            <p key={leg.label}>
              + <strong>{leg.mode.toUpperCase()}</strong>: {leg.label}
              {leg.typicalMinutes ? ` (~${leg.typicalMinutes} min approximate)` : ""}
            </p>
          ))}
        </div>
      )}

      {/* Permit Hint — ONLY shown when verified permits database has a required entry */}
      {permitHint?.mayRequirePermit && (
        <div className="pt-2 border-t border-borderSubtle flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-statusCheckFg">
            <FileCheck2 className="w-4 h-4 text-sunrise shrink-0" aria-hidden="true" />
            {t(lang, "permitMayBeRequired")}
          </span>
          <Link
            href={permitHint.permitsPath}
            className="text-xs font-bold text-river hover:underline min-h-[36px] inline-flex items-center"
          >
            {t(lang, "checkPermitsLink")} →
          </Link>
        </div>
      )}
    </Card>
  );
}
