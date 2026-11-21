"use client";

import React, { useState } from "react";
import { TrainFront, X } from "lucide-react";
import { Button, Card } from "@/components/ui/Primitives";
import { useAppStore } from "@/lib/store/app-store";
import { t } from "@/lib/i18n/translations";
import { todayIstDateString, yesterdayIstDateString } from "@/lib/trains/local-data";

interface TrackByNumberModalProps {
  open: boolean;
  onClose: () => void;
  onSelectTrain: (trainNo: string, startDate: string) => void;
}

const POPULAR_TRAINS = [
  { no: "12067", label: "Guwahati – Jorhat Jan Shatabdi" },
  { no: "12424", label: "Dibrugarh Rajdhani" },
  { no: "15609", label: "Guwahati – Sairang (Aizawl)" },
  { no: "13173", label: "Kanchanjunga (Agartala)" },
];

export function TrackByNumberModal({ open, onClose, onSelectTrain }: TrackByNumberModalProps) {
  const lang = useAppStore((s) => s.lang);
  const today = todayIstDateString();
  const yesterday = yesterdayIstDateString();
  const [trainNo, setTrainNo] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [err, setErr] = useState("");

  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = trainNo.trim();
    if (!/^\d{5}$/.test(clean)) {
      setErr(t(lang, "invalidTrainNo"));
      return;
    }
    setErr("");
    onSelectTrain(clean, startDate);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[50] bg-black/60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="track-modal-heading"
    >
      <Card className="w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="track-modal-heading" className="text-lg font-bold flex items-center gap-2">
            <TrainFront className="w-5 h-5 text-forest" />
            {t(lang, "trackModalTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 rounded-xl hover:bg-mutedSurface flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="modal-train-no" className="block text-xs font-semibold mb-1">
              5-digit train number
            </label>
            <input
              id="modal-train-no"
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={trainNo}
              onChange={(e) => {
                setTrainNo(e.target.value.replace(/\D/g, ""));
                setErr("");
              }}
              placeholder="e.g. 12067"
              className="w-full rounded-xl border border-borderSubtle bg-canvas px-4 py-3 min-h-[48px] font-mono text-base"
            />
            {err && <p className="mt-1 text-xs font-semibold text-statusRejectedFg">{err}</p>}
          </div>

          <div>
            <p className="text-xs font-semibold mb-1.5">{t(lang, "startedOn")}</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: t(lang, "todayLabel"), val: today },
                { label: t(lang, "yesterdayLabel"), val: yesterday },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setStartDate(opt.val)}
                  className={`rounded-xl border px-3 py-2.5 min-h-[44px] text-sm font-semibold ${
                    startDate === opt.val
                      ? "bg-forest text-onPrimary border-forest"
                      : "bg-canvas text-ink border-borderSubtle hover:bg-mutedSurface"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-inkMuted">{t(lang, "popularTrainsLabel")}</p>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_TRAINS.map((p) => (
                <button
                  key={p.no}
                  type="button"
                  onClick={() => {
                    setTrainNo(p.no);
                    setErr("");
                  }}
                  className="px-2.5 py-1.5 rounded-full bg-mutedSurface hover:bg-forest/15 text-xs font-semibold"
                >
                  {p.no} · {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{t(lang, "liveStatusAction")}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
