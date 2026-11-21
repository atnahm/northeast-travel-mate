"use client";

import React from "react";
import { ArrowRight, ExternalLink, Plus, Radio } from "lucide-react";
import { Button, Card, StatusBadge } from "@/components/ui/Primitives";
import { useAppStore } from "@/lib/store/app-store";
import { t } from "@/lib/i18n/translations";
import {
  formatDuration,
  formatIstHHMM,
  formatShortDate,
  weekdayFromIsoDate,
} from "@/lib/trains/local-data";
import type { TrainSummary, WeekdayCode } from "@ne-mate/shared";

const ALL_DAYS: WeekdayCode[] = ["M", "T", "W", "Th", "F", "Sa", "Su"];

interface TrainResultCardProps {
  train: TrainSummary;
  journeyDate: string;
  selected: boolean;
  onOpenDetails: () => void;
  onOpenLiveStatus: () => void;
  onAddToTrip: () => void;
}

export function TrainResultCard({
  train,
  journeyDate,
  selected,
  onOpenDetails,
  onOpenLiveStatus,
  onAddToTrip,
}: TrainResultCardProps) {
  const lang = useAppStore((s) => s.lang);
  const selectedDay = weekdayFromIsoDate(journeyDate);
  const shortDate = formatShortDate(journeyDate);
  const doesNotRun = train.runsOnSelectedDate === false;

  const sourceLine =
    train.source === "live"
      ? t(lang, "liveDataUpdated", { time: formatIstHHMM(train.fetchedAt) })
      : train.source === "cached"
      ? t(lang, "cachedDataUpdated", { time: formatIstHHMM(train.fetchedAt) })
      : t(lang, "scheduledFallbackLabel", { date: train.fetchedAt?.slice(0, 10) || "unverified" });

  return (
    <Card
      className={`p-4 space-y-3.5 transition-colors ${
        selected ? "border-forest ring-2 ring-forest/25" : "hover:border-forest/60"
      } ${doesNotRun ? "opacity-65" : ""}`}
    >
      {/* Header: Name, number, type badge */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold text-forest">{train.trainNo}</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teaGold text-onGold">
              {train.type}
            </span>
          </div>
          <h3 className="text-base font-bold text-ink mt-1 leading-snug">{train.name}</h3>
        </div>

        <StatusBadge
          kind={train.source === "scheduled_fallback" ? "needs_check" : "verified"}
          label={sourceLine}
        />
      </div>

      {/* Departure -> Duration -> Arrival (IST) */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl bg-mutedSurface/60 p-3">
        <div>
          <p className="text-xl font-bold text-ink leading-tight">{formatIstHHMM(train.departure)}</p>
          <p className="text-xs font-semibold text-inkMuted">{train.fromCode} · IST</p>
        </div>

        <div className="text-center px-2">
          <p className="text-xs font-semibold text-inkMuted">{formatDuration(train.durationMin)}</p>
          <div className="flex items-center justify-center gap-1 text-forest mt-0.5">
            <span className="h-0.5 w-8 bg-borderSubtle inline-block" />
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </div>
        </div>

        <div className="text-end">
          <p className="text-xl font-bold text-ink leading-tight">
            {formatIstHHMM(train.arrival)}
            {train.arrivalDayOffset > 0 && (
              <span className="ms-1.5 text-xs font-bold text-river align-super">
                +{train.arrivalDayOffset} {train.arrivalDayOffset === 1 ? "day" : "days"}
              </span>
            )}
          </p>
          <p className="text-xs font-semibold text-inkMuted">{train.toCode} · IST</p>
        </div>
      </div>

      {/* Running days 7 pills + clear runs/does-not-run line */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1" aria-label="Running days">
          {ALL_DAYS.map((d) => {
            const runs = train.runsOn.includes(d);
            const isSelectedDay = d === selectedDay;
            return (
              <span
                key={d}
                className={`inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded-full text-xs font-semibold border ${
                  runs && isSelectedDay
                    ? "bg-forest text-onPrimary border-forest"
                    : runs
                    ? "bg-statusApprovedBg text-statusApprovedFg border-forest/40"
                    : "bg-canvas text-inkMuted border-borderSubtle line-through opacity-50"
                }`}
              >
                {d}
              </span>
            );
          })}
        </div>

        {train.runsOnSelectedDate !== null && (
          <p className={`text-xs font-semibold ${doesNotRun ? "text-statusRejectedFg" : "text-statusApprovedFg"}`}>
            {doesNotRun
              ? t(lang, "doesNotRunOnDate", { date: shortDate })
              : t(lang, "runsOnDate", { date: shortDate })}
          </p>
        )}
      </div>

      {/* Class chips (plain info only, no availability) */}
      {train.classes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {train.classes.map((cls) => (
            <span
              key={cls}
              className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-canvas border border-borderSubtle text-inkMuted"
            >
              {cls}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="pt-2 border-t border-borderSubtle space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onOpenDetails} className="text-sm px-3.5">
            {t(lang, "detailsAction")}
          </Button>
          <Button variant="secondary" onClick={onOpenLiveStatus} className="text-sm px-3.5">
            <Radio className="w-4 h-4 text-river" />
            {t(lang, "liveStatusAction")}
          </Button>
          <Button variant="ghost" onClick={onAddToTrip} className="text-sm px-3">
            <Plus className="w-4 h-4 text-forest" />
            {t(lang, "addToTrip")}
          </Button>
          <a
            href="https://www.irctc.co.in/nget/train-search"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-river/50 bg-statusVerifiedBg text-statusVerifiedFg px-3.5 py-2.5 min-h-[48px] text-sm font-semibold hover:opacity-90"
          >
            <span>{t(lang, "bookOnIrctc")}</span>
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        </div>
        <p className="text-[11px] text-inkMuted">{t(lang, "irctcExternalNote")}</p>
      </div>
    </Card>
  );
}
