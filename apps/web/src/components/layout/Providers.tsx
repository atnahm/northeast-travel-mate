"use client";

import React, { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store/app-store";
import { flushOfflineOutbox } from "@/lib/offline/db";
import { apiFetch } from "@ne-mate/shared/api-client";
import type { UserProfile } from "@ne-mate/shared";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 1,
          },
        },
      })
  );

  const theme = useAppStore((s) => s.theme);
  const lang = useAppStore((s) => s.lang);
  const setIsOnline = useAppStore((s) => s.setIsOnline);
  const setProfile = useAppStore((s) => s.setProfile);
  const setAuthInitialized = useAppStore((s) => s.setAuthInitialized);
  const setSyncMeta = useAppStore((s) => s.setSyncMeta);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    root.lang = lang;
  }, [theme, lang]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Register Workbox-style Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const syncConnectivity = async () => {
      const online = navigator.onLine;
      setIsOnline(online);
      if (online) {
        try {
          const res = await flushOfflineOutbox();
          if (res.applied > 0) setSyncMeta(0, new Date().toISOString());
        } catch {
          // keep queued items for next online window
        }
      }
    };

    syncConnectivity();
    window.addEventListener("online", syncConnectivity);
    window.addEventListener("offline", syncConnectivity);

    // Hydrate current signed-in user via HTTP-only session cookie
    apiFetch<{ profile: UserProfile | null; onboarding_completed: boolean }>("/api/v1/me")
      .then((res) => {
        if (res.profile) {
          setProfile(res.profile, res.onboarding_completed);
        } else {
          setProfile(null, false);
        }
      })
      .catch(() => {
        setProfile(null, false);
        setAuthInitialized(true);
      });

    return () => {
      window.removeEventListener("online", syncConnectivity);
      window.removeEventListener("offline", syncConnectivity);
    };
  }, [setIsOnline, setProfile, setAuthInitialized, setSyncMeta]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
