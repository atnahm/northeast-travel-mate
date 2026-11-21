"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AlertTriangle, Bus, Car, CheckCircle2, MapPin, Plane, Ship, TrainFront } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { NEMap } from "@/components/maps/NEMap";
import { Button, Card, StatusBadge } from "@/components/ui/Primitives";
import { TrainsSection } from "@/components/trains/TrainsSection";
import { useAppStore } from "@/lib/store/app-store";
import { t } from "@/lib/i18n/translations";
import { apiFetch } from "@ne-mate/shared/api-client";
import type { TransportOption } from "@ne-mate/shared";

interface NodeItem {
  id: string;
  name: string;
  code: string;
  type: string;
  state_code: string;
  lat: number;
  lng: number;
}

const MODE_ICON: Record<string, React.ReactNode> = {
  shared_sumo: <Car className="w-5 h-5 text-forest" />,
  self_drive: <Car className="w-5 h-5 text-river" />,
  bus: <Bus className="w-5 h-5 text-forest" />,
  train: <TrainFront className="w-5 h-5 text-river" />,
  flight: <Plane className="w-5 h-5 text-teaGold" />,
  ferry: <Ship className="w-5 h-5 text-river" />,
};

export default function TravelPage() {
  const lang = useAppStore((s) => s.lang);
  const [tab, setTab] = useState<"trains" | "routes">("trains");
  const [fromName, setFromName] = useState("Guwahati");
  const [toName, setToName] = useState("Shillong");
  const [travelDate, setTravelDate] = useState(new Date().toISOString().slice(0, 10));
  const [pickTarget, setPickTarget] = useState<"from" | "to" | null>(null);
  const [pickedFrom, setPickedFrom] = useState<{ lat: number; lng: number } | null>(null);
  const [pickedTo, setPickedTo] = useState<{ lat: number; lng: number } | null>(null);

  const nodesQ = useQuery({
    queryKey: ["transport-nodes", lang],
    queryFn: () => apiFetch<{ items: NodeItem[] }>(`/api/v1/transport/nodes?lang=${lang}`),
  });

  const optionsMut = useMutation({
    mutationFn: () =>
      apiFetch<{
        origin: { name: string; lat: number; lng: number } | null;
        destination: { name: string; lat: number; lng: number } | null;
        route: { distance_km: number; duration_min: number; path: Array<{ lat: number; lng: number }> } | null;
        options: TransportOption[];
      }>("/api/v1/travel/options", {
        method: "POST",
        body: JSON.stringify({
          from_name: fromName,
          to_name: toName,
          from_lat: pickedFrom?.lat,
          from_lng: pickedFrom?.lng,
          to_lat: pickedTo?.lat,
          to_lng: pickedTo?.lng,
          date: travelDate,
        }),
      }),
  });

  const pins = (nodesQ.data?.items || []).map((n) => ({
    id: n.id,
    label: `${n.name} (${n.code})`,
    lat: n.lat,
    lng: n.lng,
  }));

  const routePath = optionsMut.data?.route?.path;

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{t(lang, "travelTitle")}</h1>
            <p className="text-sm text-inkMuted">{t(lang, "travelSubtitle")}</p>
          </div>
          {/* Segmented Control: Trains | Route Planner */}
          <div
            role="tablist"
            aria-label="Travel mode"
            className="inline-flex rounded-xl border border-borderSubtle bg-mutedSurface p-1 self-start sm:self-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "trains"}
              onClick={() => setTab("trains")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 min-h-[40px] text-sm font-semibold transition-colors ${
                tab === "trains" ? "bg-forest text-onPrimary shadow-sm" : "text-inkMuted hover:text-ink"
              }`}
            >
              <TrainFront className="w-4 h-4" aria-hidden="true" />
              {t(lang, "tabTrains")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "routes"}
              onClick={() => setTab("routes")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 min-h-[40px] text-sm font-semibold transition-colors ${
                tab === "routes" ? "bg-forest text-onPrimary shadow-sm" : "text-inkMuted hover:text-ink"
              }`}
            >
              {t(lang, "tabRoutePlanner")}
            </button>
          </div>
        </div>

        {tab === "routes" ? (
          <>
            <Card className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">From</label>
                  <div className="flex gap-2">
                    <input
                      value={fromName}
                      onChange={(e) => {
                        setFromName(e.target.value);
                        setPickedFrom(null);
                      }}
                      placeholder="Guwahati, Dimapur, NJP..."
                      className="flex-1 rounded-xl border border-borderSubtle bg-canvas px-3 py-2.5 min-h-[48px]"
                    />
                    <Button
                      variant={pickTarget === "from" ? "primary" : "secondary"}
                      onClick={() => setPickTarget(pickTarget === "from" ? null : "from")}
                      title="Pick origin on map"
                    >
                      <MapPin className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">To</label>
                  <div className="flex gap-2">
                    <input
                      value={toName}
                      onChange={(e) => {
                        setToName(e.target.value);
                        setPickedTo(null);
                      }}
                      placeholder="Shillong, Kohima, Tawang, Majuli..."
                      className="flex-1 rounded-xl border border-borderSubtle bg-canvas px-3 py-2.5 min-h-[48px]"
                    />
                    <Button
                      variant={pickTarget === "to" ? "primary" : "secondary"}
                      onClick={() => setPickTarget(pickTarget === "to" ? null : "to")}
                      title="Pick destination on map"
                    >
                      <MapPin className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Travel Date</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={travelDate}
                      onChange={(e) => setTravelDate(e.target.value)}
                      className="flex-1 rounded-xl border border-borderSubtle bg-canvas px-3 py-2.5 min-h-[48px]"
                    />
                    <Button onClick={() => optionsMut.mutate()} disabled={optionsMut.isPending}>
                      {optionsMut.isPending ? "Searching..." : "Find"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="text-inkMuted self-center">Popular corridors:</span>
                {[
                  ["Guwahati", "Shillong"],
                  ["Guwahati", "Tawang"],
                  ["Guwahati", "Dimapur"],
                  ["Nimati Ghat", "Kamalabari"],
                  ["NJP", "Gangtok"],
                ].map(([f, dest]) => (
                  <button
                    key={`${f}-${dest}`}
                    type="button"
                    onClick={() => {
                      setFromName(f);
                      setToName(dest);
                    }}
                    className="px-2.5 py-1 rounded-full bg-mutedSurface hover:bg-forest/15 font-medium"
                  >
                    {f} → {dest}
                  </button>
                ))}
              </div>
            </Card>

            <NEMap
              pins={pins}
              routePath={routePath}
              pickMode={pickTarget !== null}
              onPickCoordinate={(coord) => {
                if (pickTarget === "from") {
                  setPickedFrom(coord);
                  setFromName(`${coord.lat}, ${coord.lng}`);
                } else if (pickTarget === "to") {
                  setPickedTo(coord);
                  setToName(`${coord.lat}, ${coord.lng}`);
                }
                setPickTarget(null);
              }}
              heightClass="h-[260px]"
            />

            {optionsMut.data && (
              <div className="space-y-3">
                {optionsMut.data.route && (
                  <p className="text-sm font-semibold text-inkMuted">
                    Estimated road distance: <span className="text-ink">{optionsMut.data.route.distance_km} km</span> • Typical hill drive:{" "}
                    <span className="text-ink">{Math.round(optionsMut.data.route.duration_min / 60)}h {optionsMut.data.route.duration_min % 60}m</span>
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {optionsMut.data.options.map((opt) => (
                    <Card key={opt.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-mutedSurface">{MODE_ICON[opt.mode] || <Car className="w-5 h-5" />}</div>
                          <div>
                            <p className="font-bold capitalize">{opt.mode.replace("_", " ")}</p>
                            <p className="text-xs text-inkMuted">{opt.operator}</p>
                          </div>
                        </div>
                        <StatusBadge kind="verified" label={opt.last_verified_at.slice(0, 10)} />
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-sm bg-mutedSurface/60 rounded-xl p-2.5">
                        <div>
                          <p className="text-xs text-inkMuted">Duration</p>
                          <p className="font-bold">
                            {Math.floor(opt.typical_duration_min / 60)}h {opt.typical_duration_min % 60}m
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-inkMuted">Distance</p>
                          <p className="font-bold">{opt.distance_km ?? "--"} km</p>
                        </div>
                        <div>
                          <p className="text-xs text-inkMuted">Est. Fare</p>
                          <p className="font-bold">
                            ₹{opt.fare_min_inr}–{opt.fare_max_inr}
                          </p>
                        </div>
                      </div>

                      <p className="text-xs text-inkMuted">{opt.schedule_text}</p>

                      {opt.permit_checkpoints && opt.permit_checkpoints.length > 0 && (
                        <p className="text-xs flex items-start gap-1.5 text-forest font-medium">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>Checkpoints: {opt.permit_checkpoints.join(", ")}</span>
                        </p>
                      )}

                      {opt.warnings && opt.warnings.length > 0 && (
                        <p className="text-xs flex items-start gap-1.5 text-sunrise">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>{opt.warnings.join(" ")}</span>
                        </p>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <TrainsSection />
        )}
      </div>
    </AppShell>
  );
}
