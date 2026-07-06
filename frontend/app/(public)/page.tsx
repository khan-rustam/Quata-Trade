import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Lock, MessageSquare, ShieldCheck, Wallet } from "lucide-react";
import type { Offer } from "@quatatrade/shared";
import { buttonClassName } from "@/components/ui/button";
import { Section, SectionHeading, FeatureCard } from "@/components/public/marketing";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand/logo";
import { Hero } from "@/components/public/hero";
import { EscrowSteps } from "@/components/public/escrow-steps";
import { OfferPreviewCard } from "@/components/public/offer-preview-card";
import { ReviewsSection } from "@/components/public/reviews-section";
import { Reveal } from "@/components/motion/reveal";
import { getReviews } from "@/lib/content-server";
import { EscrowSimulator } from "@/components/public/escrow-simulator";

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

      {/* Interactive Simulator Section */}
      <Section className="border-t border-border">
        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
          <Reveal>
            <EscrowSimulator />
          </Reveal>
          <Reveal delay={0.1} className="hidden lg:block relative rounded-2xl overflow-hidden border border-border bg-surface-1 shadow-2xl">
            <img 
              src="/images/escrow_vault_illustration.jpg" 
              alt="Secured Crypto Escrow Vault" 
              className="w-full h-auto object-cover aspect-[4/3] opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-transparent pointer-events-none" />
          </Reveal>
        </div>
      </Section>

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
      <div className="border-t border-border/80">
        <Section className="py-20 md:py-28">
          <Reveal className="mx-auto max-w-4xl rounded-3xl border border-accent-400/25 bg-surface-1/40 p-8 md:p-14 text-center relative overflow-hidden backdrop-blur-md">
            {/* Background accents */}
            <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
            <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-accent-400/5 blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center gap-6">
              <BrandMark size={48} className="text-accent-400 animate-pulse" />
              <h2 className="text-balance font-display text-3xl font-extrabold tracking-tight md:text-4xl text-text-1">
                {t("cta.title")}
              </h2>
              <p className="max-w-md text-text-2 text-sm md:text-base leading-relaxed">
                {t("cta.body")}
              </p>
              <div className="mt-4">
                <Link 
                  href="/register" 
                  className={cn(
                    buttonClassName({ size: "lg" }),
                    "shadow-[0_4px_25px_rgba(47,212,167,0.25)] hover:shadow-[0_4px_35px_rgba(47,212,167,0.4)] transition-all duration-300 transform hover:-translate-y-0.5"
                  )}
                >
                  {t("cta.button")} <ArrowRight size={16} className="ml-1" aria-hidden />
                </Link>
              </div>
            </div>
          </Reveal>
        </Section>
      </div>
    </>
  );
}
