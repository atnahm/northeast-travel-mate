"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Database, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button, Card, ErrorState, StatusBadge } from "@/components/ui/Primitives";
import { apiFetch } from "@ne-mate/shared/api-client";

interface HealthResp {
  status: string;
  version: string;
  firebase: { mode: string; project_id: string; connected: boolean; detail: string };
  redis: { connected: boolean; fallback: boolean };
  google_maps: { server_key_configured: boolean };
  llm: { provider: string; configured: boolean; model: string };
}

interface AdminPermit {
  id: string;
  code: string;
  state_code: string;
  name_i18n: Record<string, string>;
  portal_url: string;
  last_verified_at?: string;
  verified_by?: string;
  version: number;
  needs_check: boolean;
}

export default function AdminPage() {
  const qc = useQueryClient();
  const [alertState, setAlertState] = useState("ML");
  const [alertTitle, setAlertTitle] = useState("");
  const [alertBody, setAlertBody] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  const healthQ = useQuery({
    queryKey: ["sys-health"],
    queryFn: () => apiFetch<HealthResp>("/api/v1/health"),
  });

  const permitsQ = useQuery({
    queryKey: ["admin-permits"],
    queryFn: () => apiFetch<{ items: AdminPermit[] }>("/api/v1/admin/permits"),
    retry: false,
  });

  const overdueQ = useQuery({
    queryKey: ["admin-overdue"],
    queryFn: () =>
      apiFetch<{
        overdue_permits: AdminPermit[];
        overdue_transport: Array<{ id: string; operator: string; last_verified_at?: string }>;
      }>("/api/v1/admin/overdue"),
    retry: false,
  });

  const alertsQ = useQuery({
    queryKey: ["admin-alerts"],
    queryFn: () => apiFetch<{ items: Array<{ id: string; state_code: string; kind: string; title_i18n: Record<string, string> }> }>("/api/v1/admin/alerts"),
    retry: false,
  });

  const verifyMut = useMutation({
    mutationFn: (permitId: string) =>
      apiFetch<{ permit: AdminPermit; snapshot_id: string }>(`/api/v1/admin/permits/${permitId}/verify`, {
        method: "POST",
        body: JSON.stringify({ change_note: "Verified via Admin Console" }),
      }),
    onSuccess: (res) => {
      setActionMsg(`Verified ${res.permit.code} (snapshot ${res.snapshot_id} created & KB re-indexed).`);
      qc.invalidateQueries({ queryKey: ["admin-permits"] });
      qc.invalidateQueries({ queryKey: ["admin-overdue"] });
    },
  });

  const createAlertMut = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/admin/alerts", {
        method: "POST",
        body: JSON.stringify({
          kind: "landslide",
          severity: "medium",
          state_code: alertState,
          title_i18n: { en: alertTitle },
          body_i18n: { en: alertBody },
          source_url: "https://mausam.imd.gov.in/",
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
          verified: true,
        }),
      }),
    onSuccess: () => {
      setAlertTitle("");
      setAlertBody("");
      qc.invalidateQueries({ queryKey: ["admin-alerts"] });
    },
  });

  const deleteAlertMut = useMutation({
    mutationFn: (aid: string) => apiFetch(`/api/v1/admin/alerts/${aid}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-alerts"] }),
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-forest" />
            Internal Admin & Curation Console
          </h1>
          <p className="text-sm text-inkMuted">
            Verify curated permits (creates immutable `permit_versions` snapshots), inspect overdue items, and publish road alerts.
          </p>
        </div>

        {/* Live System & Firebase Connection Status */}
        {healthQ.data && (
          <Card className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-inkMuted flex items-center gap-1">
                <Database className="w-3.5 h-3.5" /> Firebase NoSQL
              </p>
              <p className="font-bold uppercase text-forest">
                {healthQ.data.firebase.mode} ({healthQ.data.firebase.connected ? "Connected" : "Error"})
              </p>
              <p className="text-xs text-inkMuted">{healthQ.data.firebase.project_id}</p>
            </div>
            <div>
              <p className="text-xs text-inkMuted">Google Maps Server API</p>
              <p className="font-bold">{healthQ.data.google_maps.server_key_configured ? "Configured" : "Fallback Estimator"}</p>
            </div>
            <div>
              <p className="text-xs text-inkMuted">LLM Agent Engine</p>
              <p className="font-bold">
                {healthQ.data.llm.configured ? `${healthQ.data.llm.provider} (${healthQ.data.llm.model})` : "Structured Tool Orchestrator"}
              </p>
            </div>
            <div>
              <p className="text-xs text-inkMuted">Redis Cache</p>
              <p className="font-bold">{healthQ.data.redis.connected ? "Connected" : "In-Memory TTL Fallback"}</p>
            </div>
          </Card>
        )}

        {actionMsg && (
          <Card className="p-3.5 border-forest bg-forest/10 text-sm font-semibold text-forest">{actionMsg}</Card>
        )}

        {permitsQ.isError && (
          <ErrorState
            message="Admin / Editor role required. Sign in via Onboarding using 'Continue as Curated Data Editor (Admin Demo)' or assign role='admin' in Firestore."
            onRetry={() => permitsQ.refetch()}
          />
        )}

        {overdueQ.data && (
          <Card className="p-4 border-teaGold/60 bg-teaGold/10 space-y-2">
            <h2 className="font-bold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-sunrise" />
              Overdue Verification Queue (&gt;90 days permits / &gt;14 days transport)
            </h2>
            <p className="text-sm">
              Overdue Permits: <strong>{overdueQ.data.overdue_permits.length}</strong> • Overdue Transport:{" "}
              <strong>{overdueQ.data.overdue_transport.length}</strong>
            </p>
          </Card>
        )}

        {permitsQ.data && (
          <Card className="p-5 space-y-3">
            <h2 className="text-lg font-bold">Curated Permits ({permitsQ.data.items.length})</h2>
            <div className="space-y-2.5">
              {permitsQ.data.items.map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 rounded-xl border border-borderSubtle bg-canvas flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-forest text-white">{p.state_code}</span>
                      <span className="font-mono text-xs">{p.code}</span>
                      <StatusBadge
                        kind={p.needs_check ? "needs_check" : "verified"}
                        label={p.needs_check ? "Needs check (>90d)" : `Verified ${p.last_verified_at?.slice(0, 10) || ""}`}
                      />
                      <span className="text-xs text-inkMuted">v{p.version}</span>
                    </div>
                    <p className="font-bold text-sm">{p.name_i18n?.en || p.id}</p>
                  </div>

                  <Button variant="secondary" onClick={() => verifyMut.mutate(p.id)} disabled={verifyMut.isPending}>
                    <CheckCircle2 className="w-4 h-4 text-forest" />
                    Verify Now
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {alertsQ.data && (
          <Card className="p-5 space-y-4">
            <h2 className="text-lg font-bold">Publish Road / Weather Alert</h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <select
                value={alertState}
                onChange={(e) => setAlertState(e.target.value)}
                className="rounded-xl border border-borderSubtle bg-canvas px-3 py-2 min-h-[44px]"
              >
                {["AS", "ML", "AR", "NL", "MN", "MZ", "SK", "TR"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                value={alertTitle}
                onChange={(e) => setAlertTitle(e.target.value)}
                placeholder="Alert title"
                className="sm:col-span-3 rounded-xl border border-borderSubtle bg-canvas px-3 py-2 min-h-[44px]"
              />
            </div>
            <div className="flex gap-2">
              <input
                value={alertBody}
                onChange={(e) => setAlertBody(e.target.value)}
                placeholder="Clear traveler advisory details & source..."
                className="flex-1 rounded-xl border border-borderSubtle bg-canvas px-3 py-2 min-h-[44px]"
              />
              <Button onClick={() => createAlertMut.mutate()} disabled={!alertTitle || !alertBody}>
                <Plus className="w-4 h-4" /> Publish
              </Button>
            </div>

            <div className="space-y-2 pt-2">
              {alertsQ.data.items.map((a) => (
                <div key={a.id} className="p-3 rounded-xl bg-canvas border border-borderSubtle flex items-center justify-between gap-2 text-sm">
                  <span>
                    <strong>[{a.state_code}]</strong> {a.title_i18n?.en || a.id}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteAlertMut.mutate(a.id)}
                    className="p-2 text-sunrise hover:bg-sunrise/10 rounded-lg"
                    aria-label="Delete alert"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        )}

        <p className="text-xs text-inkMuted">
          See <Link href="/permits" className="underline">Permits Dashboard</Link> to preview live traveler eligibility results.
        </p>
      </div>
    </AppShell>
  );
}
