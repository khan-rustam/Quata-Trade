import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// App-layer security headers on the credential-bearing web origin. These are
// belt-and-suspenders with the nginx edge (which should also set them); having
// them here means they cannot silently regress if the nginx vhost drifts.
// NOTE: a full script/style CSP is intentionally NOT set here yet (it needs
// per-route nonces to avoid breaking Next's inline runtime) — that is tracked
// separately. `frame-ancestors 'none'` (clickjacking) is safe to ship now.
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // stop leaking `X-Powered-By: Next.js`
  transpilePackages: ["@quatatrade/shared"],
  images: {
    // DiceBear avatars (rendered unoptimized as SVG).
    remotePatterns: [{ protocol: "https", hostname: "api.dicebear.com" }],
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default withNextIntl(nextConfig);
