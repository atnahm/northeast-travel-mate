"use client";

import React, { useState } from "react";
import { ArrowLeftRight, Calendar, LocateFixed, MapPin, Search, TrainFront } from "lucide-react";
import { Button, Card } from "@/components/ui/Primitives";
import { useAppStore } from "@/lib/store/app-store";
import { t } from "@/lib/i18n/translations";
import {
  findNearestStation,
  getDestinationById,
  getStationByCode,
  searchLocalRailEntries,
  todayIstDateString,
  type AutocompleteItem,
} from "@/lib/trains/local-data";
import type { RailheadDestination } from "@ne-mate/shared";

const SHOW_PNR_ENTRY = false;

export interface ResolvedEndpoint {
  displayText: string;
  stationCode: string;
  stationName: string;
  destination: RailheadDestination | null;
}

interface TrainSearchCardProps {
  fromEndpoint: ResolvedEndpoint | null;
  toEndpoint: ResolvedEndpoint | null;
  journeyDate: string;
  searching: boolean;
  onChangeFrom: (ep: ResolvedEndpoint | null) => void;
  onChangeTo: (ep: ResolvedEndpoint | null) => void;
  onChangeDate: (d: string) => void;
  onSearch: (from?: ResolvedEndpoint, to?: ResolvedEndpoint) => void;
  onOpenTrackModal: () => void;
}

const POPULAR_CORRIDORS: Array<{ label: string; fromDestId: string; toDestId: string }> = [
  { label: "Guwahati → Dibrugarh", fromDestId: "guwahati", toDestId: "dibrugarh" },
  { label: "Guwahati → Kaziranga", fromDestId: "guwahati", toDestId: "kaziranga" },
  { label: "Guwahati → Aizawl", fromDestId: "guwahati", toDestId: "aizawl" },
  { label: "Guwahati → Shillong", fromDestId: "guwahati", toDestId: "shillong" },
  { label: "Guwahati → Tawang", fromDestId: "guwahati", toDestId: "tawang" },
];

export function resolveDestinationToEndpoint(dest: RailheadDestination, railheadCode?: string): ResolvedEndpoint {
  const chosen =
    (railheadCode ? dest.railheads.find((r) => r.code === railheadCode) : null) ||
    dest.railheads.find((r) => r.isPrimary) ||
    dest.railheads[0];
  return {
    displayText: dest.name,
    stationCode: chosen.code,
    stationName: chosen.name,
    destination: dest,
  };
}

