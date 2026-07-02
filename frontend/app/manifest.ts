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
      { src: "/assets/favicons/android-icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/assets/favicons/ms-icon-310x310.png", sizes: "310x310", type: "image/png", purpose: "any" },
    ],
  };
}
