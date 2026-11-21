"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Download, LogOut, Moon, Sun, Trash2, Wifi, Zap } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button, Card } from "@/components/ui/Primitives";
import { useAppStore } from "@/lib/store/app-store";
import { offlineDb } from "@/lib/offline/db";
import { signOutFirebase } from "@/lib/firebase/client";
import { apiFetch } from "@ne-mate/shared/api-client";
import type { LangCode, NEState } from "@ne-mate/shared";

interface PackMeta {
  state_code: string;
  name: string;
  pack_size_mb: number;
  pack_version: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const lowDataMode = useAppStore((s) => s.lowDataMode);
  const setLowDataMode = useAppStore((s) => s.setLowDataMode);
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);

  const [downloadedStates, setDownloadedStates] = useState<string[]>([]);
  const [busyPack, setBusyPack] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    offlineDb?.offline_packs
      .toArray()
      .then((rows) => setDownloadedStates(rows.map((r) => r.state_code)))
      .catch(() => undefined);
  }, []);

  const packsQ = useQuery({
    queryKey: ["offline-packs", lang],
    queryFn: () => apiFetch<{ items: PackMeta[] }>(`/api/v1/offline/packs?lang=${lang}`),
  });

  const downloadPack = async (stateCode: string, sizeMb: number) => {
    setBusyPack(stateCode);
    try {
      const manifest = await apiFetch<{
        state: NEState;
        pack_version: string;
        downloaded_at: string;
        bundle: Record<string, unknown[]>;
      }>(`/api/v1/offline/packs/${stateCode}/manifest?lang=${lang}`);

      await offlineDb.offline_packs.put({
        state_code: stateCode,
        pack_version: manifest.pack_version,
        downloaded_at: manifest.downloaded_at,
        pack_size_mb: sizeMb,
        state: manifest.state,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        bundle: manifest.bundle as any,
      });
      if (manifest.bundle.phrasebook?.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await offlineDb.phrasebook.bulkPut(manifest.bundle.phrasebook as any);
      }
      setDownloadedStates((prev) => Array.from(new Set([...prev, stateCode])));
      setMsg(`Downloaded ${stateCode} offline pack (${sizeMb} MB) into IndexedDB.`);
    } finally {
      setBusyPack(null);
    }
  };

  const removePack = async (stateCode: string) => {
    await offlineDb.offline_packs.delete(stateCode);
    setDownloadedStates((prev) => prev.filter((c) => c !== stateCode));
  };

  const handleLogout = async () => {
    await signOutFirebase();
    await fetch("/api/auth/session", { method: "DELETE" });
    setProfile(null, false);
    router.replace("/onboarding");
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Permanently delete your NE Mate profile, trips, documents, and chat history? This cannot be undone.")) {
      return;
    }
    await apiFetch("/api/v1/me", { method: "DELETE" });
    await signOutFirebase();
    await fetch("/api/auth/session", { method: "DELETE" });
    setProfile(null, false);
    router.replace("/onboarding");
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Profile & Settings</h1>
            <p className="text-sm text-inkMuted">Language, offline state packs, low-data mode, and DPDP privacy controls.</p>
          </div>
          {!profile && (
            <Link href="/onboarding">
              <Button>Sign In / Onboard</Button>
            </Link>
          )}
        </div>

        {msg && (
          <Card className="p-3.5 border-forest bg-forest/10 text-sm font-semibold text-forest">{msg}</Card>
        )}

        {/* Traveler Summary */}
        {profile && (
          <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase text-forest">{profile.role}</p>
              <h2 className="text-xl font-bold">{profile.full_name}</h2>
              <p className="text-sm text-inkMuted">
                Nationality: {profile.nationality_code} • Citizen Type: {profile.citizen_type.replace("_", "/").toUpperCase()} • DOB: {profile.date_of_birth}
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/onboarding?mode=edit">
                <Button variant="secondary">Edit Profile</Button>
              </Link>
              <Button variant="ghost" onClick={handleLogout}>
                <LogOut className="w-4 h-4" /> Sign out
              </Button>
            </div>
          </Card>
        )}

        {/* Preferences */}
        <Card className="p-5 space-y-4">
          <h2 className="text-lg font-bold">Display & Data Preferences</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5">App Language</label>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as LangCode)}
                className="w-full rounded-xl border border-borderSubtle bg-canvas px-3 py-2.5 min-h-[48px]"
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="as">অসমীয়া (Assamese)</option>
                <option value="bn">বাংলা (Bengali)</option>
              </select>
            </div>

            <div className="flex items-end">
              <Button variant="secondary" className="w-full" onClick={toggleTheme}>
                {theme === "dark" ? <Sun className="w-4 h-4 text-teaGold" /> : <Moon className="w-4 h-4" />}
                Theme: {theme === "dark" ? "Dark" : "Light"}
              </Button>
            </div>

            <div className="flex items-end">
              <Button
                variant={lowDataMode ? "primary" : "secondary"}
                className="w-full"
                onClick={() => setLowDataMode(!lowDataMode)}
              >
                <Zap className="w-4 h-4" />
                Low-Data: {lowDataMode ? "ON" : "OFF"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Offline State Packs */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Wifi className="w-5 h-5 text-forest" />
                Offline State Packs (All 8 States)
              </h2>
              <p className="text-xs text-inkMuted">
                Stores places, permits, helplines, phrasebook, and OSM-attributed map coordinates locally on your device.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(packsQ.data?.items || []).map((pk) => {
              const installed = downloadedStates.includes(pk.state_code);
              return (
                <div
                  key={pk.state_code}
                  className="p-3.5 rounded-xl border border-borderSubtle bg-canvas flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-bold text-sm">
                      {pk.name} ({pk.state_code})
                    </p>
                    <p className="text-xs text-inkMuted">
                      {pk.pack_size_mb} MB • v{pk.pack_version}
                    </p>
                  </div>
                  {installed ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-forest flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Saved
                      </span>
                      <button
                        type="button"
                        onClick={() => removePack(pk.state_code)}
                        className="p-2 text-inkMuted hover:text-sunrise rounded-lg"
                        aria-label={`Remove ${pk.name} pack`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      disabled={busyPack === pk.state_code}
                      onClick={() => downloadPack(pk.state_code, pk.pack_size_mb)}
                    >
                      <Download className="w-4 h-4" />
                      {busyPack === pk.state_code ? "Saving..." : "Download"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* DPDP Account Deletion */}
        {profile && (
          <Card className="p-5 border-sunrise/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-bold text-sunrise">Delete Account & Data (DPDP Act)</h2>
              <p className="text-xs text-inkMuted">
                Removes your profile, trips, vault documents, chat threads, and push subscriptions immediately.
              </p>
            </div>
            <Button variant="danger" onClick={handleDeleteAccount}>
              <Trash2 className="w-4 h-4" />
              Delete My Account
            </Button>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
