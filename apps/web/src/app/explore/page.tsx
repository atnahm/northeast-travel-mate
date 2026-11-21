"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, Compass, LocateFixed, Search, Utensils } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { NEMap, type MapPinItem } from "@/components/maps/NEMap";
import { BottomSheet, Card, Chip, EmptyState, ErrorState, Skeleton } from "@/components/ui/Primitives";
import { useAppStore } from "@/lib/store/app-store";
import {
  getPlaceEditorialMeta,
  getPlacePermitSummary,
  STATE_FULL_NAMES,
} from "@/lib/places/place-media";
import { apiFetch } from "@ne-mate/shared/api-client";
import type { NEState, Place, Speciality } from "@ne-mate/shared";

const CATEGORIES = ["all", "food", "culture", "nature", "trek", "wildlife", "stay"] as const;

export default function ExplorePage() {
  const lang = useAppStore((s) => s.lang);
  const profile = useAppStore((s) => s.profile);
  const lowDataMode = useAppStore((s) => s.lowDataMode);
  const selectedState = useAppStore((s) => s.selectedState);
  const setSelectedState = useAppStore((s) => s.setSelectedState);

  const [mode, setMode] = useState<"browse" | "local">("browse");
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: 26.1445, lng: 91.7362 });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [sheetSnap, setSheetSnap] = useState<"peek" | "half" | "full">("half");
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const st = sp.get("state");
    const latStr = sp.get("lat");
    const lngStr = sp.get("lng");
    if (st) setSelectedState(st.toUpperCase());
    if (latStr && lngStr) {
      const lat = Number(latStr);
      const lng = Number(lngStr);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        setCoords({ lat, lng });
        setMode("local");
      }
    }
  }, [setSelectedState]);

  const statesQ = useQuery({
    queryKey: ["states", lang],
    queryFn: () => apiFetch<{ items: NEState[] }>(`/api/v1/states?lang=${lang}`),
  });

  const placesQ = useQuery({
    queryKey: ["explore-places", mode, selectedState, search, category, coords.lat, coords.lng, lang],
    queryFn: () => {
      if (mode === "local") {
        const params = new URLSearchParams({
          lat: String(coords.lat),
          lng: String(coords.lng),
          radius: "300",
          lang,
        });
        if (category !== "all") params.set("category", category);
        return apiFetch<{ items: Place[] }>(`/api/v1/places/nearby?${params.toString()}`);
      }
      const params = new URLSearchParams({ lang });
      if (selectedState !== "ALL") params.set("state", selectedState);
      if (search.trim()) params.set("q", search.trim());
      if (category !== "all") params.set("category", category);
      return apiFetch<{ items: Place[] }>(`/api/v1/places/search?${params.toString()}`);
    },
  });

  const specsQ = useQuery({
    queryKey: ["specialities", selectedState, lang],
    queryFn: () => {
      const qs = selectedState !== "ALL" ? `state=${selectedState}&lang=${lang}` : `lang=${lang}`;
      return apiFetch<{ items: Speciality[] }>(`/api/v1/specialities?${qs}`);
    },
  });

  const detectLocation = () => {
    setMode("local");
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setCoords({ lat: 26.1445, lng: 91.7362 })
      );
    }
  };

  const pins: MapPinItem[] = useMemo(
    () =>
      (placesQ.data?.items || []).map((p) => ({
        id: p.id,
        label: p.name,
        lat: p.lat,
        lng: p.lng,
        category: p.categories?.[0],
        state_code: p.state_code,
        highlight: p.id === selectedPinId,
      })),
    [placesQ.data, selectedPinId]
  );

  const currentCenter = useMemo(() => {
    if (mode === "local") return coords;
    const st = statesQ.data?.items.find((s) => s.code === selectedState);
    return st?.center || { lat: 26.1445, lng: 91.7362 };
  }, [mode, coords, statesQ.data, selectedState]);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Explore North-East India</h1>
            <p className="text-sm text-inkMuted">Curated places, heritage crafts & regional cuisine across all 8 states.</p>
          </div>
          <div className="flex gap-2">
            <Chip active={mode === "browse"} onClick={() => setMode("browse")}>
              <Compass className="w-4 h-4" />
              Browse by State
            </Chip>
            <Chip active={mode === "local"} onClick={detectLocation}>
              <LocateFixed className="w-4 h-4" />
              Nearby (GPS)
            </Chip>
          </div>
        </div>

        {/* Search & State Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-inkMuted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setMode("browse");
                setSearch(e.target.value);
              }}
              placeholder="Search Kaziranga, Tawang, Jadoh, Dzukou..."
              aria-label="Search places"
              className="w-full rounded-xl border border-borderSubtle bg-surface pl-10 pr-4 py-3 min-h-[48px]"
            />
          </div>
          <select
            aria-label="Select North-East state"
            value={selectedState}
            onChange={(e) => {
              setMode("browse");
              setSelectedState(e.target.value);
            }}
            className="rounded-xl border border-borderSubtle bg-surface px-3.5 py-3 min-h-[48px] font-medium"
          >
            <option value="ALL">All 8 North-East States</option>
            {(statesQ.data?.items || []).map((st) => (
              <option key={st.code} value={st.code}>
                {st.name} ({st.code})
              </option>
            ))}
          </select>
        </div>

        {/* Category Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <Chip key={cat} active={category === cat} onClick={() => setCategory(cat)} className="capitalize">
              {cat}
            </Chip>
          ))}
        </div>

        {/* Map */}
        <NEMap
          pins={pins}
          center={currentCenter}
          selectedId={selectedPinId}
          onSelectPin={(pin) => {
            setSelectedPinId(pin.id);
            setSheetSnap("half");
          }}
          heightClass="h-[300px] md:h-[380px]"
        />

        {/* Bottom Sheet List of Places */}
        <BottomSheet
          snap={sheetSnap}
          onSnapChange={setSheetSnap}
          title={`${placesQ.data?.items.length ?? 0} Places ${mode === "local" ? "Nearby" : selectedState === "ALL" ? "Across NE" : `in ${selectedState}`}`}
        >
          {placesQ.isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          )}

          {placesQ.isError && (
            <ErrorState message={(placesQ.error as Error).message} onRetry={() => placesQ.refetch()} />
          )}

          {placesQ.data && placesQ.data.items.length === 0 && (
            <EmptyState
              title="No matching places found"
              description="Try clearing the category chip or switching to All 8 North-East States."
              action={
                <Chip
                  onClick={() => {
                    setCategory("all");
                    setSearch("");
                    setSelectedState("ALL");
                  }}
                >
                  Reset filters
                </Chip>
              }
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {(placesQ.data?.items || []).map((pl) => {
              const media = getPlaceEditorialMeta(pl.id, pl.state_code, pl.curated_notes);
              const permitInfo = getPlacePermitSummary(
                pl.state_code,
                pl.permit_area_id,
                profile?.citizen_type || "indian"
              );
              const stateFullName = STATE_FULL_NAMES[pl.state_code] || pl.state_code;

              return (
                <Link key={pl.id} href={`/explore/${pl.id}`} className="group block h-full">
                  <Card
                    className={`overflow-hidden h-full flex flex-col justify-between transition-colors ${
                      selectedPinId === pl.id ? "border-sunrise ring-1 ring-sunrise/40" : "hover:border-forest"
                    }`}
                  >
                    <div>
                      {!lowDataMode && (
                        <div className="relative h-36 w-full overflow-hidden bg-mutedSurface">
                          <img
                            src={media.imageUrl}
                            alt={media.imageCaption}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-black/75 text-white shadow-sm">
                              {stateFullName}
                            </span>
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-md shadow-sm ${
                                permitInfo.required
                                  ? "bg-statusCheckBg text-statusCheckFg border border-sunrise/40"
                                  : "bg-statusApprovedBg text-statusApprovedFg border border-forest/30"
                              }`}
                            >
                              {permitInfo.badgeLabel}
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="p-4 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap gap-1.5">
                            {pl.categories.map((cat) => (
                              <span
                                key={cat}
                                className="text-[11px] font-medium capitalize px-2 py-0.5 rounded bg-mutedSurface text-inkMuted"
                              >
                                {cat}
                              </span>
                            ))}
                          </div>
                          {pl.distance_km !== undefined && (
                            <span className="text-xs text-inkMuted">{pl.distance_km} km away</span>
                          )}
                        </div>
                        <h3 className="font-display text-base font-semibold">{pl.name}</h3>
                        <p className="text-sm text-inkMuted line-clamp-2">{media.fieldNote || pl.curated_notes}</p>
                      </div>
                    </div>
                    <div className="px-4 py-2.5 border-t border-borderSubtle bg-canvas/40 flex items-center justify-between text-xs font-semibold text-river">
                      <span className="group-hover:underline underline-offset-4">{permitInfo.ctaLabel}</span>
                      <Bookmark className="w-3.5 h-3.5" strokeWidth={1.65} />
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </BottomSheet>

        {/* Local Specialities Horizontal Row */}
        <section className="space-y-3 pt-2">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Utensils className="w-5 h-5 text-teaGold" />
            Local Specialities (Dishes, Crafts & Products)
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {(specsQ.data?.items || []).map((sp) => (
              <Card key={sp.id} className="min-w-[260px] max-w-[280px] p-4 shrink-0 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded-full bg-teaGold text-onGold">
                    {sp.type}
                  </span>
                  <span className="text-xs font-semibold text-inkMuted">{sp.state_code}</span>
                </div>
                <h3 className="font-bold text-base">{sp.name}</h3>
                <p className="text-xs text-inkMuted line-clamp-3">{sp.description}</p>
                <p className="text-xs font-medium text-forest">Where: {sp.where_to_find}</p>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
