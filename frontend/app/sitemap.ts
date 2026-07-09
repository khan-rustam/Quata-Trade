import type { MetadataRoute } from "next";
import { LEGAL_SLUGS } from "@/lib/legal-content";
import { fetchSeoSitemap } from "@/lib/seo-engine";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://quatatrade.com";

/**
 * app/sitemap.ts — Next.js builds /sitemap.xml from this.
 *
 * Tries the central QUATA SEO engine first (the authoritative page registry,
 * including any AI-published content). Falls back to the static route list
 * below when the engine is unavailable — fail-open, so the sitemap is never
 * empty or broken if the engine is down or unconfigured.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const engineEntries = await fetchSeoSitemap();
  if (engineEntries && engineEntries.length > 0) {
    return engineEntries.map((e) => ({
      url: e.url,
      lastModified: e.lastModified ? new Date(e.lastModified) : new Date(),
      changeFrequency:
        (e.changeFrequency as MetadataRoute.Sitemap[number]["changeFrequency"]) ?? "weekly",
      priority: e.priority ?? 0.5,
    }));
  }

  const marketing = ["", "/how-it-works", "/fees", "/security", "/about", "/help", "/contact", "/status"];
  const legal = LEGAL_SLUGS.map((s) => `/legal/${s}`);
  const auth = ["/login", "/register"];

  return [...marketing, ...legal, ...auth].map((path) => ({
    url: `${SITE}${path}`,
    changeFrequency: path.startsWith("/legal") ? "monthly" : "weekly",
    priority: path === "" ? 1 : path.startsWith("/legal") ? 0.5 : 0.7,
  }));
}
