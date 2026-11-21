"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Map as MapIcon, Plus, Sparkles, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button, Card, EmptyState, ErrorState, Skeleton, StatusBadge } from "@/components/ui/Primitives";
import { useAppStore } from "@/lib/store/app-store";
import { offlineDb } from "@/lib/offline/db";
import { apiFetch } from "@ne-mate/shared/api-client";
import type { NEState, Trip } from "@ne-mate/shared";

export default function TripsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const lang = useAppStore((s) => s.lang);
  const isOnline = useAppStore((s) => s.isOnline);
  const [showPlanForm, setShowPlanForm] = useState(false);

  const [destState, setDestState] = useState("ML");
  const [days, setDays] = useState(5);
  const [origin, setOrigin] = useState("Guwahati");
  const [budget, setBudget] = useState(25000);
  const [partySize, setPartySize] = useState(2);
  const [startDate, setStartDate] = useState(new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10));
  const [offlineTrips, setOfflineTrips] = useState<Trip[]>([]);

  useEffect(() => {
    offlineDb?.trips.toArray().then(setOfflineTrips).catch(() => undefined);
  }, []);

  const statesQ = useQuery({
    queryKey: ["states-trips", lang],
    queryFn: () => apiFetch<{ items: NEState[] }>(`/api/v1/states?lang=${lang}`),
  });

  const tripsQ = useQuery({
    queryKey: ["trips-list"],
    queryFn: () => apiFetch<{ items: Trip[] }>("/api/v1/trips"),
    retry: false,
  });

  const generateMut = useMutation({
    mutationFn: () =>
      apiFetch<{ trip: Trip }>("/api/v1/trips/generate", {
        method: "POST",
        body: JSON.stringify({
          destination_state: destState,
          days,
          start_date: startDate,
          origin,
          budget_inr: budget,
          party_size: partySize,
          interests: ["nature", "culture", "food"],
        }),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["trips-list"] });
      router.push(`/trips/${res.trip.id}`);
    },
  });

  const displayedTrips = isOnline && tripsQ.data ? tripsQ.data.items : offlineTrips;

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Your Trips</h1>
            <p className="text-sm text-inkMuted">Plan day-by-day itineraries, track permits, split expenses, and save for offline travel.</p>
          </div>
          <Button onClick={() => setShowPlanForm((v) => !v)}>
            <Plus className="w-4 h-4" />
            {showPlanForm ? "Close Form" : "Plan my trip"}
          </Button>
        </div>

        {showPlanForm && (
          <Card className="p-5 space-y-4 border-forest/40">
            <div className="flex items-center gap-2 font-bold text-lg">
              <Sparkles className="w-5 h-5 text-teaGold" />
              <span>Generate Editable Draft Trip</span>
            </div>

            {generateMut.isError && (
              <div className="p-3 rounded-xl bg-sunrise/10 text-sunrise text-sm font-medium">
                {(generateMut.error as Error).message}. Sign in via{" "}
                <Link href="/onboarding" className="underline font-bold">
                  Onboarding
                </Link>{" "}
                first to save trips to your account.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label htmlFor="trip-state" className="block text-xs font-semibold mb-1">
                  Destination State
                </label>
                <select
                  id="trip-state"
                  value={destState}
                  onChange={(e) => setDestState(e.target.value)}
                  className="w-full rounded-xl border border-borderSubtle bg-canvas px-3 py-2.5 min-h-[48px]"
                >
                  {(statesQ.data?.items || []).map((st) => (
                    <option key={st.code} value={st.code}>
                      {st.name} ({st.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="trip-origin" className="block text-xs font-semibold mb-1">
                  Origin City
                </label>
                <input
                  id="trip-origin"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className="w-full rounded-xl border border-borderSubtle bg-canvas px-3 py-2.5 min-h-[48px]"
                />
              </div>
              <div>
                <label htmlFor="trip-start" className="block text-xs font-semibold mb-1">
                  Start Date
                </label>
                <input
                  id="trip-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-borderSubtle bg-canvas px-3 py-2.5 min-h-[48px]"
                />
              </div>
              <div>
                <label htmlFor="trip-days" className="block text-xs font-semibold mb-1">
                  Duration (days)
                </label>
                <input
                  id="trip-days"
                  type="number"
                  min={1}
                  max={21}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="w-full rounded-xl border border-borderSubtle bg-canvas px-3 py-2.5 min-h-[48px]"
                />
              </div>
              <div>
                <label htmlFor="trip-party" className="block text-xs font-semibold mb-1">
                  Travelers
                </label>
                <input
                  id="trip-party"
                  type="number"
                  min={1}
                  max={20}
                  value={partySize}
                  onChange={(e) => setPartySize(Number(e.target.value))}
                  className="w-full rounded-xl border border-borderSubtle bg-canvas px-3 py-2.5 min-h-[48px]"
                />
              </div>
              <div>
                <label htmlFor="trip-budget" className="block text-xs font-semibold mb-1">
                  Target Budget (INR)
                </label>
                <input
                  id="trip-budget"
                  type="number"
                  min={2000}
                  step={1000}
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="w-full rounded-xl border border-borderSubtle bg-canvas px-3 py-2.5 min-h-[48px]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button onClick={() => generateMut.mutate()} disabled={generateMut.isPending}>
                {generateMut.isPending ? "Building itinerary..." : "Create Draft Itinerary"}
              </Button>
            </div>
          </Card>
        )}

        {tripsQ.isLoading && isOnline && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        )}

        {tripsQ.isError && isOnline && offlineTrips.length === 0 && (
          <ErrorState
            message="Sign in to view and sync your cloud trips, or generate your first itinerary."
            onRetry={() => router.push("/onboarding")}
          />
        )}

        {!tripsQ.isLoading && displayedTrips.length === 0 && !tripsQ.isError && (
          <EmptyState
            icon={<MapIcon className="w-7 h-7" />}
            title="No trips planned yet"
            description="Start with the guided form above or ask NE Mate AI to draft a custom North-East itinerary."
            action={
              <div className="flex gap-2">
                <Button onClick={() => setShowPlanForm(true)}>Plan my trip</Button>
                <Link href="/chat">
                  <Button variant="secondary">Ask Mate AI</Button>
                </Link>
              </div>
            }
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedTrips.map((tr) => (
            <Link key={tr.id} href={`/trips/${tr.id}`}>
              <Card className="p-5 h-full hover:border-forest transition-colors flex flex-col justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge kind={tr.status === "completed" ? "approved" : "applied"} label={tr.status} />
                    <span className="text-xs font-semibold text-inkMuted">
                      {tr.state_codes?.join(", ") || "NE India"}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold">{tr.title}</h2>
                  <p className="text-sm text-inkMuted flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {tr.start_date} → {tr.end_date}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {tr.party_size}
                    </span>
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs font-semibold pt-2 border-t border-borderSubtle">
                  <span>Budget ₹{tr.budget_inr.toLocaleString("en-IN")}</span>
                  <span className="text-river">Open Planner →</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
