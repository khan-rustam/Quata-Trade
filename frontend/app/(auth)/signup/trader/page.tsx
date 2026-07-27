import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CampaignTracker } from "@/components/campaign/campaign-tracker";
import { SignupSegmentIntro } from "@/components/campaign/signup-segment-intro";
import RegisterPage from "../../register/page";

/**
 * `/signup/trader` — trader-framed campaign landing.
 *
 * Same registration form as `/register`, introduced with trader copy and
 * tagged `segment=trader` for reporting.
 *
 * To be explicit about what this does NOT do: it does not create a
 * different kind of account. `zRegisterRequest` is `.strict()` with no
 * account-type field, and every QuataTrade user can both buy and sell.
 * Splitting the funnel by account type would mean changing the shared
 * schema, the DTO, the Prisma model and the audited auth path — so the
 * split lives in reporting, where it costs nothing and claims nothing
 * untrue.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("authSignup");
  return {
    title: t("traderTitle"),
    description: t("traderBody"),
    alternates: { canonical: "/register" },
    robots: { index: true, follow: true },
    openGraph: {
      title: t("traderTitle"),
      description: t("traderBody"),
      url: "/signup/trader",
      type: "website",
      siteName: "QuataTrade",
    },
  };
}

export default async function TraderSignupPage(): Promise<React.JSX.Element> {
  const t = await getTranslations("authSignup");
  return (
    <>
      <CampaignTracker segment="trader" />
      <SignupSegmentIntro
        eyebrow={t("traderEyebrow")}
        title={t("traderTitle")}
        body={t("traderBody")}
      />
      <RegisterPage />
    </>
  );
}
