import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@quatatrade/shared"],
  images: {
    // DiceBear avatars (rendered unoptimized as SVG).
    remotePatterns: [{ protocol: "https", hostname: "api.dicebear.com" }],
  },
};

export default withNextIntl(nextConfig);
