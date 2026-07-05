import { IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google";

/** Documents/11 §11.4 — all faces are free Google Fonts, self-hosted (no external requests). */
export const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["500", "700"],
  display: "swap",
});

// Money/data face. It never carries above-the-fold marketing copy, so don't
// preload it — it loads on demand (with a swap fallback) instead of competing
// with the body + display faces for the first paint's font budget.
export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  display: "swap",
  preload: false,
});
