"use client";

import React from "react";
import { Bookmark, Clock } from "lucide-react";
import { Card } from "@/components/ui/Primitives";
import { useAppStore } from "@/lib/store/app-store";
import { t } from "@/lib/i18n/translations";
import { formatRelativeAge } from "@/lib/trains/local-data";
import type { SavedTrainRecord } from "@ne-mate/shared";

interface SavedTrainsStripProps {
  records: SavedTrainRecord[];
  onOpenSaved: (rec: SavedTrainRecord) => void;
}

export function SavedTrainsStrip({ records, onOpenSaved }: SavedTrainsStripProps) {
  const lang = useAppStore((s) => s.lang);
  if (!records.length) return null;

  return (
    <section aria-label={t(lang, "savedTrainsTitle")} className="space-y-2">
      <h2 className="text-xs font-bold uppercase tracking-wider text-inkMuted flex items-center gap-1.5">
        <Bookmark className="w-3.5 h-3.5 text-forest" aria-hidden="true" />
        {t(lang, "savedTrainsTitle")}
      </h2>
      <div className="flex gap-2.5 overflow-x-auto pb-1">
        {records.map((rec) => (
          <button
            key={rec.id}
            type="button"
            onClick={() => onOpenSaved(rec)}
            className="text-left shrink-0 min-w-[220px] max-w-[260px]"
          >
            <Card className="p-3 hover:border-forest transition-colors space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold text-forest">{rec.trainNo}</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-inkMuted">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  {t(lang, "savedAge", { age: formatRelativeAge(rec.savedAt) })}
                </span>
              </div>
              <p className="text-sm font-bold text-ink truncate">{rec.name}</p>
              {rec.fromCode && rec.toCode && (
                <p className="text-xs text-inkMuted">
                  {rec.fromCode} → {rec.toCode} · {rec.startDate}
                </p>
              )}
            </Card>
          </button>
        ))}
      </div>
    </section>
  );
}
