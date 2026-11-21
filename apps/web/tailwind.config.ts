import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--rgb-canvas) / <alpha-value>)",
        surface: "rgb(var(--rgb-surface) / <alpha-value>)",
        mutedSurface: "rgb(var(--rgb-muted) / <alpha-value>)",
        ink: "rgb(var(--rgb-ink) / <alpha-value>)",
        inkMuted: "rgb(var(--rgb-ink-muted) / <alpha-value>)",
        forest: "rgb(var(--rgb-forest) / <alpha-value>)",
        forestHover: "rgb(var(--rgb-forest-hover) / <alpha-value>)",
        onPrimary: "rgb(var(--rgb-on-primary) / <alpha-value>)",
        river: "rgb(var(--rgb-river) / <alpha-value>)",
        onRiver: "rgb(var(--rgb-on-river) / <alpha-value>)",
        teaGold: "rgb(var(--rgb-tea-gold) / <alpha-value>)",
        onGold: "rgb(var(--rgb-on-gold) / <alpha-value>)",
        sunrise: "rgb(var(--rgb-sunrise) / <alpha-value>)",
        onAlert: "rgb(var(--rgb-on-alert) / <alpha-value>)",
        rejected: "rgb(var(--rgb-rejected) / <alpha-value>)",
        statusApprovedBg: "var(--status-approved-bg)",
        statusApprovedFg: "var(--status-approved-fg)",
        statusVerifiedBg: "var(--status-verified-bg)",
        statusVerifiedFg: "var(--status-verified-fg)",
        statusAppliedBg: "var(--status-applied-bg)",
        statusAppliedFg: "var(--status-applied-fg)",
        statusCheckBg: "var(--status-check-bg)",
        statusCheckFg: "var(--status-check-fg)",
        statusRejectedBg: "var(--status-rejected-bg)",
        statusRejectedFg: "var(--status-rejected-fg)",
        borderSubtle: "rgb(var(--rgb-border-subtle) / <alpha-value>)",
        focusRing: "rgb(var(--rgb-focus-ring) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "var(--font-noto-bengali)", "var(--font-noto-devanagari)", "system-ui", "sans-serif"],
        display: ["var(--font-fraunces)", "var(--font-noto-bengali)", "var(--font-noto-devanagari)", "Georgia", "serif"],
      },
      borderRadius: {
        card: "16px",
      },
      boxShadow: {
        soft: "0 4px 20px -4px rgba(31, 94, 75, 0.08)",
        sheet: "0 -8px 28px -6px rgba(0, 0, 0, 0.16)",
        fab: "0 10px 24px -6px rgba(17, 23, 21, 0.32)",
      },
    },
  },
  plugins: [],
};

export default config;
