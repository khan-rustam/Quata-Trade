import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Lock, MessageSquare, ShieldCheck, Wallet } from "lucide-react";
import type { Offer } from "@quatatrade/shared";
import { Button } from "@/components/ui/button";
import { Section, SectionHeading, FeatureCard } from "@/components/public/marketing";
import { BrandMark } from "@/components/brand/logo";
import { Hero } from "@/components/public/hero";
import { EscrowSteps } from "@/components/public/escrow-steps";
import { OfferPreviewCard } from "@/components/public/offer-preview-card";
import { ReviewsSection } from "@/components/public/reviews-section";
import { Reveal } from "@/components/motion/reveal";
import { getReviews } from "@/lib/content-server";

/**
 * Illustrative offers for the "know who you trade with" band. Clearly labelled as
 * examples (copy: real offers appear after sign-in) — no fabricated live market
 * data. Shapes match the real @quatatrade/shared Offer contract so the same card
 * drops straight into the marketplace list.
 */
const EXAMPLE_OFFERS: Offer[] = [
  {
    id: "0f1a5b7c-0001-7aaa-b000-000000000001",
    side: "SELL",
    asset: "USDT_TRC20",
    priceXafPerUnit: "652",
    minTrade: "20000000",
    maxTrade: "500000000",
    remaining: "1200000000",
    paymentMethods: ["MTN_MOMO", "ORANGE_MONEY"],
    terms: null,
    status: "ACTIVE",
    trader: { id: "trader-aicha", displayName: "Aïcha N.", reputationScore: 96, completedTrades: 342, completionRate: 99.1, kycTier: 2 },
    createdAt: "2026-07-01T09:12:00.000Z",
  },
  {
    id: "0f1a5b7c-0002-7aaa-b000-000000000002",
    side: "BUY",
    asset: "USDT_TRC20",
    priceXafPerUnit: "648",
    minTrade: "10000000",
    maxTrade: "250000000",
    remaining: "600000000",
    paymentMethods: ["ORANGE_MONEY", "QUATAPAY"],
    terms: null,
    status: "ACTIVE",
    trader: { id: "trader-blaise", displayName: "Blaise K.", reputationScore: 91, completedTrades: 128, completionRate: 97.8, kycTier: 2 },
    createdAt: "2026-07-01T08:40:00.000Z",
  },
  {
    id: "0f1a5b7c-0003-7aaa-b000-000000000003",
    side: "SELL",
    asset: "USDT_TRC20",
    priceXafPerUnit: "655",
    minTrade: "50000000",
    maxTrade: "1000000000",
    remaining: "2400000000",
    paymentMethods: ["MTN_MOMO", "QUATAPAY"],
    terms: null,
    status: "ACTIVE",
    trader: { id: "trader-marie", displayName: "Marie T.", reputationScore: 99, completedTrades: 511, completionRate: 99.6, kycTier: 3 },
    createdAt: "2026-07-01T07:55:00.000Z",
  },
];

const TRUST_ICONS = [Lock, ShieldCheck, MessageSquare, Wallet] as const;

export default async function LandingPage(): Promise<React.JSX.Element> {
  const t = await getTranslations("landing");
  const reviews = await getReviews();

  return (
    <>
      <Hero />
      <EscrowSteps />

      {/* Know who you trade with — the trust triple */}
      <div className="border-y border-border bg-surface-1/40">
        <Section>
          <SectionHeading
            eyebrow={t("offers.eyebrow")}
            title={t("offers.title")}
            subtitle={t("offers.subtitle")}
            center
          />
          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {EXAMPLE_OFFERS.map((offer, i) => (
              <Reveal key={offer.id} delay={i * 0.08}>
                <OfferPreviewCard offer={offer} />
              </Reveal>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-text-3">{t("offers.example")}</p>
        </Section>
      </div>

      {/* Trust features */}
      <Section>
        <SectionHeading eyebrow={t("trust.eyebrow")} title={t("trust.title")} center />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_ICONS.map((Icon, i) => (
            <Reveal key={i} delay={i * 0.07}>
              <FeatureCard icon={Icon} title={t(`trust.f${i + 1}Title`)}>
                {t(`trust.f${i + 1}Body`)}
              </FeatureCard>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Trader reviews (admin-managed; hidden until published) */}
      <ReviewsSection reviews={reviews} eyebrow={t("reviews.eyebrow")} title={t("reviews.title")} />

      {/* CTA */}
      <div className="border-t border-border">
        <Section className="text-center">
          <Reveal className="mx-auto flex max-w-xl flex-col items-center gap-5">
            <BrandMark size={44} />
            <h2 className="text-balance font-display text-3xl font-bold tracking-tight">{t("cta.title")}</h2>
            <p className="text-text-2">{t("cta.body")}</p>
            <Link href="/register">
              <Button size="lg">
                {t("cta.button")} <ArrowRight size={16} aria-hidden />
              </Button>
            </Link>
          </Reveal>
        </Section>
      </div>
    </>
  );
}