export function TrainSearchCard({
  fromEndpoint,
  toEndpoint,
  journeyDate,
  searching,
  onChangeFrom,
  onChangeTo,
  onChangeDate,
  onSearch,
  onOpenTrackModal,
}: TrainSearchCardProps) {
  const lang = useAppStore((s) => s.lang);
  const [fromInput, setFromInput] = useState(fromEndpoint?.displayText || "");
  const [toInput, setToInput] = useState(toEndpoint?.displayText || "");
  const [openMenu, setOpenMenu] = useState<"from" | "to" | null>(null);
  const [locError, setLocError] = useState("");
  const [inputErr, setInputErr] = useState("");
  const [changingRailhead, setChangingRailhead] = useState<"from" | "to" | null>(null);

  const resolveTypedText = (raw: string): ResolvedEndpoint | null => {
    const clean = raw.trim();
    if (!clean) return null;
    const exactSt = getStationByCode(clean);
    if (exactSt) {
      return {
        displayText: `${exactSt.name} (${exactSt.code})`,
        stationCode: exactSt.code,
        stationName: exactSt.name,
        destination: null,
      };
    }
    const hits = searchLocalRailEntries(clean, 1);
    if (!hits.length) return null;
    const first = hits[0];
    return first.kind === "place"
      ? resolveDestinationToEndpoint(first.destination)
      : {
          displayText: `${first.station.name} (${first.station.code})`,
          stationCode: first.station.code,
          stationName: first.station.name,
          destination: null,
        };
  };

  const handleSubmitSearch = () => {
    setInputErr("");
    let fEp = fromEndpoint;
    let tEp = toEndpoint;

    if (!fEp || fEp.displayText.toLowerCase() !== fromInput.trim().toLowerCase()) {
      const resolved = resolveTypedText(fromInput);
      if (!resolved) {
        setInputErr(`No matching North-East place or station found for "${fromInput.trim()}". Pick from the suggestions.`);
        return;
      }
      fEp = resolved;
      onChangeFrom(resolved);
      setFromInput(resolved.displayText);
    }

    if (!tEp || tEp.displayText.toLowerCase() !== toInput.trim().toLowerCase()) {
      const resolved = resolveTypedText(toInput);
      if (!resolved) {
        setInputErr(`No matching North-East place or station found for "${toInput.trim()}". Pick from the suggestions.`);
        return;
      }
      tEp = resolved;
      onChangeTo(resolved);
      setToInput(resolved.displayText);
    }

    setOpenMenu(null);
    onSearch(fEp, tEp);
  };

  const today = todayIstDateString();
  const fromSuggestions = openMenu === "from" ? searchLocalRailEntries(fromInput) : [];
  const toSuggestions = openMenu === "to" ? searchLocalRailEntries(toInput) : [];

  // Keep input text synchronized when external corridor pill or swap updates endpoint
  React.useEffect(() => {
    if (fromEndpoint && fromEndpoint.displayText !== fromInput && openMenu !== "from") {
      setFromInput(fromEndpoint.displayText);
    }
  }, [fromEndpoint?.displayText, fromEndpoint?.stationCode]);

  React.useEffect(() => {
    if (toEndpoint && toEndpoint.displayText !== toInput && openMenu !== "to") {
      setToInput(toEndpoint.displayText);
    }
  }, [toEndpoint?.displayText, toEndpoint?.stationCode]);

  const selectItem = (side: "from" | "to", item: AutocompleteItem) => {
    const ep: ResolvedEndpoint =
      item.kind === "place"
        ? resolveDestinationToEndpoint(item.destination)
        : {
            displayText: `${item.station.name} (${item.station.code})`,
            stationCode: item.station.code,
            stationName: item.station.name,
            destination: null,
          };
    if (side === "from") {
      setFromInput(ep.displayText);
      onChangeFrom(ep);
    } else {
      setToInput(ep.displayText);
      onChangeTo(ep);
    }
    setOpenMenu(null);
    setChangingRailhead(null);
  };

  const handleSwap = () => {
    const prevFrom = fromEndpoint;
    const prevTo = toEndpoint;
    onChangeFrom(prevTo);
    onChangeTo(prevFrom);
    setFromInput(prevTo?.displayText || "");
    setToInput(prevFrom?.displayText || "");
  };

  const handleUseLocation = () => {
    setLocError("");
    if (!navigator.geolocation) {
      setLocError(t(lang, "locationDeniedNote"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nearest = findNearestStation(pos.coords.latitude, pos.coords.longitude);
        const ep: ResolvedEndpoint = {
          displayText: `${nearest.name} (${nearest.code})`,
          stationCode: nearest.code,
          stationName: nearest.name,
          destination: null,
        };
        setFromInput(ep.displayText);
        onChangeFrom(ep);
      },
      () => setLocError(t(lang, "locationDeniedNote")),
      { timeout: 6000 }
    );
  };

  const renderRailheadChip = (side: "from" | "to", ep: ResolvedEndpoint | null) => {
    if (!ep?.destination) return null;
    const dest = ep.destination;
    const activeRh = dest.railheads.find((r) => r.code === ep.stationCode) || dest.railheads[0];
    if (!activeRh) return null;
    // Show chip whenever destination has no direct rail OR has a non-zero road leg (e.g. Aizawl -> Sairang)
    if (dest.hasDirectRail && (!activeRh.roadKm || activeRh.roadKm === 0) && dest.railheads.length <= 1) {
      return null;
    }
    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-mutedSurface px-3 py-1 text-ink font-medium border border-borderSubtle">
          <MapPin className="w-3.5 h-3.5 text-forest shrink-0" aria-hidden="true" />
          <span>
            {t(lang, "nearestRailhead")}: <strong>{activeRh.name} ({activeRh.code})</strong>
            {activeRh.roadKm ? `, ${t(lang, "aboutKmByRoad", { km: activeRh.roadKm })}` : ""}
          </span>
        </span>
        {dest.railheads.length > 1 && (
          <button
            type="button"
            onClick={() => setChangingRailhead(changingRailhead === side ? null : side)}
            className="text-river font-semibold hover:underline min-h-[32px] px-1"
          >
            {t(lang, "changeRailhead")}
          </button>
        )}
        {changingRailhead === side && (
          <div className="w-full flex flex-wrap gap-1.5 pt-1">
            {dest.railheads.map((rh) => (
              <button
                key={rh.code}
                type="button"
                onClick={() => {
                  const updated = resolveDestinationToEndpoint(dest, rh.code);
                  if (side === "from") onChangeFrom(updated);
                  else onChangeTo(updated);
                  setChangingRailhead(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border min-h-[36px] ${
                  rh.code === ep.stationCode
                    ? "bg-forest text-onPrimary border-forest"
                    : "bg-surface text-ink border-borderSubtle hover:bg-mutedSurface"
                }`}
              >
                {rh.name} ({rh.code}){rh.roadKm ? ` · ~${rh.roadKm} km` : ""}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const applyCorridor = (fromDestId: string, toDestId: string) => {
    const fd = getDestinationById(fromDestId);
    const td = getDestinationById(toDestId);
    if (!fd || !td) return;
    const fep = resolveDestinationToEndpoint(fd);
    const tep = resolveDestinationToEndpoint(td);
    onChangeFrom(fep);
    onChangeTo(tep);
    setFromInput(fep.displayText);
    setToInput(tep.displayText);
    setInputErr("");
    setOpenMenu(null);
  };

  return (
    <div className="space-y-2.5">
      <Card className="p-4 md:p-5 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr_180px_auto] gap-3 items-start">
          {/* From */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="train-from" className="text-xs font-semibold text-ink">
                {t(lang, "fromLabel")}
              </label>
              <button
                type="button"
                onClick={handleUseLocation}
                className="inline-flex items-center gap-1 text-xs font-semibold text-river hover:underline"
              >
                <LocateFixed className="w-3.5 h-3.5" aria-hidden="true" />
                {t(lang, "useCurrentLocation")}
              </button>
            </div>
            <input
              id="train-from"
              type="text"
              autoComplete="off"
              role="combobox"
              aria-expanded={openMenu === "from" && fromSuggestions.length > 0}
              aria-autocomplete="list"
              value={fromInput}
              onFocus={() => setOpenMenu("from")}
              onBlur={() => setTimeout(() => setOpenMenu((m) => (m === "from" ? null : m)), 160)}
              onChange={(e) => {
                const val = e.target.value;
                setFromInput(val);
                setInputErr("");
                setOpenMenu("from");
                const exactSt = getStationByCode(val.trim());
                if (exactSt) {
                  onChangeFrom({
                    displayText: `${exactSt.name} (${exactSt.code})`,
                    stationCode: exactSt.code,
                    stationName: exactSt.name,
                    destination: null,
                  });
                } else {
                  onChangeFrom(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmitSearch();
                }
              }}
              placeholder={t(lang, "fromPlaceholder")}
              className="w-full rounded-xl border border-borderSubtle bg-canvas px-3.5 py-3 min-h-[48px] text-base"
            />
            {openMenu === "from" && fromSuggestions.length > 0 && (
              <ul
                role="listbox"
                className="absolute z-30 mt-1 w-full rounded-xl bg-surface border border-borderSubtle shadow-sheet max-h-64 overflow-y-auto py-1"
              >
                {fromSuggestions.map((item) => (
                  <li key={`${item.kind}-${item.code}-${item.label}`}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectItem("from", item);
                      }}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-mutedSurface min-h-[44px]"
                    >
                      <p className="text-sm font-semibold text-ink">{item.label}</p>
                      <p className="text-xs text-inkMuted">{item.sublabel}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {locError && <p className="mt-1 text-xs text-sunrise font-medium">{locError}</p>}
            {renderRailheadChip("from", fromEndpoint)}
          </div>

          {/* Swap button */}
          <div className="flex justify-center lg:pt-6">
            <button
              type="button"
              onClick={handleSwap}
              aria-label={t(lang, "swapStations")}
              title={t(lang, "swapStations")}
              className="w-12 h-12 rounded-xl border border-borderSubtle bg-surface hover:bg-mutedSurface flex items-center justify-center transition-colors"
            >
              <ArrowLeftRight className="w-4 h-4 text-forest" />
            </button>
          </div>

          {/* To */}
          <div className="relative">
            <label htmlFor="train-to" className="block text-xs font-semibold text-ink mb-1">
              {t(lang, "toLabel")}
            </label>
            <input
              id="train-to"
              type="text"
              autoComplete="off"
              role="combobox"
              aria-expanded={openMenu === "to" && toSuggestions.length > 0}
              aria-autocomplete="list"
              value={toInput}
              onFocus={() => setOpenMenu("to")}
              onBlur={() => setTimeout(() => setOpenMenu((m) => (m === "to" ? null : m)), 160)}
              onChange={(e) => {
                const val = e.target.value;
                setToInput(val);
                setInputErr("");
                setOpenMenu("to");
                const exactSt = getStationByCode(val.trim());
                if (exactSt) {
                  onChangeTo({
                    displayText: `${exactSt.name} (${exactSt.code})`,
                    stationCode: exactSt.code,
                    stationName: exactSt.name,
                    destination: null,
                  });
                } else {
                  onChangeTo(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmitSearch();
                }
              }}
              placeholder={t(lang, "toPlaceholder")}
              className="w-full rounded-xl border border-borderSubtle bg-canvas px-3.5 py-3 min-h-[48px] text-base"
            />
            {openMenu === "to" && toSuggestions.length > 0 && (
              <ul
                role="listbox"
                className="absolute z-30 mt-1 w-full rounded-xl bg-surface border border-borderSubtle shadow-sheet max-h-64 overflow-y-auto py-1"
              >
                {toSuggestions.map((item) => (
                  <li key={`${item.kind}-${item.code}-${item.label}`}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectItem("to", item);
                      }}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-mutedSurface min-h-[44px]"
                    >
                      <p className="text-sm font-semibold text-ink">{item.label}</p>
                      <p className="text-xs text-inkMuted">{item.sublabel}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {renderRailheadChip("to", toEndpoint)}
          </div>

          {/* Date */}
          <div>
            <label htmlFor="train-date" className="block text-xs font-semibold text-ink mb-1">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-forest" aria-hidden="true" />
                {t(lang, "journeyDate")}
              </span>
            </label>
            <input
              id="train-date"
              type="date"
              min={today}
              value={journeyDate}
              onChange={(e) => onChangeDate(e.target.value >= today ? e.target.value : today)}
              className="w-full rounded-xl border border-borderSubtle bg-canvas px-3 py-3 min-h-[48px] text-base"
            />
          </div>

          {/* Search CTA */}
          <div className="lg:pt-6">
            <Button
              type="button"
              onClick={handleSubmitSearch}
              disabled={searching || !fromInput.trim() || !toInput.trim()}
              className="w-full lg:w-auto"
            >
              <Search className="w-4 h-4" />
              {searching ? t(lang, "searchingTrains") : t(lang, "searchTrains")}
            </Button>
          </div>
        </div>

        {inputErr && (
          <p role="alert" className="text-xs font-semibold text-statusRejectedFg">
            {inputErr}
          </p>
        )}

        {/* Popular NE Corridors */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-borderSubtle">
          <span className="text-xs font-semibold text-inkMuted">{t(lang, "popularCorridors")}:</span>
          {POPULAR_CORRIDORS.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => applyCorridor(c.fromDestId, c.toDestId)}
              className="px-3 py-1.5 min-h-[36px] rounded-full bg-mutedSurface hover:bg-forest/15 text-xs font-semibold text-ink transition-colors"
            >
              {c.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Quiet secondary text links */}
      <div className="flex flex-wrap items-center gap-4 px-1 text-sm">
        <button
          type="button"
          onClick={onOpenTrackModal}
          className="inline-flex items-center gap-1.5 font-semibold text-river hover:underline min-h-[40px]"
        >
          <TrainFront className="w-4 h-4" aria-hidden="true" />
          {t(lang, "trackByNumber")}
        </button>
        {SHOW_PNR_ENTRY && (
          <span className="text-inkMuted text-xs">{t(lang, "pnrStatus")}</span>
        )}
      </div>
    </div>
  );
}
