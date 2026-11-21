"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LangCode, UserProfile } from "@ne-mate/shared";

interface AppState {
  theme: "light" | "dark";
  lang: LangCode;
  lowDataMode: boolean;
  isOnline: boolean;
  selectedState: string;
  profile: UserProfile | null;
  onboardingCompleted: boolean;
  authInitialized: boolean;
  pendingOutboxCount: number;
  lastSyncedAt: string | null;
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;
  setLang: (lang: LangCode) => void;
  setLowDataMode: (val: boolean) => void;
  setIsOnline: (val: boolean) => void;
  setSelectedState: (code: string) => void;
  setProfile: (profile: UserProfile | null, onboardingCompleted?: boolean) => void;
  setAuthInitialized: (val: boolean) => void;
  setSyncMeta: (pending: number, lastSyncedAt?: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: "light",
      lang: "en",
      lowDataMode: false,
      isOnline: true,
      selectedState: "ML",
      profile: null,
      onboardingCompleted: false,
      authInitialized: false,
      pendingOutboxCount: 0,
      lastSyncedAt: null,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
      setLang: (lang) => set({ lang }),
      setLowDataMode: (lowDataMode) => set({ lowDataMode }),
      setIsOnline: (isOnline) => set({ isOnline }),
      setSelectedState: (selectedState) => set({ selectedState }),
      setProfile: (profile, onboardingCompleted) =>
        set((s) => ({
          profile,
          onboardingCompleted:
            onboardingCompleted !== undefined
              ? onboardingCompleted
              : Boolean(profile?.onboarding_completed_at),
          authInitialized: true,
          lang: (profile?.preferred_lang as LangCode) || s.lang,
          lowDataMode: profile?.low_data_mode ?? s.lowDataMode,
        })),
      setAuthInitialized: (authInitialized) => set({ authInitialized }),
      setSyncMeta: (pendingOutboxCount, lastSyncedAt) =>
        set((s) => ({
          pendingOutboxCount,
          lastSyncedAt: lastSyncedAt !== undefined ? lastSyncedAt : s.lastSyncedAt,
        })),
    }),
    {
      name: "ne-mate-ui-prefs",
      // Security rule (B4.3): NEVER store auth tokens in localStorage — UI preferences only!
      partialize: (state) => ({
        theme: state.theme,
        lang: state.lang,
        lowDataMode: state.lowDataMode,
        selectedState: state.selectedState,
      }),
    }
  )
);
