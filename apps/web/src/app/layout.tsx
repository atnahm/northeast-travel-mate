import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans, Noto_Sans_Bengali, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
const notoBengali = Noto_Sans_Bengali({ subsets: ["bengali"], weight: ["400", "500", "600", "700"], variable: "--font-noto-bengali", display: "swap" });
const notoDevanagari = Noto_Sans_Devanagari({ subsets: ["devanagari"], weight: ["400", "500", "600", "700"], variable: "--font-noto-devanagari", display: "swap" });

export const metadata: Metadata = {
  title: "NE Mate — North-East India Travel Companion",
  description: "Plan trips, check official permits, explore local places, and travel safely across all 8 states of North-East India — online or offline.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/logo.png", apple: "/logo.png" },
};

export const viewport: Viewport = {
  themeColor: "#1F5E4B",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${fraunces.variable} ${notoBengali.variable} ${notoDevanagari.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans min-h-screen bg-canvas text-ink selection:bg-forest/20">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
