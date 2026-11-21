"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, FolderLock, Lock, Trash2, Unlock, Upload } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button, Card, EmptyState, StatusBadge } from "@/components/ui/Primitives";
import { apiFetch } from "@ne-mate/shared/api-client";

interface VaultDoc {
  id: string;
  kind: "permit" | "id_copy" | "ticket" | "other";
  title: string;
  storage_key: string;
  mime_type: string;
  size_bytes: number;
  encrypted: boolean;
  expires_at?: string;
}

export default function VaultPage() {
  const qc = useQueryClient();
  const [locked, setLocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<VaultDoc["kind"]>("permit");
  const [expiresAt, setExpiresAt] = useState("");
  const [fileObj, setFileObj] = useState<File | null>(null);

  const docsQ = useQuery({
    queryKey: ["vault-docs"],
    queryFn: () => apiFetch<{ items: VaultDoc[] }>("/api/v1/documents"),
    retry: false,
  });

  const uploadMut = useMutation({
    mutationFn: async () => {
      const fname = fileObj?.name || `${title || "document"}.pdf`;
      const ctype = fileObj?.type || "application/pdf";
      const urlInfo = await apiFetch<{ storage_key: string; upload_url: string | null; mode: string }>(
        "/api/v1/documents/upload-url",
        {
          method: "POST",
          body: JSON.stringify({ filename: fname, content_type: ctype, kind }),
        }
      );

      let contentBase64: string | undefined;
      if (urlInfo.upload_url && fileObj) {
        await fetch(urlInfo.upload_url, {
          method: "PUT",
          headers: { "Content-Type": ctype },
          body: fileObj,
        });
      } else if (fileObj && fileObj.size < 800_000) {
        contentBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.readAsDataURL(fileObj);
        });
      }

      return apiFetch("/api/v1/documents", {
        method: "POST",
        body: JSON.stringify({
          kind,
          title: title || fname,
          storage_key: urlInfo.storage_key,
          mime_type: ctype,
          size_bytes: fileObj?.size || 0,
          encrypted: true,
          expires_at: expiresAt || null,
          content_base64: contentBase64,
        }),
      });
    },
    onSuccess: () => {
      setTitle("");
      setFileObj(null);
      setExpiresAt("");
      qc.invalidateQueries({ queryKey: ["vault-docs"] });
    },
  });

  const delMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/documents/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vault-docs"] }),
  });

  return (
    <AppShell>
      <div className="space-y-5 max-w-4xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FolderLock className="w-6 h-6 text-river" />
              Document Vault
            </h1>
            <p className="text-sm text-inkMuted">Keep approved ILP/PAP PDFs, passport/ID copies, and rail tickets handy offline.</p>
          </div>
          <Button variant="secondary" onClick={() => setLocked((v) => !v)}>
            {locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            {locked ? "Unlock Vault" : "Lock Screen"}
          </Button>
        </div>

        {locked ? (
          <Card className="p-8 text-center space-y-4">
            <Lock className="w-10 h-10 text-forest mx-auto" />
            <h2 className="text-xl font-bold">Vault Locked</h2>
            <p className="text-sm text-inkMuted">Enter any quick PIN (e.g. 1234) or tap Unlock to view stored travel documents.</p>
            <div className="flex justify-center gap-2 max-w-xs mx-auto">
              <input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="PIN"
                className="w-28 rounded-xl border border-borderSubtle bg-canvas px-3 py-2 text-center"
              />
              <Button onClick={() => setLocked(false)}>Unlock</Button>
            </div>
          </Card>
        ) : (
          <>
            <Card className="p-5 space-y-4">
              <h2 className="font-bold text-lg">Add Permit PDF, ID or Ticket</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Arunachal e-ILP"
                  className="rounded-xl border border-borderSubtle bg-canvas px-3 py-2.5 min-h-[48px]"
                />
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as VaultDoc["kind"])}
                  className="rounded-xl border border-borderSubtle bg-canvas px-3 py-2.5 min-h-[48px]"
                >
                  <option value="permit">Permit PDF</option>
                  <option value="id_copy">ID / Passport Copy</option>
                  <option value="ticket">Ticket / Booking</option>
                  <option value="other">Other</option>
                </select>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  title="Optional expiry date"
                  className="rounded-xl border border-borderSubtle bg-canvas px-3 py-2.5 min-h-[48px]"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setFileObj(e.target.files?.[0] || null)}
                  className="text-sm"
                />
                <Button onClick={() => uploadMut.mutate()} disabled={uploadMut.isPending || (!title && !fileObj)}>
                  <Upload className="w-4 h-4" />
                  {uploadMut.isPending ? "Saving..." : "Save to Vault"}
                </Button>
              </div>
            </Card>

            {(docsQ.data?.items || []).length === 0 ? (
              <EmptyState
                icon={<FileText className="w-6 h-6" />}
                title="No documents stored yet"
                description="Upload your downloaded ILP, PAP, or train e-ticket above so it stays ready at highway checkpoints."
              />
            ) : (
              <div className="space-y-3">
                {(docsQ.data?.items || []).map((doc) => {
                  const expired = doc.expires_at && new Date(doc.expires_at) < new Date();
                  return (
                    <Card key={doc.id} className="p-4 flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full bg-mutedSurface">
                            {doc.kind.replace("_", " ")}
                          </span>
                          {doc.expires_at && (
                            <StatusBadge
                              kind={expired ? "expired" : "verified"}
                              label={expired ? `Expired ${doc.expires_at}` : `Valid till ${doc.expires_at}`}
                            />
                          )}
                        </div>
                        <p className="font-bold">{doc.title}</p>
                        <p className="text-xs text-inkMuted">{doc.storage_key}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => delMut.mutate(doc.id)}
                        className="p-2.5 rounded-xl text-sunrise hover:bg-sunrise/10"
                        aria-label="Delete document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
