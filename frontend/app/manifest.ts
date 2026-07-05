import type { MetadataRoute } from "next";

/** PWA manifest — served at /manifest.webmanifest and linked from <head>. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "QuataTrade",
    short_name: "QuataTrade",
    description: "P2P USDT marketplace with escrow protection for Cameroon. Crypto to cash. Protected.",
    start_url: "/",
    display: "standalone",
    background_color: "#0e1416",
    theme_color: "#0e1416",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Required for Android adaptive icons — the mark sits in the safe zone so the
      // OS circle/squircle mask never clips it (Lighthouse PWA "maskable icon").
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
