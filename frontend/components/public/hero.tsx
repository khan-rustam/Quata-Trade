"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentMethodChip } from "@/components/trade/payment-method-chip";
import { Aurora } from "@/components/motion/aurora";
import { AnimatedKeyhole } from "@/components/brand/animated-keyhole";

/**
 * Landing hero — leads with escrow + safety (not scale), per the crypto-UX R&D.
 * The keyhole lock draws closed as the memorable brand moment. Marketing surface:
 * the only place the Quata Flow gradient (Aurora) is allowed.
 */
export function Hero(): React.JSX.Element {
  const t = useTranslations("landing");
  const reduce = useReducedMotion();

  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, ease: [0.2, 0.7, 0.2, 1] as const, delay },
        };

  return (
    <section className="relative overflow-hidden border-b border-border">
      <Aurora />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:gap-8 md:px-6 md:py-24">
        <div className="text-center md:text-left">
          <motion.p
            className="mb-5 inline-flex items-center gap-2 rounded-chip border border-border bg-surface-1/70 px-3 py-1 text-xs font-medium text-text-2 backdrop-blur"
            {...rise(0)}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent-400" aria-hidden />
            {t("badge")}
          </motion.p>
          <motion.h1
            className="text-balance font-display text-4xl font-bold leading-[1.06] tracking-tight md:text-6xl"
            {...rise(0.06)}
          >
            {t("heroTitle")}
          </motion.h1>
          <motion.p className="mx-auto mt-5 max-w-xl text-lg text-text-2 md:mx-0" {...rise(0.12)}>
            {t("heroSubtitle")}
          </motion.p>
          <motion.div
            className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center md:justify-start"
            {...rise(0.18)}
          >
            <Link href="/register">
              <Button size="lg">
                {t("ctaPrimary")} <ArrowRight size={16} aria-hidden />
              </Button>
            </Link>
            <Link href="/how-it-works">
              <Button size="lg" variant="secondary">
                {t("ctaHow")}
              </Button>
            </Link>
          </motion.div>
          <motion.div
            className="mt-7 flex flex-wrap items-center justify-center gap-2 md:justify-start"
            {...rise(0.24)}
          >
            <span className="text-sm text-text-3">{t("payWith")}</span>
            <PaymentMethodChip method="MTN_MOMO" />
            <PaymentMethodChip method="ORANGE_MONEY" />
            <PaymentMethodChip method="QUATAPAY" />
          </motion.div>
        </div>

        <div className="flex flex-col items-center">
          <AnimatedKeyhole size={232} />
          <motion.div
            className="mt-6 inline-flex items-center gap-2 rounded-card border border-border bg-surface-1/80 px-4 py-2 backdrop-blur"
            {...rise(0.55)}
          >
            <span className="h-2 w-2 rounded-full bg-accent-400" aria-hidden />
            <span className="text-xs text-text-2">{t("escrowChip")}</span>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
