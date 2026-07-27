import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CampaignTracker } from "@/components/campaign/campaign-tracker";
import { SignupSegmentIntro } from "@/components/campaign/signup-segment-intro";
import RegisterPage from "../../register/page";

/**
 * `/signup/business` — business-framed campaign landing.
 *
 * Same registration form as `/register`, introduced with business copy and
 * tagged `segment=business` for reporting. As with `../trader/page.tsx`,
 * this creates an ordinary QuataTrade account — the product has exactly one
 * account type, and the split is a reporting dimension, not a data model.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("authSignup");
  return {
    title: t("businessTitle"),
    description: t("businessBody"),
    alternates: { canonical: "/register" },
    robots: { index: true, follow: true },
    openGraph: {
      title: t("businessTitle"),
      description: t("businessBody"),
      url: "/signup/business",
      type: "website",
      siteName: "QuataTrade",
    },
  };
}

export default async function BusinessSignupPage(): Promise<React.JSX.Element> {
  const t = await getTranslations("authSignup");
  return (
    <>
      <CampaignTracker segment="business" />
      <SignupSegmentIntro
        eyebrow={t("businessEyebrow")}
        title={t("businessTitle")}
        body={t("businessBody")}
      />
      <RegisterPage />
    </>
  );
}
