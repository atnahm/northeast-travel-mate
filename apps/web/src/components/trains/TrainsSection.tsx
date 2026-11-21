"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { TrainFront } from "lucide-react";
import { Button, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/Primitives";
import { useAppStore } from "@/lib/store/app-store";
import { t } from "@/lib/i18n/translations";
import {
  formatIstHHMM,
  getDestinationById,
  todayIstDateString,
} from "@/lib/trains/local-data";
import { listSavedTrains } from "@/lib/offline/db";
import { apiFetch } from "@ne-mate/shared/api-client";
import type {
  PermitHint,
  RailheadDestination,
  SavedTrainRecord,
  TrainSearchResponse,
  TrainSummary,
  Trip,
} from "@ne-mate/shared";
import {
  resolveDestinationToEndpoint,
  TrainSearchCard,
  type ResolvedEndpoint,
} from "./TrainSearchCard";
import { TrainResultCard } from "./TrainResultCard";
import { LastMileBridgeCard } from "./LastMileBridgeCard";
import { TrainDetail } from "./TrainDetail";
import { TrackByNumberModal } from "./TrackByNumberModal";
import { SavedTrainsStrip } from "./SavedTrainsStrip";

type SortBy = "departure" | "duration";
type TimeWindow = "all" | "morning" | "afternoon" | "night";

export function TrainsSection() {
  const router = useRouter();
  const lang = useAppStore((s) => s.lang);
  const isOnline = useAppStore((s) => s.isOnline);

  const [fromEndpoint, setFromEndpoint] = useState<ResolvedEndpoint | null>(null);
  const [toEndpoint, setToEndpoint] = useState<ResolvedEndpoint | null>(null);
  const [journeyDate, setJourneyDate] = useState<string>(todayIstDateString());

  const [searchResult, setSearchResult] = useState<TrainSearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  // Single-row sort & filter controls
  const [sortBy, setSortBy] = useState<SortBy>("departure");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("all");

  // Selected train for right panel (desktop) or full screen (mobile)
  const [selectedTrain, setSelectedTrain] = useState<{
    trainNo: string;
    name?: string;
    type?: string;
    boardingCode?: string;
    alightingCode?: string;
    cachedRecord?: SavedTrainRecord;
  } | null>(null);

  const [trackModalOpen, setTrackModalOpen] = useState(false);
  const [savedTrains, setSavedTrains] = useState<SavedTrainRecord[]>([]);
  const [toastMsg, setToastMsg] = useState("");

  // Fetch verified permit hints from backend permits DB (zero permitRequired in JSON!)
  const railheadsMetaQ = useQuery({
    queryKey: ["trains-railheads-meta"],
    queryFn: async () => {
      const r = await fetch("/api/trains/railheads");
      if (!r.ok) return null;
      return (await r.json()) as { destinations: RailheadDestination[] };
    },
    staleTime: 10 * 60_000,
    retry: false,
  });

  const permitHintByDestId = useMemo(() => {
    const map = new Map<string, PermitHint | null>();
    for (const d of railheadsMetaQ.data?.destinations || []) {
      map.set(d.id, d.permitHint || null);
    }
    return map;
  }, [railheadsMetaQ.data]);

  const reloadSaved = () => {
    listSavedTrains().then(setSavedTrains).catch(() => undefined);
  };

  useEffect(() => {
    reloadSaved();
  }, [selectedTrain]);

  const runSearch = async (fEp = fromEndpoint, tEp = toEndpoint, jDate = journeyDate) => {
    if (!fEp || !tEp) return;
    setSearchError("");
    setHasSearched(true);
    setSelectedTrain(null);

    // Same railhead -> ZERO provider call!
    if (fEp.stationCode === tEp.stationCode) {
      setSearchResult({
        fromCode: fEp.stationCode,
        toCode: tEp.stationCode,
        date: jDate,
        sameRailhead: true,
        source: "cached",
        verifiedAt: null,
        provider: "local",
        trains: [],
      });
      return;
    }

    setSearching(true);
    try {
      const resp = await fetch(
        `/api/trains/search?from=${encodeURIComponent(fEp.stationCode)}&to=${encodeURIComponent(tEp.stationCode)}&date=${encodeURIComponent(jDate)}`
      );
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error?.message || data?.detail || "Train search failed");
      }
      setSearchResult(data as TrainSearchResponse);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Could not fetch trains");
    } finally {
      setSearching(false);
    }
  };

  const handleQuickCorridor = (fromId: string, toId: string) => {
    const fd = getDestinationById(fromId);
    const td = getDestinationById(toId);
    if (!fd || !td) return;
    const fep = resolveDestinationToEndpoint(fd);
    const tep = resolveDestinationToEndpoint(td);
    setFromEndpoint(fep);
    setToEndpoint(tep);
    runSearch(fep, tep, journeyDate);
  };

  const filteredTrains = useMemo(() => {
    const list = [...(searchResult?.trains || [])];
    const filtered = list.filter((tr) => {
      if (typeFilter !== "all" && tr.type.toLowerCase() !== typeFilter.toLowerCase()) return false;
      if (timeWindow !== "all") {
        const hh = Number(formatIstHHMM(tr.departure).split(":")[0] || "0");
        if (timeWindow === "morning" && (hh < 5 || hh >= 12)) return false;
        if (timeWindow === "afternoon" && (hh < 12 || hh >= 18)) return false;
        if (timeWindow === "night" && hh >= 5 && hh < 18) return false;
      }
      return true;
    });

    // Always keep non-running trains at the bottom
    filtered.sort((a, b) => {
      const aNoRun = a.runsOnSelectedDate === false ? 1 : 0;
      const bNoRun = b.runsOnSelectedDate === false ? 1 : 0;
      if (aNoRun !== bNoRun) return aNoRun - bNoRun;
      if (sortBy === "duration") return a.durationMin - b.durationMin;
      return a.departure.localeCompare(b.departure);
    });
    return filtered;
  }, [searchResult, sortBy, typeFilter, timeWindow]);

  const trainTypes = useMemo(() => {
    const set = new Set<string>();
    for (const tr of searchResult?.trains || []) set.add(tr.type);
    return Array.from(set);
  }, [searchResult]);

  const activeDest = toEndpoint?.destination || null;
  const activeDestRailhead = activeDest
    ? activeDest.railheads.find((r) => r.code === toEndpoint?.stationCode) || activeDest.railheads[0]
    : null;
  const destPermitHint = activeDest ? permitHintByDestId.get(activeDest.id) || null : null;
  const showLastMileCard = Boolean(
    hasSearched &&
      activeDest &&
      activeDestRailhead &&
      (!activeDest.hasDirectRail || searchResult?.sameRailhead || (activeDestRailhead.roadKm || 0) > 0)
  );

  const handleAddTrainToTrip = async (info: {
    trainNo: string;
    name: string;
    startDate: string;
    fromCode: string;
    toCode: string;
    departure?: string;
    arrival?: string;
    delayMin?: number | null;
  }) => {
    try {
      const tripsRes = await apiFetch<{ items: Trip[] }>("/api/v1/trips");
      let trip = tripsRes.items?.[0];
      if (!trip) {
        const created = await apiFetch<{ trip: Trip }>("/api/v1/trips", {
          method: "POST",
          body: JSON.stringify({
            title: `${info.fromCode} to ${info.toCode} Rail Trip`,
            origin_text: info.fromCode,
            state_codes: activeDest ? [activeDest.stateCode] : ["AS"],
            start_date: info.startDate,
            end_date: info.startDate,
            party_size: 1,
            budget_inr: 15000,
          }),
        });
        trip = created.trip;
      }

      await apiFetch(`/api/v1/trips/${trip.id}/items`, {
        method: "POST",
        body: JSON.stringify({
          day_index: 1,
          type: "train",
          title: `${info.trainNo} ${info.name} (${info.fromCode} → ${info.toCode})`,
          start_time: info.departure ? formatIstHHMM(info.departure) : undefined,
          end_time: info.arrival ? formatIstHHMM(info.arrival) : undefined,
          payload: {
            train_number: info.trainNo,
            train_name: info.name,
            start_date: info.startDate,
            from_code: info.fromCode,
            to_code: info.toCode,
            delay_min: info.delayMin ?? null,
          },
        }),
      });
      setToastMsg(t(lang, "trainAddedToTrip"));
      setTimeout(() => router.push(`/trips/${trip.id}`), 900);
    } catch {
      setToastMsg(t(lang, "signInToAddTrip"));
    }
  };

  return (
    <div className="space-y-5">
      <TrainSearchCard
        fromEndpoint={fromEndpoint}
        toEndpoint={toEndpoint}
        journeyDate={journeyDate}
        searching={searching}
        onChangeFrom={setFromEndpoint}
        onChangeTo={setToEndpoint}
        onChangeDate={setJourneyDate}
        onSearch={(f, t) => runSearch(f ?? fromEndpoint, t ?? toEndpoint, journeyDate)}
        onOpenTrackModal={() => setTrackModalOpen(true)}
      />

      {toastMsg && (
        <Card role="status" aria-live="polite" className="p-3.5 border-forest bg-statusApprovedBg text-statusApprovedFg text-sm font-semibold">
          {toastMsg}
        </Card>
      )}

      {/* Saved Trains on this device (also works offline) */}
      <SavedTrainsStrip
        records={savedTrains}
        onOpenSaved={(rec) =>
          setSelectedTrain({
            trainNo: rec.trainNo,
            name: rec.name,
            type: rec.type,
            boardingCode: rec.fromCode,
            alightingCode: rec.toCode,
            cachedRecord: rec,
          })
        }
      />

      {/* First visit empty state with 3 example corridors */}
      {!hasSearched && !selectedTrain && (
        <EmptyState
          icon={<TrainFront className="w-7 h-7" />}
          title={t(lang, "firstVisitTitle")}
          description={t(lang, "firstVisitHint")}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" onClick={() => handleQuickCorridor("guwahati", "dibrugarh")}>
                Guwahati → Dibrugarh
              </Button>
              <Button variant="secondary" onClick={() => handleQuickCorridor("guwahati", "kaziranga")}>
                Guwahati → Kaziranga
              </Button>
              <Button variant="secondary" onClick={() => handleQuickCorridor("guwahati", "aizawl")}>
                Guwahati → Aizawl
              </Button>
            </div>
          }
        />
      )}

      {/* Results + Split Detail Panel (Desktop: left results / right detail; Mobile: detail full screen) */}
      {(hasSearched || selectedTrain) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Last-mile bridge + Filters + Results */}
          <div className={`space-y-4 ${selectedTrain ? "hidden lg:block lg:col-span-6" : "lg:col-span-12"}`}>
            {searching && (
              <div className="space-y-3">
                <Skeleton className="h-36" />
                <Skeleton className="h-36" />
              </div>
            )}

            {searchError && (
              <ErrorState message={searchError} onRetry={() => runSearch()} />
            )}

            {showLastMileCard && activeDest && activeDestRailhead && (
              <LastMileBridgeCard
                destination={activeDest}
                railhead={activeDestRailhead}
                sameRailhead={Boolean(searchResult?.sameRailhead)}
                permitHint={destPermitHint}
              />
            )}

            {!searching && searchResult && !searchResult.sameRailhead && (
              <>
                {/* Single-row Sort & Filter bar */}
                {searchResult.trains.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label="Sort trains"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortBy)}
                      className="rounded-xl border border-borderSubtle bg-surface px-3 py-2 text-xs font-semibold min-h-[40px]"
                    >
                      <option value="departure">{t(lang, "sortDeparture")}</option>
                      <option value="duration">{t(lang, "sortDuration")}</option>
                    </select>

                    <select
                      aria-label="Filter by train type"
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="rounded-xl border border-borderSubtle bg-surface px-3 py-2 text-xs font-semibold min-h-[40px]"
                    >
                      <option value="all">{t(lang, "filterAllTypes")}</option>
                      {trainTypes.map((tp) => (
                        <option key={tp} value={tp}>
                          {tp}
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label="Filter by departure time"
                      value={timeWindow}
                      onChange={(e) => setTimeWindow(e.target.value as TimeWindow)}
                      className="rounded-xl border border-borderSubtle bg-surface px-3 py-2 text-xs font-semibold min-h-[40px]"
                    >
                      <option value="all">{t(lang, "filterAllTimes")}</option>
                      <option value="morning">{t(lang, "filterMorning")}</option>
                      <option value="afternoon">{t(lang, "filterAfternoon")}</option>
                      <option value="night">{t(lang, "filterNight")}</option>
                    </select>
                  </div>
                )}

                {filteredTrains.length === 0 ? (
                  <EmptyState
                    icon={<TrainFront className="w-6 h-6" />}
                    title={t(lang, "noTrainsTitle")}
                    description={t(lang, "noTrainsHint")}
                  />
                ) : (
                  <div className="space-y-3">
                    {filteredTrains.map((tr: TrainSummary) => (
                      <TrainResultCard
                        key={`${tr.trainNo}-${tr.fromCode}-${tr.toCode}`}
                        train={tr}
                        journeyDate={journeyDate}
                        selected={selectedTrain?.trainNo === tr.trainNo}
                        onOpenDetails={() =>
                          setSelectedTrain({
                            trainNo: tr.trainNo,
                            name: tr.name,
                            type: tr.type,
                            boardingCode: tr.fromCode,
                            alightingCode: tr.toCode,
                          })
                        }
                        onOpenLiveStatus={() =>
                          setSelectedTrain({
                            trainNo: tr.trainNo,
                            name: tr.name,
                            type: tr.type,
                            boardingCode: tr.fromCode,
                            alightingCode: tr.toCode,
                          })
                        }
                        onAddToTrip={() =>
                          handleAddTrainToTrip({
                            trainNo: tr.trainNo,
                            name: tr.name,
                            startDate: journeyDate,
                            fromCode: tr.fromCode,
                            toCode: tr.toCode,
                            departure: tr.departure,
                            arrival: tr.arrival,
                          })
                        }
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right Column (Desktop) / Full Screen (Mobile): Train Detail */}
          {selectedTrain && (
            <div className="lg:col-span-6">
              <TrainDetail
                trainNo={selectedTrain.trainNo}
                trainName={selectedTrain.name}
                trainType={selectedTrain.type}
                boardingCode={selectedTrain.boardingCode}
                alightingCode={selectedTrain.alightingCode}
                journeyDate={journeyDate}
                destination={activeDest}
                alightingRailhead={activeDestRailhead}
                permitHint={destPermitHint}
                initialCachedStatus={selectedTrain.cachedRecord?.liveStatus}
                initialCachedRoute={selectedTrain.cachedRecord?.route}
                savedAgeIso={!isOnline ? selectedTrain.cachedRecord?.savedAt : null}
                onCloseMobile={() => setSelectedTrain(null)}
                onAddToTrip={handleAddTrainToTrip}
              />
            </div>
          )}
        </div>
      )}

      <TrackByNumberModal
        open={trackModalOpen}
        onClose={() => setTrackModalOpen(false)}
        onSelectTrain={(num, sDate) => {
          setJourneyDate(sDate);
          setSelectedTrain({ trainNo: num });
        }}
      />
    </div>
  );
}
