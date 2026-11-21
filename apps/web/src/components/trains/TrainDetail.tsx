"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bookmark,
  Check,
  Compass,
  ExternalLink,
  FileCheck2,
  Plus,
  RefreshCw,
  Share2,
} from "lucide-react";
import { Button, Card, Skeleton, StatusBadge, type BadgeKind } from "@/components/ui/Primitives";
import { useAppStore } from "@/lib/store/app-store";
import { t } from "@/lib/i18n/translations";
import {
  formatIstHHMM,
  formatRelativeAge,
  getStationByCode,
  todayIstDateString,
  yesterdayIstDateString,
} from "@/lib/trains/local-data";
import { saveTrainOffline } from "@/lib/offline/db";
import type {
  LiveStatus,
  PermitHint,
  RailheadDestination,
  RailheadOption,
  TrainRoute,
  TrainStop,
} from "@ne-mate/shared";

interface TrainDetailProps {
  trainNo: string;
  trainName?: string;
  trainType?: string;
  boardingCode?: string;
  alightingCode?: string;
  journeyDate: string;
  destination?: RailheadDestination | null;
  alightingRailhead?: RailheadOption | null;
  permitHint?: PermitHint | null;
  initialCachedStatus?: LiveStatus | null;
  initialCachedRoute?: TrainRoute | null;
  savedAgeIso?: string | null;
  onCloseMobile?: () => void;
  onAddToTrip?: (payload: {
    trainNo: string;
    name: string;
    startDate: string;
    fromCode: string;
    toCode: string;
    delayMin: number | null;
  }) => void;
}

