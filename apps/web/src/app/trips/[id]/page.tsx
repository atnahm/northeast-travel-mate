"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Download,
  ExternalLink,
  GripVertical,
  Plus,
  Share2,
  TrainFront,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { NEMap } from "@/components/maps/NEMap";
import { Button, Card, Chip, ErrorState, Skeleton, StatusBadge, type BadgeKind } from "@/components/ui/Primitives";
import { cacheTripOffline, offlineDb } from "@/lib/offline/db";
import { apiFetch } from "@ne-mate/shared/api-client";
import type { LiveStatus, PermitTaskStatus, Trip, TripItem } from "@ne-mate/shared";
import { formatIstHHMM, todayIstDateString } from "@/lib/trains/local-data";

function shiftHHMM(hhmm: string | undefined, delayMin: number): string | null {
  if (!hhmm || delayMin <= 0) return null;
  const m = hhmm.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const total = (Number(m[1]) * 60 + Number(m[2]) + delayMin) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

type TabKey = "timeline" | "map" | "permits" | "budget" | "packing";

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>("timeline");
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState("");

  // Add item form
  const [newTitle, setNewTitle] = useState("");
  const [newDay, setNewDay] = useState(1);
  const [newType, setNewType] = useState<TripItem["type"]>("place");
  const [trainNoInput, setTrainNoInput] = useState("");

  // Add expense form
  const [expNote, setExpNote] = useState("");
  const [expAmount, setExpAmount] = useState(500);
  const [expPaidBy, setExpPaidBy] = useState("Me");

  const [cachedFallback, setCachedFallback] = useState<Trip | null>(null);

  useEffect(() => {
    offlineDb?.trips.get(id).then((t) => t && setCachedFallback(t)).catch(() => undefined);
  }, [id]);

  const tripQ = useQuery({
    queryKey: ["trip-detail", id],
    queryFn: async () => {
      const res = await apiFetch<{ trip: Trip }>(`/api/v1/trips/${id}`);
      await cacheTripOffline(res.trip).catch(() => undefined);
      return res.trip;
    },
    retry: false,
  });

  const trip = tripQ.data || cachedFallback;

  const trainItem = trip?.items?.find((it) => it.type === "train");
  const trainNum = String(trainItem?.payload?.train_number || "");
  const trainStartDate = String(trainItem?.payload?.start_date || todayIstDateString());
  const trainStatusQ = useQuery({
    queryKey: ["trip-train", trainNum, trainStartDate],
    queryFn: async () => {
      const r = await fetch(`/api/trains/${encodeURIComponent(trainNum)}/status?startDate=${encodeURIComponent(trainStartDate)}`);
      if (!r.ok) throw new Error("Could not fetch train status");
      return (await r.json()) as LiveStatus;
    },
    enabled: Boolean(trainItem && /^\d{5}$/.test(trainNum)),
  });

  const addItemMut = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/trips/${id}/items`, {
        method: "POST",
        body: JSON.stringify({
          day_index: newDay,
          type: newType,
          title: newTitle || (newType === "train" ? `Train ${trainNoInput}` : "Stop"),
          payload: newType === "train" ? { train_number: trainNoInput } : {},
        }),
      }),
    onSuccess: () => {
      setNewTitle("");
      qc.invalidateQueries({ queryKey: ["trip-detail", id] });
    },
  });

  const reorderMut = useMutation({
    mutationFn: (items: Array<{ id: string; day_index: number; position: number }>) =>
      apiFetch(`/api/v1/trips/${id}/reorder`, {
        method: "POST",
        body: JSON.stringify({ items }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trip-detail", id] }),
  });

  const permitMut = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: PermitTaskStatus }) =>
      apiFetch(`/api/v1/trip-permit-tasks/${id}/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trip-detail", id] }),
  });

  const expenseMut = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/trips/${id}/expenses`, {
        method: "POST",
        body: JSON.stringify({
          paid_by: expPaidBy,
          amount_inr: expAmount,
          category: "trip",
          note: expNote || "Trip expense",
          split_between: [expPaidBy, "Co-traveler"],
        }),
      }),
    onSuccess: () => {
      setExpNote("");
      qc.invalidateQueries({ queryKey: ["trip-detail", id] });
    },
  });

  const packMut = useMutation({
    mutationFn: ({ itemId, checked }: { itemId: string; checked: boolean }) =>
      apiFetch(`/api/v1/trips/${id}/packing/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ checked }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trip-detail", id] }),
  });

  const inviteMut = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/trips/${id}/members`, {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail, role: "editor" }),
      }),
    onSuccess: () => {
      setInviteMsg(`Invited ${inviteEmail}`);
      setInviteEmail("");
      qc.invalidateQueries({ queryKey: ["trip-detail", id] });
    },
  });

  const moveItem = (item: TripItem, delta: -1 | 1) => {
    if (!trip?.items) return;
    const dayItems = trip.items.filter((x) => x.day_index === item.day_index);
    const idx = dayItems.findIndex((x) => x.id === item.id);
    const swapIdx = idx + delta;
    if (swapIdx < 0 || swapIdx >= dayItems.length) return;
    const reordered = [...dayItems];
    const [removed] = reordered.splice(idx, 1);
    reordered.splice(swapIdx, 0, removed);
    reorderMut.mutate(reordered.map((x, i) => ({ id: x.id, day_index: x.day_index, position: i })));
  };

  const handleDropOnItem = (targetItem: TripItem) => {
    if (!dragItemId || dragItemId === targetItem.id || !trip?.items) return;
    const all = [...trip.items];
    const srcIdx = all.findIndex((x) => x.id === dragItemId);
    const dstIdx = all.findIndex((x) => x.id === targetItem.id);
    if (srcIdx === -1 || dstIdx === -1) return;
    const [moved] = all.splice(srcIdx, 1);
    moved.day_index = targetItem.day_index;
    all.splice(dstIdx, 0, moved);
    const sameDay = all.filter((x) => x.day_index === targetItem.day_index);
    reorderMut.mutate(sameDay.map((x, i) => ({ id: x.id, day_index: x.day_index, position: i })));
    setDragItemId(null);
  };

  if (tripQ.isLoading && !cachedFallback) {
    return (
      <AppShell>
        <Skeleton className="h-48" />
      </AppShell>
    );
  }

  if (!trip) {
    return (
      <AppShell>
        <ErrorState message="Trip not found or unavailable offline." onRetry={() => tripQ.refetch()} />
      </AppShell>
    );
  }

  const mapPins = (trip.items || [])
    .filter((it) => it.lat && it.lng)
    .map((it) => ({
      id: it.id,
      label: it.title,
      lat: it.lat!,
      lng: it.lng!,
    }));

  const routePath = mapPins.map((p) => ({ lat: p.lat, lng: p.lng }));

  return (
    <AppShell>
      <div className="space-y-5">
        <Link href="/trips" className="inline-flex items-center gap-1.5 text-sm font-semibold text-inkMuted hover:text-ink">
          <ArrowLeft className="w-4 h-4" />
          All Trips
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge kind="approved" label={trip.status} />
              <span className="text-xs text-inkMuted">v{trip.version}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">{trip.title}</h1>
            <p className="text-sm text-inkMuted">
              {trip.start_date} → {trip.end_date} • Origin: {trip.origin_text} • {trip.party_size} traveler(s)
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                await cacheTripOffline(trip);
                setOfflineSaved(true);
              }}
            >
              {offlineSaved ? <CheckCircle2 className="w-4 h-4 text-forest" /> : <Download className="w-4 h-4" />}
              {offlineSaved ? "Saved Offline" : "Download Offline"}
            </Button>
          </div>
        </div>

        {/* Invite Co-Traveler Strip */}
        <Card className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            <Share2 className="w-4 h-4 text-river" />
            <span className="font-semibold">Group Trip:</span>
            <span className="text-inkMuted">Invite co-traveler by email</span>
          </div>
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="friend@example.com"
              className="rounded-xl border border-borderSubtle bg-canvas px-3 py-1.5 text-sm min-h-[40px]"
            />
            <Button variant="secondary" onClick={() => inviteMut.mutate()} disabled={!inviteEmail.trim()}>
              Invite
            </Button>
          </div>
        </Card>
        {inviteMsg && <p className="text-xs font-semibold text-forest">{inviteMsg}</p>}

        {/* 5 Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(["timeline", "map", "permits", "budget", "packing"] as const).map((k) => (
            <Chip key={k} active={tab === k} onClick={() => setTab(k)} className="capitalize">
              {k}
            </Chip>
          ))}
        </div>

        {tab === "timeline" && (
          <div className="space-y-4">
            {/* Inline Live Train Tracker inside Trip */}
            {trainItem && trainStatusQ.data && (
              <Card className="p-4 border-river/50 bg-statusVerifiedBg/40 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 font-bold text-sm">
                    <TrainFront className="w-4 h-4 text-river" />
                    Train {trainStatusQ.data.trainNo}
                    {trainStatusQ.data.trainName ? ` — ${trainStatusQ.data.trainName}` : ""}
                  </span>
                  <StatusBadge
                    kind={
                      trainStatusQ.data.state === "cancelled"
                        ? "cancelled"
                        : trainStatusQ.data.state === "unavailable"
                        ? "unavailable"
                        : trainStatusQ.data.delayMin === 0
                        ? "approved"
                        : "applied"
                    }
                    label={
                      trainStatusQ.data.state === "cancelled"
                        ? "Cancelled"
                        : trainStatusQ.data.state === "unavailable"
                        ? "Status unavailable"
                        : trainStatusQ.data.delayMin === 0
                        ? "On time"
                        : `Late ${trainStatusQ.data.delayMin} min`
                    }
                  />
                </div>
                <p className="text-xs text-inkMuted">
                  {trainStatusQ.data.message ||
                    (trainStatusQ.data.currentStationCode
                      ? `Last reported at ${trainStatusQ.data.currentStationCode} · Next: ${trainStatusQ.data.nextStationCode || "—"}`
                      : "Confirm live status with Indian Railways before departure.")}
                </p>
                <p className="text-[11px] text-inkMuted">
                  Source: {trainStatusQ.data.provider} · Updated {formatIstHHMM(trainStatusQ.data.fetchedAt)} IST
                </p>
              </Card>
            )}

            {/* Add Timeline Item */}
            <Card className="p-4 flex flex-col md:flex-row gap-2">
              <select
                value={newDay}
                onChange={(e) => setNewDay(Number(e.target.value))}
                className="rounded-xl border border-borderSubtle bg-canvas px-3 py-2 min-h-[44px]"
              >
                {(trip.days || [{ day_index: 1 }]).map((d) => (
                  <option key={d.day_index} value={d.day_index}>
                    Day {d.day_index}
                  </option>
                ))}
              </select>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as TripItem["type"])}
                className="rounded-xl border border-borderSubtle bg-canvas px-3 py-2 min-h-[44px]"
              >
                <option value="place">Place</option>
                <option value="travel_leg">Travel Leg</option>
                <option value="train">Train Leg</option>
                <option value="stay">Stay</option>
                <option value="meal">Meal</option>
                <option value="note">Note</option>
              </select>
              {newType === "train" ? (
                <input
                  value={trainNoInput}
                  onChange={(e) => setTrainNoInput(e.target.value)}
                  placeholder="Train No (e.g. 12067)"
                  className="flex-1 rounded-xl border border-borderSubtle bg-canvas px-3 py-2 min-h-[44px]"
                />
              ) : (
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Add stop, homestay, Sumo leg, or meal..."
                  className="flex-1 rounded-xl border border-borderSubtle bg-canvas px-3 py-2 min-h-[44px]"
                />
              )}
              <Button onClick={() => addItemMut.mutate()} disabled={addItemMut.isPending}>
                <Plus className="w-4 h-4" />
                Add
              </Button>
            </Card>

            {/* Day-by-day cards */}
            {(trip.days || []).map((day) => {
              const items = (trip.items || []).filter((it) => it.day_index === day.day_index);
              return (
                <Card key={day.day_index} className="p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-borderSubtle pb-2">
                    <h2 className="font-bold text-lg">
                      Day {day.day_index} {day.date ? `• ${day.date}` : ""}
                    </h2>
                    <span className="text-xs text-inkMuted">{items.length} item(s)</span>
                  </div>

                  {items.length === 0 ? (
                    <p className="text-sm text-inkMuted">No items on Day {day.day_index} yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {items.map((it, idx) => {
                        const trainIdx = items.findIndex((x) => x.id === trainItem?.id);
                        const activeDelay =
                          trainIdx !== -1 && idx > trainIdx && (trainStatusQ.data?.delayMin || 0) > 0
                            ? Number(trainStatusQ.data?.delayMin)
                            : 0;
                        const shiftedTime = shiftHHMM(it.start_time, activeDelay);
                        return (
                          <div
                            key={it.id}
                            draggable
                            onDragStart={() => setDragItemId(it.id)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleDropOnItem(it)}
                            className="flex items-center justify-between gap-3 rounded-xl border border-borderSubtle bg-canvas p-3 cursor-grab active:cursor-grabbing"
                          >
                            <div className="flex items-start gap-2.5">
                              <GripVertical className="w-4 h-4 text-inkMuted mt-1 shrink-0" />
                              <div>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-forest">
                                  {it.type.replace("_", " ")}
                                  {shiftedTime
                                    ? ` • ${shiftedTime} (shifted +${activeDelay}m)`
                                    : it.start_time
                                    ? ` • ${it.start_time}`
                                    : ""}
                                </span>
                                <p className="font-semibold text-sm">{it.title}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => moveItem(it, -1)}
                                className="p-2 rounded-lg hover:bg-mutedSurface"
                                aria-label="Move item up"
                              >
                                <ArrowUp className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveItem(it, 1)}
                                className="p-2 rounded-lg hover:bg-mutedSurface"
                                aria-label="Move item down"
                              >
                                <ArrowDown className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {tab === "map" && (
          <NEMap pins={mapPins} routePath={routePath} heightClass="h-[420px]" />
        )}

        {tab === "permits" && (
          <div className="space-y-3">
            {(trip.permit_tasks || []).length === 0 ? (
              <Card className="p-5 text-sm text-inkMuted">
                No mandatory state entry permits flagged for this itinerary. Still carry valid Photo ID.
              </Card>
            ) : (
              (trip.permit_tasks || []).map((pt) => (
                <Card key={pt.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge kind={pt.status as BadgeKind} />
                      <span className="text-xs font-semibold text-inkMuted">{pt.state_code}</span>
                    </div>
                    <h3 className="font-bold">{pt.permit_name}</h3>
                    <p className="text-xs text-inkMuted">Last verified: {pt.last_verified_at?.slice(0, 10) || "Check portal"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={pt.status}
                      onChange={(e) => permitMut.mutate({ taskId: pt.id, status: e.target.value as PermitTaskStatus })}
                      className="rounded-xl border border-borderSubtle bg-canvas px-3 py-2 text-sm min-h-[44px]"
                    >
                      <option value="not_started">Not started</option>
                      <option value="applied">Applied</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="expired">Expired</option>
                    </select>
                    {pt.portal_url && (
                      <a
                        href={pt.portal_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-forest text-white text-sm font-semibold min-h-[44px]"
                      >
                        Portal <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {tab === "budget" && (
          <div className="space-y-4">
            {trip.budget_summary && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="p-4">
                  <p className="text-xs text-inkMuted">Estimated Total</p>
                  <p className="text-2xl font-bold text-forest">
                    ₹{trip.budget_summary.estimated_total_inr.toLocaleString("en-IN")}
                  </p>
                  <p className="text-xs text-inkMuted">
                    ₹{trip.budget_summary.per_person_estimated_inr.toLocaleString("en-IN")} / person
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-inkMuted">Target Budget</p>
                  <p className="text-2xl font-bold">₹{trip.budget_summary.target_budget_inr.toLocaleString("en-IN")}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-inkMuted">Logged Expenses</p>
                  <p className="text-2xl font-bold text-river">
                    ₹{trip.budget_summary.logged_expenses_inr.toLocaleString("en-IN")}
                  </p>
                </Card>
              </div>
            )}

            <Card className="p-4 space-y-3">
              <h3 className="font-bold flex items-center gap-2">
                <Wallet className="w-4 h-4 text-forest" />
                Log & Split Expense
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  value={expNote}
                  onChange={(e) => setExpNote(e.target.value)}
                  placeholder="Shared Sumo / Lunch / Homestay"
                  className="sm:col-span-2 rounded-xl border border-borderSubtle bg-canvas px-3 py-2 min-h-[44px]"
                />
                <input
                  type="number"
                  value={expAmount}
                  onChange={(e) => setExpAmount(Number(e.target.value))}
                  className="rounded-xl border border-borderSubtle bg-canvas px-3 py-2 min-h-[44px]"
                />
                <input
                  value={expPaidBy}
                  onChange={(e) => setExpPaidBy(e.target.value)}
                  placeholder="Paid by"
                  className="rounded-xl border border-borderSubtle bg-canvas px-3 py-2 min-h-[44px]"
                />
              </div>
              <Button onClick={() => expenseMut.mutate()} disabled={expenseMut.isPending}>
                Add Expense
              </Button>
            </Card>

            <div className="space-y-2">
              {(trip.expenses || []).map((ex) => (
                <Card key={ex.id} className="p-3.5 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-semibold">{ex.note}</p>
                    <p className="text-xs text-inkMuted">
                      Paid by {ex.paid_by} • Split ({ex.split_between?.length || 1} ways)
                    </p>
                  </div>
                  <span className="font-bold">₹{ex.amount_inr}</span>
                </Card>
              ))}
            </div>
          </div>
        )}

        {tab === "packing" && (
          <Card className="p-4 space-y-2.5">
            {(trip.packing || []).map((pk) => (
              <label key={pk.id} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-mutedSurface cursor-pointer">
                <input
                  type="checkbox"
                  checked={pk.checked}
                  onChange={(e) => packMut.mutate({ itemId: pk.id, checked: e.target.checked })}
                  className="mt-1 w-5 h-5 accent-forest"
                />
                <div>
                  <span className="text-[11px] uppercase font-bold text-inkMuted">{pk.category}</span>
                  <p className={`text-sm font-medium ${pk.checked ? "line-through text-inkMuted" : ""}`}>{pk.label}</p>
                </div>
              </label>
            ))}
          </Card>
        )}
      </div>
    </AppShell>
  );
}
