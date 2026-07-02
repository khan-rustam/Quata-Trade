import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://quatatrade.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // keep authenticated & admin areas out of the index
      disallow: ["/admin", "/home", "/wallet", "/trade", "/account", "/api"],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
