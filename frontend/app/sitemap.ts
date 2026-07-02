import type { MetadataRoute } from "next";
import { LEGAL_SLUGS } from "@/lib/legal-content";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://quatatrade.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const marketing = ["", "/how-it-works", "/fees", "/security", "/about", "/help", "/contact", "/status"];
  const legal = LEGAL_SLUGS.map((s) => `/legal/${s}`);
  const auth = ["/login", "/register"];

  return [...marketing, ...legal, ...auth].map((path) => ({
    url: `${SITE}${path}`,
    changeFrequency: path.startsWith("/legal") ? "monthly" : "weekly",
    priority: path === "" ? 1 : path.startsWith("/legal") ? 0.5 : 0.7,
  }));
}