export function TrainDetail({
  trainNo,
  trainName,
  trainType,
  boardingCode,
  alightingCode,
  journeyDate,
  destination,
  alightingRailhead,
  permitHint,
  initialCachedStatus,
  initialCachedRoute,
  savedAgeIso,
  onCloseMobile,
  onAddToTrip,
}: TrainDetailProps) {
  const lang = useAppStore((s) => s.lang);
  const isOnline = useAppStore((s) => s.isOnline);
  const lowDataMode = useAppStore((s) => s.lowDataMode);

  const today = todayIstDateString();
  const yesterday = yesterdayIstDateString();
  const [startDate, setStartDate] = useState<string>(today);
  const [status, setStatus] = useState<LiveStatus | null>(initialCachedStatus || null);
  const [route, setRoute] = useState<TrainRoute | null>(initialCachedRoute || null);
  const [loading, setLoading] = useState(!initialCachedStatus);
  const [cooldownSec, setCooldownSec] = useState(0);
  const [savedLocal, setSavedLocal] = useState(false);
  const [shareNote, setShareNote] = useState("");

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const id = window.setTimeout(() => setCooldownSec((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldownSec]);

  const fetchLiveAndRoute = async (targetStartDate: string) => {
    if (!isOnline) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [stResp, rtResp] = await Promise.all([
        fetch(`/api/trains/${encodeURIComponent(trainNo)}/status?startDate=${encodeURIComponent(targetStartDate)}`),
        fetch(`/api/trains/${encodeURIComponent(trainNo)}/route`),
      ]);
      if (stResp.ok) {
        const stJson: LiveStatus = await stResp.json();
        setStatus(stJson);
      }
      if (rtResp.ok) {
        const rtJson: TrainRoute = await rtResp.json();
        setRoute(rtJson);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSavedLocal(false);
    if (initialCachedStatus && !isOnline) {
      setStatus(initialCachedStatus);
      setRoute(initialCachedRoute || null);
      setLoading(false);
      return;
    }
    fetchLiveAndRoute(startDate);
  }, [trainNo, startDate]);

  const handleRefresh = () => {
    if (cooldownSec > 0 || !isOnline) return;
    setCooldownSec(60);
    fetchLiveAndRoute(startDate);
  };

  const displayName = trainName || route?.name || status?.trainName || `Train ${trainNo}`;
  const displayType = trainType || route?.type || status?.trainType || "Express";
  const stops: TrainStop[] = status?.stops?.length ? status.stops : route?.stops || [];
  const isCancelled = status?.state === "cancelled";

  // Compute "X of Y km" ONLY when distance data exists (never an unexplained %)
  const totalKm = stops.length ? stops[stops.length - 1].distanceKm : null;
  const currentStopObj = status?.currentStationCode
    ? stops.find((s) => s.stationCode === status.currentStationCode)
    : [...stops].reverse().find((s) => s.passed);
  const doneKm = currentStopObj?.distanceKm ?? null;
  const showDistanceProgress =
    !isCancelled &&
    status?.state === "running" &&
    typeof doneKm === "number" &&
    typeof totalKm === "number" &&
    totalKm > 0;

  const badgeForState = (): { kind: BadgeKind; label: string } => {
    if (!status) return { kind: "unavailable", label: t(lang, "statusUnavailable") };
    if (status.state === "cancelled") return { kind: "cancelled", label: t(lang, "statusCancelled") };
    if (status.state === "diverted") return { kind: "applied", label: t(lang, "statusDiverted") };
    if (status.state === "not_started") return { kind: "not_started", label: t(lang, "statusNotStarted") };
    if (status.state === "terminated") return { kind: "approved", label: t(lang, "statusTerminated") };
    if (status.state === "unavailable") return { kind: "unavailable", label: t(lang, "statusUnavailable") };
    if (status.delayMin === 0) return { kind: "approved", label: t(lang, "statusOnTime") };
    if (typeof status.delayMin === "number" && status.delayMin > 0) {
      return { kind: "applied", label: t(lang, "statusLate", { min: status.delayMin }) };
    }
    return { kind: "unavailable", label: t(lang, "statusUnavailable") };
  };

  const statusBadge = badgeForState();

  const handleSaveDevice = async () => {
    await saveTrainOffline({
      id: `${trainNo}_${startDate}`,
      trainNo,
      name: displayName,
      type: displayType,
      fromCode: boardingCode || stops[0]?.stationCode,
      toCode: alightingCode || stops[stops.length - 1]?.stationCode,
      startDate,
      savedAt: new Date().toISOString(),
      route,
      liveStatus: status,
    });
    setSavedLocal(true);
  };

  const handleShare = async () => {
    const summary = `${trainNo} ${displayName} (${boardingCode || stops[0]?.stationCode || ""} -> ${alightingCode || stops[stops.length - 1]?.stationCode || ""}, ${journeyDate})`;
    try {
      if (navigator.share) {
        await navigator.share({ title: summary, text: summary });
      } else {
        await navigator.clipboard?.writeText(summary);
        setShareNote("Copied train summary to clipboard.");
        setTimeout(() => setShareNote(""), 2500);
      }
    } catch {
      // cancelled
    }
  };

  const alightingSt = alightingCode ? getStationByCode(alightingCode) : null;

  return (
    <Card className="p-4 md:p-5 space-y-5">
      {/* Mobile back header */}
      {onCloseMobile && (
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden inline-flex items-center gap-1.5 text-sm font-semibold text-river min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          {t(lang, "backToResults")}
        </button>
      )}

      {/* Header */}
      <div className="space-y-1.5 border-b border-borderSubtle pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-bold text-forest">{trainNo}</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teaGold text-onGold">
              {displayType}
            </span>
          </div>
          <span className="text-xs font-semibold text-inkMuted">{journeyDate}</span>
        </div>
        <h2 className="text-xl font-bold text-ink">{displayName}</h2>
        {(boardingCode || stops.length > 1) && (
          <p className="text-sm text-inkMuted">
            {boardingCode || stops[0]?.stationCode} → {alightingCode || stops[stops.length - 1]?.stationCode}
          </p>
        )}
        {savedAgeIso && (
          <p className="text-xs font-semibold text-river">
            {t(lang, "savedAge", { age: formatRelativeAge(savedAgeIso) })}
          </p>
        )}
      </div>

      {/* Started on selector (Today / Yesterday) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-inkMuted">{t(lang, "startedOn")}:</span>
          <div className="inline-flex rounded-xl border border-borderSubtle bg-canvas p-1" role="group" aria-label={t(lang, "startedOn")}>
            {[
              { label: t(lang, "todayLabel"), val: today },
              { label: t(lang, "yesterdayLabel"), val: yesterday },
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => setStartDate(opt.val)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[36px] transition-colors ${
                  startDate === opt.val ? "bg-forest text-onPrimary" : "text-inkMuted hover:text-ink"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <Button
          variant="secondary"
          onClick={handleRefresh}
          disabled={loading || cooldownSec > 0 || !isOnline}
          className="text-sm px-3.5"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {cooldownSec > 0 ? t(lang, "refreshWait", { sec: cooldownSec }) : t(lang, "refreshStatus")}
        </Button>
      </div>

      {/* Live Status Block */}
      {loading ? (
        <Skeleton className="h-28" />
      ) : (
        <div
          className={`rounded-xl border p-4 space-y-2.5 ${
            isCancelled ? "border-rejected bg-statusRejectedBg/40" : "border-borderSubtle bg-mutedSurface/50"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StatusBadge kind={statusBadge.kind} label={statusBadge.label} />
            <span className="text-xs text-inkMuted">
              {status?.source === "scheduled_fallback"
                ? t(lang, "scheduledFallbackLabel", { date: status?.fetchedAt?.slice(0, 10) || "N/A" })
                : `${t(lang, "liveDataUpdated", { time: formatIstHHMM(status?.fetchedAt) })} · ${status?.provider || ""}`}
            </span>
          </div>

          <p className="text-sm font-medium text-ink">
            {status?.message ||
              (status?.state === "running" && status.currentStationCode
                ? `Last reported at ${status.currentStationCode}.`
                : t(lang, "statusUnavailable"))}
          </p>

          {/* Distance progress ONLY when distance exists and train is running */}
          {showDistanceProgress && (
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-xs font-semibold text-inkMuted">
                <span>{t(lang, "progressKm", { done: Math.round(doneKm!), total: Math.round(totalKm!) })}</span>
              </div>
              <div className="h-2.5 rounded-full bg-surface overflow-hidden border border-borderSubtle">
                <div
                  className="h-full bg-forest rounded-full"
                  style={{ width: `${Math.min(100, Math.round((doneKm! / totalKm!) * 100))}%` }}
                />
              </div>
            </div>
          )}

          <p className="text-[11px] text-inkMuted pt-1 border-t border-borderSubtle">
            {status?.disclaimer || t(lang, "liveDisclaimer", { provider: status?.provider || "Indian Railways" })}
          </p>
        </div>
      )}

      {lowDataMode && (
        <p className="text-xs text-inkMuted">{t(lang, "lowDataMapHidden")}</p>
      )}

      {/* Vertical Stop Timeline (not rendered as running if cancelled) */}
      {!isCancelled && stops.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-inkMuted">Route Timeline (IST)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-borderSubtle text-xs text-inkMuted">
                  <th className="py-2 pe-2">Station</th>
                  <th className="py-2 px-2">Arr / Dep</th>
                  <th className="py-2 px-2">Halt / km</th>
                  <th className="py-2 ps-2">Platform</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderSubtle">
                {stops.map((st) => {
                  const isCurrent = status?.currentStationCode === st.stationCode;
                  const isUserLeg = st.stationCode === boardingCode || st.stationCode === alightingCode;
                  return (
                    <tr
                      key={st.stationCode}
                      className={`${st.passed ? "opacity-60" : ""} ${
                        isCurrent ? "bg-forest/10 font-semibold" : isUserLeg ? "bg-statusVerifiedBg/40" : ""
                      }`}
                    >
                      <td className="py-2.5 pe-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                              isCurrent
                                ? "bg-forest text-onPrimary"
                                : st.passed
                                ? "bg-statusApprovedBg text-statusApprovedFg"
                                : "border border-borderSubtle bg-surface"
                            }`}
                            aria-hidden="true"
                          >
                            {st.passed ? <Check className="w-3 h-3" /> : isCurrent ? "●" : ""}
                          </span>
                          <div>
                            <p className="font-semibold leading-snug">
                              {st.stationName} <span className="font-mono text-xs text-inkMuted">({st.stationCode})</span>
                            </p>
                            {isUserLeg && (
                              <span className="text-[11px] font-bold text-river">
                                {st.stationCode === boardingCode ? "Boarding station" : "Getting-off station"}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 whitespace-nowrap text-xs">
                        <p>
                          {formatIstHHMM(st.schedArr)} / {formatIstHHMM(st.schedDep)}
                        </p>
                        {st.delayMin != null && st.delayMin > 0 && (
                          <p className="text-statusAppliedFg font-semibold">+{st.delayMin}m</p>
                        )}
                      </td>
                      <td className="py-2.5 px-2 whitespace-nowrap text-xs text-inkMuted">
                        <p>{st.haltMin != null ? `${st.haltMin}m halt` : "—"}</p>
                        <p>{st.distanceKm != null ? `${Math.round(st.distanceKm)} km` : ""}</p>
                      </td>
                      <td className="py-2.5 ps-2 text-xs text-inkMuted">
                        {st.platform ? t(lang, "platformLabel", { pf: st.platform }) : t(lang, "platformNotAnnounced")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Arrival Guide at getting-off station */}
      {(alightingSt || destination) && (
        <div className="rounded-xl border border-borderSubtle bg-canvas p-4 space-y-2.5">
          <h3 className="text-sm font-bold text-ink">
            {t(lang, "arrivalGuideTitle", { station: alightingSt?.name || destination?.name || alightingCode || "" })}
          </h3>
          {alightingRailhead && alightingRailhead.roadKm != null && alightingRailhead.roadKm > 0 && (
            <p className="text-xs text-inkMuted">
              Onward to <strong>{destination?.name}</strong>: ~{alightingRailhead.roadKm} km ({alightingRailhead.modes.join(", ").replaceAll("_", " ")}) ·{" "}
              {t(lang, "approxVerifiedLabel", { date: alightingRailhead.road?.lastVerifiedAt || "unverified" })}
            </p>
          )}
          <div className="flex flex-wrap gap-3 pt-1">
            {alightingSt && (
              <Link
                href={`/explore?state=${alightingSt.stateCode}&lat=${alightingSt.lat}&lng=${alightingSt.lng}`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-forest hover:underline min-h-[36px]"
              >
                <Compass className="w-4 h-4" />
                {t(lang, "exploreNearbyStation", { station: alightingSt.name })}
              </Link>
            )}
            {permitHint?.mayRequirePermit && (
              <Link
                href={permitHint.permitsPath}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-river hover:underline min-h-[36px]"
              >
                <FileCheck2 className="w-4 h-4" />
                {t(lang, "permitMayBeRequired")} — {t(lang, "checkPermitsLink")}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-borderSubtle">
        {onAddToTrip && (
          <Button
            onClick={() =>
              onAddToTrip({
                trainNo,
                name: displayName,
                startDate,
                fromCode: boardingCode || stops[0]?.stationCode || "",
                toCode: alightingCode || stops[stops.length - 1]?.stationCode || "",
                delayMin: status?.delayMin ?? null,
              })
            }
          >
            <Plus className="w-4 h-4" />
            {t(lang, "addToTrip")}
          </Button>
        )}
        <Button variant="secondary" onClick={handleSaveDevice}>
          {savedLocal ? <Check className="w-4 h-4 text-forest" /> : <Bookmark className="w-4 h-4" />}
          {savedLocal ? t(lang, "savedOnDevice") : t(lang, "saveOnDevice")}
        </Button>
        <Button variant="ghost" onClick={handleShare}>
          <Share2 className="w-4 h-4" />
          {t(lang, "shareTrain")}
        </Button>
        <a
          href="https://www.irctc.co.in/nget/train-search"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-river/50 bg-statusVerifiedBg text-statusVerifiedFg px-3.5 py-2.5 min-h-[48px] text-sm font-semibold"
        >
          <span>{t(lang, "bookOnIrctc")}</span>
          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
        </a>
      </div>
      {shareNote && <p className="text-xs font-semibold text-forest">{shareNote}</p>}
    </Card>
  );
}
