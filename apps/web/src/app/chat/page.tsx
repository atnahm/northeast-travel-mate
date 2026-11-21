"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  BadgeCheck,
  Check,
  Compass,
  Copy,
  ExternalLink,
  FileCheck2,
  History,
  Map as MapIcon,
  Mic,
  MicOff,
  PanelLeftClose,
  Plus,
  RotateCcw,
  Square,
  TrainFront,
  WifiOff,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button, Card, StatusBadge } from "@/components/ui/Primitives";
import { useAppStore } from "@/lib/store/app-store";
import { apiFetch, streamChatSSE } from "@ne-mate/shared/api-client";
import type { ChatCard, ChatCitation, ChatMessage } from "@ne-mate/shared";

interface ThreadSummary {
  id: string;
  title: string;
  updated_at?: string;
}

const STARTER_CARDS = [
  {
    icon: MapIcon,
    title: "Plan a full itinerary",
    subtitle: "6 days in Meghalaya from Guwahati in Dec, budget ₹25,000",
    prompt: "6 days in Meghalaya from Guwahati in December, budget 25000",
  },
  {
    icon: FileCheck2,
    title: "Check ILP / PAP permits",
    subtitle: "Do I need a permit for Arunachal Pradesh and Tawang?",
    prompt: "Do I need a permit for Arunachal Pradesh and Tawang?",
  },
  {
    icon: TrainFront,
    title: "Track a North-East train",
    subtitle: "Live running status for Jan Shatabdi 12067",
    prompt: "What is the live status of train 12067?",
  },
  {
    icon: Compass,
    title: "Discover food & places",
    subtitle: "Best local dishes and must-see spots in Nagaland",
    prompt: "Best food and places to explore in Nagaland",
  },
];

function renderFormattedText(text: string) {
  return text.split("\n").map((line, li) => {
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return (
      <p key={li} className={line.trim() === "" ? "h-2" : "leading-relaxed"}>
        {parts.map((part, pi) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <strong key={pi} className="font-semibold text-ink">
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith("`") && part.endsWith("`")) {
            return (
              <code key={pi} className="px-1.5 py-0.5 rounded bg-mutedSurface text-xs font-mono">
                {part.slice(1, -1)}
              </code>
            );
          }
          return <React.Fragment key={pi}>{part}</React.Fragment>;
        })}
      </p>
    );
  });
}

