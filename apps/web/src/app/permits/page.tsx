"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ExternalLink, FolderLock, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button, Card, ErrorState, Skeleton, StatusBadge, type BadgeKind } from "@/components/ui/Primitives";
import { useAppStore } from "@/lib/store/app-store";
import { t } from "@/lib/i18n/translations";
import { apiFetch } from "@ne-mate/shared/api-client";
import type { CitizenType, NEState, PermitChecklistResponse, PermitTaskStatus } from "@ne-mate/shared";

export default function PermitsPage() {
  const lang = useAppStore((s) => s.lang);
  const profile = useAppStore((s) => s.profile);

  const [stateCode, setStateCode] = useState("AR");
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [citizenOverride, setCitizenOverride] = useState<CitizenType>(profile?.citizen_type || "indian");
  const [localStatuses, setLocalStatuses] = useState<Record<string, PermitTaskStatus>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const st = sp.get("state");
    const did = sp.get("destination_id");
    if (st) setStateCode(st.toUpperCase());
    if (did) setDestinationId(did);
  }, []);

  const statesQ = useQuery({
    queryKey: ["permit-states", lang],
    queryFn: () => apiFetch<{ items: NEState[] }>(`/api/v1/states?lang=${lang}`),
  });

  const checklistQ = useQuery({
    queryKey: ["permit-checklist", stateCode, destinationId, citizenOverride, lang],
    queryFn: () => {
      const qs = new URLSearchParams({ state: stateCode, citizen_type: citizenOverride, lang });
      if (destinationId) qs.set("destination_id", destinationId);
      return apiFetch<PermitChecklistResponse>(`/api/v1/permits/checklist?${qs.toString()}`);
    },
  });

  const effectiveNationality =
    profile?.nationality_code || (citizenOverride === "indian" ? "IN" : "Foreign");

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Travel Procedure & Permits</h1>
            <p className="text-sm text-inkMuted">
              Based on your profile: <strong>{effectiveNationality}</strong>,{" "}
              <strong>{citizenOverride.replace("_", "/").toUpperCase()}</strong>
            </p>
          </div>

          <Link href="/vault">
            <Button variant="secondary">
              <FolderLock className="w-4 h-4 text-river" />
              Open Document Vault
            </Button>
          </Link>
        </div>

        {/* Persistent Official Portal Notice (C6) */}
        <Card className="p-4 border-teaGold/60 bg-teaGold/10 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-ink shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{t(lang, "permitsNotice")}</p>
        </Card>

        {/* Destination State & Traveler Type Controls */}
        <Card className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" htmlFor="perm-state">
              Destination State
            </label>
            <select
              id="perm-state"
              value={stateCode}
              onChange={(e) => setStateCode(e.target.value)}
              className="w-full rounded-xl border border-borderSubtle bg-canvas px-3.5 py-3 min-h-[48px] font-medium"
            >
              {(statesQ.data?.items || []).map((st) => (
                <option key={st.code} value={st.code}>
                  {st.name} ({st.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" htmlFor="perm-citizen">
              Traveler Category
            </label>
            <select
              id="perm-citizen"
              value={citizenOverride}
              onChange={(e) => setCitizenOverride(e.target.value as CitizenType)}
              className="w-full rounded-xl border border-borderSubtle bg-canvas px-3.5 py-3 min-h-[48px] font-medium"
            >
              <option value="indian">Indian Citizen</option>
              <option value="oci_pio">OCI / PIO Cardholder</option>
              <option value="foreign">Foreign National</option>
            </select>
          </div>
        </Card>

        {/* Permit Cards */}
        {checklistQ.isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-44" />
            <Skeleton className="h-44" />
          </div>
        )}

        {checklistQ.isError && (
          <ErrorState message={(checklistQ.error as Error).message} onRetry={() => checklistQ.refetch()} />
        )}

        {checklistQ.data && (
          <div className="space-y-4">
            {checklistQ.data.items.map((item) => {
              const statusVal: PermitTaskStatus = localStatuses[item.permit_id] || "not_started";
              return (
                <Card key={item.permit_id} className="p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge
                          kind={item.required ? "required" : "optional"}
                          label={item.required ? t(lang, "requiredForYou") : t(lang, "notRequired")}
                        />
                        {item.needs_check ? (
                          <StatusBadge kind="needs_check" label={`${t(lang, "needsCheck")} (>90d)`} />
                        ) : (
                          <StatusBadge
                            kind="verified"
                            label={`${t(lang, "verifiedOn")} ${item.last_verified_at?.slice(0, 10) || "N/A"}`}
                          />
                        )}
                        <span className="text-xs font-mono text-inkMuted">{item.code}</span>
                      </div>
                      <h2 className="text-xl font-bold">{item.name}</h2>
                      <p className="text-sm text-inkMuted">{item.issuing_authority}</p>
                    </div>

                    {item.portal_url && (
                      <a
                        href={item.portal_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-forest text-onPrimary px-4 py-3 min-h-[48px] font-semibold hover:bg-forestHover transition-colors shrink-0"
                      >
                        <span>{t(lang, "applyOfficial")}</span>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>

                  <p className="text-sm leading-relaxed">{item.description}</p>
                  {item.rule_notes && (
                    <p className="text-sm text-forest font-medium flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{item.rule_notes}</span>
                    </p>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-mutedSurface/70 rounded-xl p-3.5 text-sm">
                    <div>
                      <p className="text-xs text-inkMuted">Official Fee</p>
                      <p className="font-semibold">{item.fee_text}</p>
                    </div>
                    <div>
                      <p className="text-xs text-inkMuted">Processing Time</p>
                      <p className="font-semibold">{item.processing_time_text || "Confirm on portal"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-inkMuted">Validity</p>
                      <p className="font-semibold">{item.validity_text || "Per itinerary"}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-inkMuted mb-1.5">
                      Required Documents
                    </p>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      {item.documents_required.map((doc) => (
                        <li key={doc}>{doc}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Personal Status Tracker */}
                  <div className="pt-3 border-t border-borderSubtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-inkMuted">My Status:</span>
                      <StatusBadge kind={statusVal as BadgeKind} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(["not_started", "applied", "approved", "rejected", "expired"] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setLocalStatuses((prev) => ({ ...prev, [item.permit_id]: st }))}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold capitalize border transition-colors ${
                            statusVal === st
                              ? "bg-forest text-onPrimary border-forest"
                              : "bg-surface text-inkMuted border-borderSubtle hover:bg-mutedSurface"
                          }`}
                        >
                          {st.replace("_", " ")}
                        </button>
                      ))}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
