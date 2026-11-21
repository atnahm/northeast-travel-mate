"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  Compass,
  FileCheck2,
  FolderLock,
  Home,
  LogOut,
  Map as MapIcon,
  MessageCircle,
  Moon,
  Route,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sun,
  WifiOff,
  Zap,
} from "lucide-react";
import { useAppStore } from "@/lib/store/app-store";
import { signOutFirebase } from "@/lib/firebase/client";
import { t } from "@/lib/i18n/translations";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const lang = useAppStore((s) => s.lang);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const isOnline = useAppStore((s) => s.isOnline);
  const lowDataMode = useAppStore((s) => s.lowDataMode);
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);
  const authInitialized = useAppStore((s) => s.authInitialized);

  const isAuthScreen = pathname === "/welcome" || pathname === "/onboarding" || pathname === "/legal";

  useEffect(() => {
    if (!isAuthScreen && authInitialized && !profile) {
      router.replace("/onboarding");
    }
  }, [isAuthScreen, authInitialized, profile, router]);

  if (isAuthScreen) {
    return <main className="min-h-screen">{children}</main>;
  }

  if (!authInitialized || !profile) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-6 text-center gap-3">
        <img src="/logo.png" alt="NorthEast TravelMate" className="w-16 h-16 rounded-2xl shadow-sm object-contain animate-pulse" />
        <p className="text-sm font-semibold text-inkMuted">Loading NorthEast TravelMate...</p>
      </div>
    );
  }

  const handleQuickSignOut = async () => {
    await signOutFirebase();
    await fetch("/api/auth/session", { method: "DELETE" });
    setProfile(null, false);
    router.replace("/onboarding");
  };

  const mainNav = [
    { href: "/", label: t(lang, "navHome"), icon: Home },
    { href: "/explore", label: t(lang, "navExplore"), icon: Compass },
    { href: "/travel", label: t(lang, "navTravel"), icon: Route },
    { href: "/permits", label: t(lang, "navPermits"), icon: FileCheck2 },
    { href: "/trips", label: t(lang, "navTrips"), icon: MapIcon },
  ];

  const utilityNav = [
    { href: "/safety", label: t(lang, "safetyTitle"), icon: ShieldAlert },
    { href: "/phrasebook", label: t(lang, "phrasebookTitle"), icon: BookOpen },
    { href: "/vault", label: t(lang, "vaultTitle"), icon: FolderLock },
    { href: "/settings", label: t(lang, "settingsTitle"), icon: Settings },
  ];

  const initials = (profile?.full_name || "NE")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-canvas text-ink">
      {/* Desktop Left Rail */}
      <aside
        className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-surface border-r border-borderSubtle z-30"
        aria-label="Primary desktop navigation"
      >
        <div className="p-5 border-b border-borderSubtle flex items-center gap-3">
          <img src="/logo.png" alt="NorthEast TravelMate" className="w-11 h-11 rounded-xl shadow-sm object-contain bg-white" />
          <div>
            <p className="font-display font-bold text-xl leading-tight tracking-tight text-forest">{t(lang, "appName")}</p>
            <p className="text-xs text-inkMuted">8-State Field Desk</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {mainNav.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 min-h-[46px] rounded-xl text-sm font-medium transition-colors ${
                  active ? "bg-forest text-onPrimary font-semibold" : "text-ink hover:bg-mutedSurface"
                }`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.7} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="pt-4 mt-4 border-t border-borderSubtle space-y-1">
            {utilityNav.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 min-h-[42px] rounded-xl text-sm font-medium transition-colors ${
                    active ? "bg-mutedSurface text-forest font-semibold" : "text-inkMuted hover:bg-mutedSurface hover:text-ink"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" strokeWidth={1.65} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="p-3 border-t border-borderSubtle">
          <Link
            href="/chat"
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-forest text-onPrimary min-h-[48px] font-semibold hover:bg-forestHover transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            <span>{t(lang, "askMate")}</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
        {/* Top Utility Header */}
        <header className="sticky top-0 z-20 bg-surface/90 backdrop-blur border-b border-borderSubtle">
          <div className="h-1.5 w-full woven-strip" aria-hidden="true" />
          <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Link href="/" className="md:hidden flex items-center gap-2 font-bold text-forest">
                <img src="/logo.png" alt="NorthEast TravelMate" className="w-9 h-9 rounded-lg object-contain bg-white" />
                <span>{t(lang, "appName")}</span>
              </Link>
              {lowDataMode && (
                <span className="inline-flex items-center gap-1 rounded-full bg-teaGold text-onGold px-2.5 py-1 text-xs font-semibold">
                  <Zap className="w-3.5 h-3.5" />
                  {t(lang, "lowDataBadge")}
                </span>
              )}
              {!isOnline && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sunrise/15 text-sunrise px-2.5 py-1 text-xs font-semibold">
                  <WifiOff className="w-3.5 h-3.5" />
                  Offline
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/safety"
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 min-h-[40px] bg-[#FFF2ED] dark:bg-[#3A1910] text-[#9E2A0E] dark:text-[#FFC4B2] border border-[#E5B8A8] dark:border-[#703122] text-xs font-semibold hover:opacity-90 transition-opacity"
                aria-label="Safety and road alerts"
              >
                <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.8} />
                <span className="hidden sm:inline">SOS &amp; Road Advisories</span>
              </Link>

              <button
                type="button"
                onClick={toggleTheme}
                className="w-10 h-10 rounded-full border border-borderSubtle bg-surface flex items-center justify-center hover:bg-mutedSurface"
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Sun className="w-4 h-4 text-teaGold" /> : <Moon className="w-4 h-4" />}
              </button>

              <Link
                href="/settings"
                className="w-10 h-10 rounded-full bg-forest text-onPrimary font-bold text-sm flex items-center justify-center hover:bg-forestHover"
                aria-label="Profile and Settings"
                title={`${profile.full_name} — Profile & Settings`}
              >
                {initials}
              </Link>
              <button
                type="button"
                onClick={handleQuickSignOut}
                className="w-10 h-10 rounded-full border border-borderSubtle bg-surface flex items-center justify-center text-inkMuted hover:text-sunrise hover:bg-mutedSurface"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isOnline && (
            <div className="bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-100 text-xs font-medium px-4 py-1.5 text-center border-t border-amber-300 dark:border-amber-800">
              {t(lang, "offlineBanner")}
            </div>
          )}
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-5 pb-28 md:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile-only Floating "Ask Mate" Button (desktop already has Ask Mate in the left rail) */}
      {pathname !== "/chat" && (
        <Link
          href="/chat"
          className="md:hidden fixed right-4 bottom-20 z-[35] inline-flex items-center gap-2 rounded-full bg-forest text-onPrimary px-4 py-3 min-h-[46px] shadow-fab border border-teaGold/60 hover:bg-forestHover transition-transform active:scale-95 text-sm font-semibold"
          aria-label="Ask Mate travel assistant"
        >
          <MessageCircle className="w-4 h-4" strokeWidth={1.75} />
          <span>{t(lang, "askMate")}</span>
        </Link>
      )}

      {/* Mobile Bottom Navigation Bar (5 tabs) */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-borderSubtle grid grid-cols-5 px-1 py-1"
        aria-label="Primary mobile navigation"
      >
        {mainNav.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 min-h-[52px] rounded-xl text-[11px] font-semibold ${
                active ? "text-forest bg-forest/10" : "text-inkMuted"
              }`}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              <span className="truncate max-w-full px-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
