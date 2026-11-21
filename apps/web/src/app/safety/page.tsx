"use client";

import React, { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Clock, Hospital, MapPin, Phone, Plus, Share2, ShieldAlert, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { NEMap } from "@/components/maps/NEMap";
import { Button, Card } from "@/components/ui/Primitives";
import { useAppStore } from "@/lib/store/app-store";
import { apiFetch } from "@ne-mate/shared/api-client";
import type { AlertItem } from "@ne-mate/shared";

interface Helpline {
  id: string;
  state_code: string;
  state_name: string;
  emergency: string;
  police: string;
  ambulance: string;
  tourist_helpline: string;
  disaster_helpline: string;
}

interface NearbySafe {
  id: string;
  name: string;
  kind: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  distance_km: number;
}

const HOLD_DURATION_MS = 2000;

export default function SafetyPage() {
  const lang = useAppStore((s) => s.lang);
  const qc = useQueryClient();
  const [coords, setCoords] = useState({ lat: 26.1445, lng: 91.7362 });
  const [checkInSec, setCheckInSec] = useState<number | null>(null);
  const [shareLink, setShareLink] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Press-and-hold -> 3s cancellable countdown -> direct tel:112
  const [holdPct, setHoldPct] = useState(0);
  const [sosCountdown, setSosCountdown] = useState<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => undefined
      );
    }
  }, []);

  useEffect(() => {
    if (checkInSec === null || checkInSec <= 0) return;
    const t = setInterval(() => {
      setCheckInSec((s) => (s !== null && s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [checkInSec]);

  useEffect(() => {
    if (sosCountdown === null) return;
    if (sosCountdown <= 0) {
      setSosCountdown(null);
      window.location.href = "tel:112";
      return;
    }
    const timer = window.setTimeout(() => {
      setSosCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [sosCountdown]);

  const startHold = () => {
    if (holdTimerRef.current) window.clearInterval(holdTimerRef.current);
    const started = Date.now();
    if ("vibrate" in navigator) navigator.vibrate(40);
    holdTimerRef.current = window.setInterval(() => {
      const pct = Math.min(100, Math.round(((Date.now() - started) / HOLD_DURATION_MS) * 100));
      setHoldPct(pct);
      if (pct >= 100) {
        if (holdTimerRef.current) window.clearInterval(holdTimerRef.current);
        holdTimerRef.current = null;
        setHoldPct(0);
        if ("vibrate" in navigator) navigator.vibrate([180, 80, 180]);
        setSosCountdown(3);
      }
    }, 40);
  };

  const cancelHold = () => {
    if (holdTimerRef.current) {
      window.clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setHoldPct(0);
  };

  const alertsQ = useQuery({
    queryKey: ["safety-alerts", lang],
    queryFn: () => apiFetch<{ items: AlertItem[] }>(`/api/v1/alerts?lang=${lang}`),
  });

  const helplinesQ = useQuery({
    queryKey: ["safety-helplines"],
    queryFn: () => apiFetch<{ items: Helpline[] }>("/api/v1/safety/helplines"),
  });

  const nearbyQ = useQuery({
    queryKey: ["safety-nearby", coords.lat, coords.lng],
    queryFn: () => apiFetch<{ items: NearbySafe[] }>(`/api/v1/safety/nearby?lat=${coords.lat}&lng=${coords.lng}`),
  });

  const contactsQ = useQuery({
    queryKey: ["safety-contacts"],
    queryFn: () => apiFetch<{ items: Array<{ id: string; name: string; phone: string; relation: string }> }>("/api/v1/safety/contacts"),
    retry: false,
  });

  const addContactMut = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/safety/contacts", {
        method: "POST",
        body: JSON.stringify({ name: contactName, phone: contactPhone, relation: "Family" }),
      }),
    onSuccess: () => {
      setContactName("");
      setContactPhone("");
      qc.invalidateQueries({ queryKey: ["safety-contacts"] });
    },
  });

  const delContactMut = useMutation({
    mutationFn: (cid: string) => apiFetch(`/api/v1/safety/contacts/${cid}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["safety-contacts"] }),
  });

  const shareLocation = async () => {
    try {
      const res = await apiFetch<{ share_url: string; expires_at: string }>("/api/v1/safety/share-location", {
        method: "POST",
        body: JSON.stringify({ lat: coords.lat, lng: coords.lng, note: "Live check-in from NE Mate" }),
      });
      setShareLink(`${window.location.origin}${res.share_url}`);
    } catch {
      setShareLink(`https://maps.google.com/?q=${coords.lat},${coords.lng}`);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <AppShell>
      {/* SOS Countdown Modal */}
      {sosCountdown !== null && (
        <div
          className="fixed inset-0 z-[50] bg-black/70 flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="sos-modal-title"
        >
          <Card className="max-w-sm w-full p-6 text-center space-y-4 border-2 border-sunrise">
            <ShieldAlert className="w-12 h-12 text-sunrise mx-auto" />
            <h2 id="sos-modal-title" className="text-2xl font-bold">
              Calling 112 in {sosCountdown}s
            </h2>
            <p className="text-sm text-inkMuted">
              Emergency call to India&apos;s 112 helpline will start automatically unless cancelled.
            </p>
            <div className="flex flex-col gap-2">
              <Button variant="secondary" className="w-full" onClick={() => setSosCountdown(null)}>
                <X className="w-5 h-5" />
                Cancel Emergency Call
              </Button>
              <a
                href="tel:112"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-sunrise text-onAlert px-4 py-3 min-h-[48px] font-bold"
              >
                <Phone className="w-5 h-5" />
                Call 112 Immediately
              </a>
            </div>
          </Card>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-sunrise">
              <ShieldAlert className="w-7 h-7" />
              Safety, Alerts & SOS
            </h1>
            <p className="text-sm text-inkMuted">
              Press and hold SOS (2s) for a cancellable 112 call, view nearest hospitals/police, or share live location.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onPointerDown={startHold}
              onPointerUp={cancelHold}
              onPointerLeave={cancelHold}
              onPointerCancel={cancelHold}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSosCountdown(3);
                }
              }}
              aria-label="Hold for 2 seconds to start 112 emergency countdown"
              className="relative overflow-hidden inline-flex items-center justify-center gap-2 rounded-xl bg-sunrise text-onAlert px-5 py-3 min-h-[48px] font-bold shadow-fab select-none"
            >
              <span
                className="absolute inset-y-0 left-0 bg-black/25 transition-all duration-75"
                style={{ width: `${holdPct}%` }}
                aria-hidden="true"
              />
              <Phone className="w-5 h-5 relative z-10" />
              <span className="relative z-10">
                {holdPct > 0 ? `Hold... ${holdPct}%` : "Hold 2s for SOS (112)"}
              </span>
            </button>

            <Button variant="secondary" onClick={shareLocation}>
              <Share2 className="w-4 h-4 text-river" />
              Share Live Location
            </Button>
          </div>
        </div>

        {shareLink && (
          <Card className="p-4 border-river bg-statusVerifiedBg/60 text-sm">
            <strong>Live location link ready to share with family:</strong>{" "}
            <span className="font-mono break-all">{shareLink}</span>
          </Card>
        )}

        {/* Check-in Safety Timer */}
        <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-forest" />
            <div>
              <p className="font-bold">Trek / Hill-Drive Check-In Timer</p>
              <p className="text-xs text-inkMuted">
                {checkInSec === null
                  ? "Set a countdown before entering low-network passes."
                  : checkInSec === 0
                  ? "Check-in overdue! Tap I'm Safe or contact your family."
                  : `Remaining: ${formatTimer(checkInSec)}`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setCheckInSec(1800)}>30 min</Button>
            <Button variant="secondary" onClick={() => setCheckInSec(3600)}>60 min</Button>
            {checkInSec !== null && (
              <Button onClick={() => setCheckInSec(null)}>I&apos;m Safe (Reset)</Button>
            )}
          </div>
        </Card>

        {/* Active Road & Weather Alerts */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-sunrise" />
            Verified Road & Weather Alerts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(alertsQ.data?.items || []).map((al) => (
              <Card key={al.id} className="p-4 border-sunrise/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-statusCheckBg text-statusCheckFg border border-sunrise/40">
                    {al.state_code} • {al.kind.toUpperCase()}
                  </span>
                  <span className="text-xs text-inkMuted">{al.last_verified_at?.slice(0, 10)}</span>
                </div>
                <h3 className="font-bold text-sm">{al.title}</h3>
                <p className="text-xs text-inkMuted">{al.body}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Nearest Hospitals & Police Map */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Hospital className="w-5 h-5 text-river" />
            Nearest Hospitals & Police Stations
          </h2>
          <NEMap
            pins={(nearbyQ.data?.items || []).map((n) => ({
              id: n.id,
              label: `${n.name} (${n.kind})`,
              lat: n.lat,
              lng: n.lng,
              category: n.kind,
            }))}
            center={coords}
            heightClass="h-[260px]"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(nearbyQ.data?.items || []).map((item) => (
              <Card key={item.id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase text-river">{item.kind} • {item.distance_km} km</span>
                  <p className="font-bold text-sm">{item.name}</p>
                  <p className="text-xs text-inkMuted flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {item.address}
                  </p>
                </div>
                <a
                  href={`tel:${item.phone}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-forest text-onPrimary px-3.5 py-2.5 text-sm font-semibold min-h-[44px] shrink-0"
                >
                  <Phone className="w-4 h-4" /> Call
                </a>
              </Card>
            ))}
          </div>
        </section>

        {/* State Helplines & Emergency Contacts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="p-4 space-y-3">
            <h2 className="text-lg font-bold">State Emergency Helplines</h2>
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {(helplinesQ.data?.items || []).map((h) => (
                <div key={h.id} className="p-3 rounded-xl bg-canvas border border-borderSubtle flex items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="font-bold">{h.state_name}</p>
                    <p className="text-xs text-inkMuted">
                      Police {h.police} • Amb {h.ambulance} • Tourist {h.tourist_helpline}
                    </p>
                  </div>
                  <a href={`tel:${h.tourist_helpline}`} className="text-xs font-bold text-river hover:underline shrink-0">
                    Call Tourist Desk
                  </a>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <h2 className="text-lg font-bold">My Emergency Contacts</h2>
            <div className="flex gap-2">
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Contact name"
                className="flex-1 rounded-xl border border-borderSubtle bg-canvas px-3 py-2 min-h-[44px]"
              />
              <input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+91..."
                className="flex-1 rounded-xl border border-borderSubtle bg-canvas px-3 py-2 min-h-[44px]"
              />
              <Button onClick={() => addContactMut.mutate()} disabled={!contactName || !contactPhone}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {(contactsQ.data?.items || []).map((c) => (
                <div key={c.id} className="p-3 rounded-xl bg-canvas border border-borderSubtle flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{c.name}</p>
                    <p className="text-xs text-inkMuted">{c.phone}</p>
                  </div>
                  <div className="flex gap-2">
                    <a href={`tel:${c.phone}`} className="px-3 py-1.5 rounded-lg bg-forest text-onPrimary text-xs font-semibold">
                      Call
                    </a>
                    <button
                      type="button"
                      onClick={() => delContactMut.mutate(c.id)}
                      className="p-2 text-sunrise hover:bg-sunrise/10 rounded-lg"
                      aria-label="Delete contact"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
