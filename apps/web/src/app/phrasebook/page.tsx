"use client";

import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Volume2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button, Card, Chip } from "@/components/ui/Primitives";
import { offlineDb } from "@/lib/offline/db";
import { apiFetch } from "@ne-mate/shared/api-client";

interface PhraseItem {
  id: string;
  language_code: string;
  language_name: string;
  category: string;
  english_text: string;
  local_text: string;
  romanized: string;
  tts_lang?: string;
}

export default function PhrasebookPage() {
  const [langFilter, setLangFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [offlineRows, setOfflineRows] = useState<PhraseItem[]>([]);

  useEffect(() => {
    offlineDb?.phrasebook
      .toArray()
      .then((rows) => setOfflineRows(rows as unknown as PhraseItem[]))
      .catch(() => undefined);
  }, []);

  const phrasesQ = useQuery({
    queryKey: ["phrasebook", langFilter, catFilter],
    queryFn: async () => {
      const res = await apiFetch<{ items: PhraseItem[] }>(
        `/api/v1/phrasebook?language_code=${langFilter}&category=${catFilter}`
      );
      if (res.items.length) {
        await offlineDb?.phrasebook.bulkPut(res.items as unknown as Array<Record<string, unknown> & { id: string }>).catch(() => undefined);
      }
      return res.items;
    },
  });

  const rows = (phrasesQ.data || offlineRows).filter(
    (p) =>
      (langFilter === "all" || p.language_code === langFilter) &&
      (catFilter === "all" || p.category === catFilter)
  );

  const speakPhrase = (item: PhraseItem) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utt = new SpeechSynthesisUtterance(item.local_text);
    utt.lang = item.tts_lang || "en-IN";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utt);
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-forest" />
            Regional Phrasebook (Offline Ready)
          </h1>
          <p className="text-sm text-inkMuted">
            Essential greetings, transport, food, permit, and emergency phrases in Assamese, Bengali, Hindi, Mizo, Nagamese, and Nepali.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            ["all", "All Languages"],
            ["as", "Assamese (অসমীয়া)"],
            ["bn", "Bengali (বাংলা)"],
            ["hi", "Hindi (हिन्दी)"],
            ["lus", "Mizo"],
            ["nag", "Nagamese"],
            ["ne", "Nepali"],
          ].map(([code, label]) => (
            <Chip key={code} active={langFilter === code} onClick={() => setLangFilter(code)}>
              {label}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {["all", "greetings", "transport", "food", "permits", "emergency"].map((c) => (
            <Chip key={c} active={catFilter === c} onClick={() => setCatFilter(c)} className="capitalize">
              {c}
            </Chip>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.map((item) => (
            <Card key={item.id} className="p-4 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-forest">{item.language_name}</span>
                  <span className="text-[11px] uppercase px-2 py-0.5 rounded-full bg-mutedSurface text-inkMuted">
                    {item.category}
                  </span>
                </div>
                <p className="text-lg font-bold">{item.local_text}</p>
                <p className="text-sm text-river font-medium">{item.romanized}</p>
                <p className="text-xs text-inkMuted">{item.english_text}</p>
              </div>

              <Button variant="secondary" onClick={() => speakPhrase(item)} aria-label={`Play audio for ${item.english_text}`}>
                <Volume2 className="w-4 h-4" />
                Play
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
