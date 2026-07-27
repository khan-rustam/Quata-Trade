import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CampaignTracker } from "@/components/campaign/campaign-tracker";
import RegisterPage from "../register/page";

/**
 * `/signup` — the generic campaign entry point.
 *
 * Renders the existing `/register` form outright. The separate URL exists
 * because "signup" is the word ads and QR codes use, and because a campaign
 * URL should be free to change framing without touching the auth route the
 * product links to internally.
 *
 * It renders rather than redirects: a redirect costs a round-trip on a
 * mobile ad click and risks dropping the query string carrying the campaign
 * tags. `canonical` points at `/register` so the two URLs don't compete for
 * the same ranking.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("authSignup");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/register" },
    robots: { index: true, follow: true },
    openGraph: {
      title: t("metaTitle"),
      description: t("metaDescription"),
      url: "/signup",
      type: "website",
      siteName: "QuataTrade",
    },
  };
}

export default function SignupPage(): React.JSX.Element {
  return (
    <>
      <CampaignTracker segment="general" />
      <RegisterPage />
    </>
  );
}