export default function ChatPage() {
  const lang = useAppStore((s) => s.lang);
  const isOnline = useAppStore((s) => s.isOnline);
  const profile = useAppStore((s) => s.profile);

  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [listening, setListening] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const refreshThreads = () => {
    if (!isOnline) return;
    apiFetch<{ items: ThreadSummary[] }>("/api/v1/chat/threads")
      .then((res) => setThreads(res.items || []))
      .catch(() => undefined);
  };

  useEffect(() => {
    refreshThreads();
  }, [isOnline]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTools]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
  }, [input]);

  const startNewChat = () => {
    abortRef.current?.abort();
    setStreaming(false);
    setThreadId(null);
    setMessages([]);
    setActiveTools([]);
    setErr("");
    setShowHistory(false);
  };

  const loadThread = async (tid: string) => {
    setErr("");
    try {
      const res = await apiFetch<{ thread: ThreadSummary; messages: ChatMessage[] }>(
        `/api/v1/chat/threads/${tid}`
      );
      setThreadId(tid);
      setMessages(res.messages || []);
      setShowHistory(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load conversation");
    }
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
    setStreaming(false);
    setActiveTools([]);
  };

  const sendPrompt = async (promptText: string) => {
    const clean = promptText.trim();
    if (!clean || streaming) return;
    setErr("");

    let activeThread = threadId;
    if (!activeThread) {
      try {
        const th = await apiFetch<{ thread: { id: string } }>("/api/v1/chat/threads", {
          method: "POST",
          body: JSON.stringify({ title: clean.slice(0, 56), lang }),
        });
        activeThread = th.thread.id;
        setThreadId(activeThread);
      } catch (e) {
        setErr(
          e instanceof Error
            ? `${e.message}. Sign in via Onboarding first to use AI planning.`
            : "Please sign in first."
        );
        return;
      }
    }

    const userMsg: ChatMessage = { id: `u_${Date.now()}`, role: "user", content: clean };
    const asstId = `a_${Date.now()}`;
    const placeholder: ChatMessage = { id: asstId, role: "assistant", content: "", cards: [], citations: [] };
    setMessages((prev) => [...prev, userMsg, placeholder]);
    setInput("");
    setActiveTools([]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChatSSE(
        activeThread,
        clean,
        (ev) => {
          if (ev.event === "tool") {
            const tName = String(ev.data.tool || "").replace(/_/g, " ");
            if (tName) setActiveTools((prev) => (prev.includes(tName) ? prev : [...prev, tName]));
            return;
          }
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== asstId) return m;
              if (ev.event === "delta") {
                return { ...m, content: m.content + String(ev.data.text || "") };
              }
              if (ev.event === "card") {
                return { ...m, cards: [...(m.cards || []), ev.data as unknown as ChatCard] };
              }
              if (ev.event === "citation") {
                return { ...m, citations: [...(m.citations || []), ev.data as unknown as ChatCitation] };
              }
              return m;
            })
          );
        },
        controller.signal
      );
      refreshThreads();
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        setErr(e instanceof Error ? e.message : "Streaming interrupted");
      }
    } finally {
      setStreaming(false);
      setActiveTools([]);
      abortRef.current = null;
    }
  };

  const toggleVoiceInput = () => {
    const w = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        onresult: (ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onend: () => void;
        start: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        onresult: (ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onend: () => void;
        start: () => void;
      };
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setErr("Voice input is not supported in this browser.");
      return;
    }
    const rec = new SR();
    rec.lang = lang === "hi" ? "hi-IN" : lang === "bn" || lang === "as" ? "bn-IN" : "en-IN";
    setListening(true);
    rec.onresult = (ev) => {
      const txt = ev.results?.[0]?.[0]?.transcript || "";
      if (txt) setInput((prev) => (prev ? `${prev} ${txt}` : txt));
    };
    rec.onend = () => setListening(false);
    rec.start();
  };

  const copyMessage = (id: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1600);
  };

  const lastUserPrompt = [...messages].reverse().find((m) => m.role === "user")?.content;

  return (
    <AppShell>
      <div className="relative flex h-[calc(100vh-148px)] md:h-[calc(100vh-96px)] -mx-2 md:mx-0">
        {/* Optional Slide-over Recent Chats Panel (ChatGPT-style) */}
        {showHistory && (
          <aside className="w-64 shrink-0 mr-4 rounded-card bg-surface border border-borderSubtle p-3 flex flex-col gap-2 overflow-hidden">
            <div className="flex items-center justify-between px-1 pb-1 border-b border-borderSubtle">
              <span className="text-xs font-bold uppercase tracking-wider text-inkMuted">Recent Chats</span>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="p-1.5 rounded-lg hover:bg-mutedSurface text-inkMuted"
                aria-label="Close chat history"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={startNewChat}
              className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl bg-forest text-onPrimary text-sm font-semibold hover:bg-forestHover"
            >
              <Plus className="w-4 h-4" />
              New chat
            </button>
            <div className="flex-1 overflow-y-auto space-y-1 pt-1">
              {threads.length === 0 ? (
                <p className="text-xs text-inkMuted px-2 py-4">Your previous trips &amp; permit chats appear here.</p>
              ) : (
                threads.map((th) => (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => loadThread(th.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm truncate transition-colors ${
                      threadId === th.id
                        ? "bg-mutedSurface font-semibold text-ink"
                        : "text-inkMuted hover:bg-mutedSurface/60 hover:text-ink"
                    }`}
                  >
                    {th.title || "Untitled chat"}
                  </button>
                ))
              )}
            </div>
          </aside>
        )}

        {/* Main Centered ChatGPT Column */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Minimal Top Toolbar */}
          <div className="flex items-center justify-between gap-2 pb-2 px-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl text-sm font-medium text-inkMuted hover:bg-mutedSurface hover:text-ink transition-colors"
                aria-label="Toggle chat history"
              >
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">History</span>
              </button>
              <button
                type="button"
                onClick={startNewChat}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl text-sm font-medium text-inkMuted hover:bg-mutedSurface hover:text-ink transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>New chat</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-statusVerifiedBg text-statusVerifiedFg border border-river/40">
                <BadgeCheck className="w-3.5 h-3.5" />
                NE Mate • {lang.toUpperCase()}
              </span>
              {!isOnline && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-statusCheckBg text-statusCheckFg">
                  <WifiOff className="w-3.5 h-3.5" /> Offline
                </span>
              )}
            </div>
          </div>

          {/* Offline Fallback Quick Links */}
          {!isOnline && (
            <div className="max-w-3xl w-full mx-auto px-2 pb-3">
              <Card className="p-4 space-y-2 border-sunrise/50">
                <p className="text-sm font-semibold">AI chat requires an internet connection — use offline modules:</p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/permits"><Button variant="secondary">Permits</Button></Link>
                  <Link href="/trips"><Button variant="secondary">Saved Trips</Button></Link>
                  <Link href="/phrasebook"><Button variant="secondary">Phrasebook</Button></Link>
                  <Link href="/safety"><Button variant="danger">SOS (112)</Button></Link>
                </div>
              </Card>
            </div>
          )}

          {/* Conversation Canvas */}
          <div className="flex-1 overflow-y-auto px-2">
            {messages.length === 0 ? (
              <div className="h-full max-w-3xl mx-auto flex flex-col items-center justify-center py-8 space-y-7">
                <div className="text-center space-y-2.5">
                  <img src="/icon.svg" alt="NE Mate" className="w-12 h-12 rounded-2xl mx-auto shadow-sm" />
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-ink">
                    {profile?.full_name
                      ? `Where to next, ${profile.full_name.split(" ")[0]}?`
                      : "How can I help plan your North-East trip?"}
                  </h1>
                  <p className="text-sm text-inkMuted max-w-md mx-auto">
                    Ask about ILP &amp; PAP permits, multi-modal routes, live train status, or let me build an editable day-by-day itinerary.
                  </p>
                </div>

                {/* 2x2 ChatGPT-style Prompt Starter Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  {STARTER_CARDS.map((card) => {
                    const Icon = card.icon;
                    return (
                      <button
                        key={card.title}
                        type="button"
                        onClick={() => sendPrompt(card.prompt)}
                        className="group text-left rounded-2xl border border-borderSubtle bg-surface p-4 hover:border-forest hover:shadow-soft transition-all flex items-start gap-3"
                      >
                        <div className="p-2 rounded-xl bg-mutedSurface text-forest group-hover:bg-forest group-hover:text-onPrimary transition-colors shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-ink">{card.title}</p>
                          <p className="text-xs text-inkMuted line-clamp-2 mt-0.5">{card.subtitle}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto py-4 space-y-6">
                {messages.map((m) =>
                  m.role === "user" ? (
                    <div key={m.id} className="flex justify-end">
                      <div className="max-w-[84%] rounded-3xl bg-mutedSurface text-ink px-5 py-3 text-[15px] leading-relaxed">
                        {m.content}
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} className="flex items-start gap-3.5">
                      <img
                        src="/icon.svg"
                        alt="NE Mate"
                        className="w-8 h-8 rounded-full shrink-0 mt-0.5 border border-borderSubtle"
                      />
                      <div className="flex-1 min-w-0 space-y-3">
                        {/* Prose content (clean editorial ChatGPT layout) */}
                        <div className="text-[15px] text-ink space-y-1.5">
                          {m.content ? (
                            renderFormattedText(m.content)
                          ) : (
                            <div className="flex items-center gap-2 text-sm text-inkMuted py-1">
                              <span className="inline-block w-2 h-2 rounded-full bg-forest animate-pulse" />
                              <span>
                                {activeTools.length > 0
                                  ? `Checking ${activeTools.join(", ")}...`
                                  : "Thinking..."}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Tappable Structured Cards */}
                        {m.cards && m.cards.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                            {m.cards.map((card, i) => {
                              const d = card.data;
                              if (card.card_type === "trip_draft") {
                                return (
                                  <Card
                                    key={i}
                                    className="p-4 border-forest bg-forest/5 sm:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                  >
                                    <div>
                                      <p className="text-xs font-bold uppercase text-forest">Draft Trip Saved</p>
                                      <p className="font-bold text-base">{String(d.title)}</p>
                                      <p className="text-xs text-inkMuted">
                                        {String(d.days_count)} days • Est. ₹{Number(d.estimated_total_inr || 0).toLocaleString("en-IN")}
                                      </p>
                                    </div>
                                    <Link href={`/trips/${String(d.trip_id)}`}>
                                      <Button>
                                        Open in Trip Planner <ArrowRight className="w-4 h-4" />
                                      </Button>
                                    </Link>
                                  </Card>
                                );
                              }
                              if (card.card_type === "permit") {
                                return (
                                  <Card key={i} className="p-3.5 space-y-1.5">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                      <StatusBadge
                                        kind={d.required ? "required" : "optional"}
                                        label={d.required ? "Required" : "Not required"}
                                      />
                                      <StatusBadge
                                        kind={d.needs_check ? "needs_check" : "verified"}
                                        label={
                                          d.needs_check
                                            ? "Needs check"
                                            : `Verified ${String(d.last_verified_at || "").slice(0, 10)}`
                                        }
                                      />
                                    </div>
                                    <p className="font-bold text-sm">{String(d.name)}</p>
                                    {Boolean(d.portal_url) && (
                                      <a
                                        href={String(d.portal_url)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs font-semibold text-river hover:underline"
                                      >
                                        Apply on official portal <ExternalLink className="w-3 h-3" />
                                      </a>
                                    )}
                                  </Card>
                                );
                              }
                              if (card.card_type === "place") {
                                return (
                                  <Link key={i} href={`/explore/${String(d.id)}`}>
                                    <Card className="p-3.5 h-full hover:border-forest transition-colors space-y-1">
                                      <span className="text-xs font-bold text-forest">{String(d.state_code)}</span>
                                      <p className="font-bold text-sm">{String(d.name)}</p>
                                      <p className="text-xs text-inkMuted line-clamp-2">{String(d.notes || "")}</p>
                                    </Card>
                                  </Link>
                                );
                              }
                              return (
                                <Card key={i} className="p-3.5 space-y-1">
                                  <span className="text-xs font-bold uppercase text-river">{card.card_type}</span>
                                  <p className="font-bold text-sm">{String(d.operator || d.train_name || "Route Option")}</p>
                                  <p className="text-xs text-inkMuted">{String(d.status_text || d.schedule_text || "")}</p>
                                </Card>
                              );
                            })}
                          </div>
                        )}

                        {/* Verified Source Citations */}
                        {m.citations && m.citations.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {m.citations.map((c, idx) => (
                              <StatusBadge
                                key={idx}
                                kind={c.needs_check ? "needs_check" : "verified"}
                                label={`Source: ${c.code || c.permit_id} · ${c.last_verified_at?.slice(0, 10) || "check portal"}`}
                              />
                            ))}
                          </div>
                        )}

                        {/* Subtle ChatGPT-style action row */}
                        {m.content && !streaming && (
                          <div className="flex items-center gap-1 pt-0.5 text-inkMuted">
                            <button
                              type="button"
                              onClick={() => copyMessage(m.id, m.content)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs hover:bg-mutedSurface hover:text-ink transition-colors"
                              aria-label="Copy response"
                            >
                              {copiedId === m.id ? <Check className="w-3.5 h-3.5 text-forest" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copiedId === m.id ? "Copied" : "Copy"}</span>
                            </button>
                            {lastUserPrompt && (
                              <button
                                type="button"
                                onClick={() => sendPrompt(lastUserPrompt)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs hover:bg-mutedSurface hover:text-ink transition-colors"
                                aria-label="Regenerate response"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Retry</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Sticky Centered Floating Composer Pill (ChatGPT-style) */}
          <div className="max-w-3xl w-full mx-auto px-2 pt-2">
            {err && (
              <div className="mb-2 px-3.5 py-2 rounded-xl bg-statusCheckBg text-statusCheckFg border border-sunrise/40 text-xs font-semibold">
                {err}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendPrompt(input);
              }}
              className="rounded-3xl border border-borderSubtle bg-surface shadow-soft px-3.5 py-2.5 flex items-end gap-2 focus-within:border-river transition-colors"
            >
              <button
                type="button"
                onClick={toggleVoiceInput}
                aria-label="Voice input"
                className="w-10 h-10 rounded-full flex items-center justify-center text-inkMuted hover:bg-mutedSurface hover:text-ink shrink-0"
              >
                {listening ? <MicOff className="w-5 h-5 text-sunrise" /> : <Mic className="w-5 h-5" />}
              </button>

              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendPrompt(input);
                  }
                }}
                placeholder="Message NE Mate..."
                className="flex-1 bg-transparent resize-none border-0 outline-none focus:outline-none py-2 text-base max-h-40 placeholder:text-inkMuted"
              />

              {streaming ? (
                <button
                  type="button"
                  onClick={stopStreaming}
                  aria-label="Stop generating"
                  className="w-10 h-10 rounded-full bg-ink text-canvas flex items-center justify-center shrink-0 hover:opacity-90"
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  aria-label="Send message"
                  className="w-10 h-10 rounded-full bg-forest text-onPrimary flex items-center justify-center shrink-0 hover:bg-forestHover disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowUp className="w-5 h-5" />
                </button>
              )}
            </form>

            <p className="text-[11px] text-inkMuted text-center mt-2">
              NE Mate cites curated permit records. Always confirm final rules &amp; fees on official government portals.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
