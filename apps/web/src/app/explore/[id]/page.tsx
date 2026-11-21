"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bookmark, Check, Clock, FileCheck2, MapPin, Navigation, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { NEMap } from "@/components/maps/NEMap";
import { Button, Card, ErrorState, Skeleton, StatusBadge } from "@/components/ui/Primitives";
import { useAppStore } from "@/lib/store/app-store";
import { offlineDb, queueOfflineOp } from "@/lib/offline/db";
import { apiFetch } from "@ne-mate/shared/api-client";
import type { Place, Trip } from "@ne-mate/shared";

export default function PlaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const lang = useAppStore((s) => s.lang);
  const isOnline = useAppStore((s) => s.isOnline);
  const [saved, setSaved] = useState(false);
  const [addedMsg, setAddedMsg] = useState("");

  const placeQ = useQuery({
    queryKey: ["place-detail", id, lang],
    queryFn: () => apiFetch<{ place: Place }>(`/api/v1/places/${id}?lang=${lang}`),
  });

  const tripsQ = useQuery({
    queryKey: ["trips-list-mini"],
    queryFn: () => apiFetch<{ items: Trip[] }>("/api/v1/trips"),
    retry: false,
  });

  const handleSave = async () => {
    const place = placeQ.data?.place;
    if (!place) return;
    if (!isOnline) {
      await offlineDb?.saved_places.put({
        id: place.id,
        place_id: place.id,
        title: place.name,
        state_code: place.state_code,
        lat: place.lat,
        lng: place.lng,
      });
      await queueOfflineOp({
        op_id: `save_${place.id}_${Date.now()}`,
        entity: "saved_places",
        action: "upsert",
        doc_id: place.id,
        data: { place_id: place.id, title: place.name, state_code: place.state_code },
      });
      setSaved(true);
      return;
    }
    try {
      await apiFetch("/api/v1/saved-places", {
        method: "POST",
        body: JSON.stringify({
          place_id: place.id,
          google_place_id: place.google_place_id,
          title: place.name,
          state_code: place.state_code,
        }),
      });
      setSaved(true);
    } catch {
      await offlineDb?.saved_places.put({
        id: place.id,
        place_id: place.id,
        title: place.name,
        state_code: place.state_code,
      });
      setSaved(true);
    }
  };

  const handleAddToTrip = async () => {
    const place = placeQ.data?.place;
    if (!place) return;
    let targetTrip = tripsQ.data?.items?.[0];
    if (!targetTrip) {
      const created = await apiFetch<{ trip: Trip }>("/api/v1/trips", {
        method: "POST",
        body: JSON.stringify({
          title: `${place.state_code} Explorer Trip`,
          origin_text: "Guwahati",
          state_codes: [place.state_code],
          start_date: new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10),
          end_date: new Date(Date.now() + 10 * 86400_000).toISOString().slice(0, 10),
          party_size: 2,
          budget_inr: 20000,
        }),
      });
      targetTrip = created.trip;
    }
    await apiFetch(`/api/v1/trips/${targetTrip.id}/items`, {
      method: "POST",
      body: JSON.stringify({
        day_index: 1,
        type: "place",
        ref_id: place.id,
        google_place_id: place.google_place_id,
        title: place.name,
        lat: place.lat,
        lng: place.lng,
        payload: { notes: place.curated_notes },
      }),
    });
    setAddedMsg(`Added to "${targetTrip.title}"!`);
    setTimeout(() => router.push(`/trips/${targetTrip.id}`), 800);
  };

  if (placeQ.isLoading) {
    return (
      <AppShell>
        <div className="space-y-4">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-64" />
        </div>
      </AppShell>
    );
  }

  if (placeQ.isError || !placeQ.data) {
    return (
      <AppShell>
        <ErrorState message="Could not load place details." onRetry={() => placeQ.refetch()} />
      </AppShell>
    );
  }

  const pl = placeQ.data.place;

  return (
    <AppShell>
      <div className="space-y-5">
        <Link href="/explore" className="inline-flex items-center gap-1.5 text-sm font-semibold text-inkMuted hover:text-ink">
          <ArrowLeft className="w-4 h-4" />
          Back to Explore
        </Link>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-forest text-white">{pl.state_code}</span>
              {pl.categories.map((c) => (
                <span key={c} className="px-2.5 py-1 rounded-full text-xs font-medium bg-mutedSurface capitalize">
                  {c}
                </span>
              ))}
              {pl.permit_area_id && (
                <Link href={`/permits?state=${pl.state_code}&destination_id=${pl.id}`}>
                  <StatusBadge kind="applied" label="Check Permit Rules" />
                </Link>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">{pl.name}</h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleSave}>
              {saved ? <Check className="w-4 h-4 text-forest" /> : <Bookmark className="w-4 h-4" />}
              {saved ? "Saved" : "Save"}
            </Button>
            <Button onClick={handleAddToTrip}>
              <Plus className="w-4 h-4" />
              Add to Trip
            </Button>
          </div>
        </div>

        {addedMsg && (
          <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 text-sm font-semibold">
            {addedMsg} Opening timeline...
          </div>
        )}

        <NEMap
          pins={[{ id: pl.id, label: pl.name, lat: pl.lat, lng: pl.lng, highlight: true }]}
          center={{ lat: pl.lat, lng: pl.lng }}
          selectedId={pl.id}
          heightClass="h-[260px]"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5 md:col-span-2 space-y-4">
            <h2 className="text-lg font-bold">Curated Field Notes</h2>
            <p className="text-base leading-relaxed">{pl.curated_notes}</p>
            <div className="pt-2 border-t border-borderSubtle space-y-2 text-sm">
              <p className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-forest shrink-0 mt-1" />
                <span><strong>Hours:</strong> {pl.hours || "Daylight hours recommended"}</span>
              </p>
              <p className="flex items-start gap-2">
                <Navigation className="w-4 h-4 text-river shrink-0 mt-1" />
                <span><strong>How to reach:</strong> {pl.how_to_reach || "Accessible via state highway & shared taxis"}</span>
              </p>
              <p className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-teaGold shrink-0 mt-1" />
                <span><strong>Coordinates:</strong> {pl.lat.toFixed(4)}, {pl.lng.toFixed(4)}</span>
              </p>
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-forest" />
              Permits & Season
            </h2>
            <p className="text-sm text-inkMuted">
              Best months: {pl.best_months.join(", ")}
            </p>
            {pl.permit_area_name && (
              <p className="text-sm">
                <strong>Permit zone:</strong> {pl.permit_area_name}
              </p>
            )}
            <Link href={`/permits?state=${pl.state_code}&destination_id=${pl.id}`} className="block">
              <Button variant="secondary" className="w-full">
                Check My Permit Checklist
              </Button>
            </Link>
            <Link href={`/travel?to=${encodeURIComponent(pl.name)}`} className="block">
              <Button variant="ghost" className="w-full">
                Find Transport & Routes →
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
