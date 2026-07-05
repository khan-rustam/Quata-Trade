"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Lock, MessageSquare, ShieldCheck } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { PaymentMethodChip } from "@/components/trade/payment-method-chip";
import { Aurora } from "@/components/motion/aurora";
import { AnimatedKeyhole } from "@/components/brand/animated-keyhole";

/**
 * Landing hero — leads with escrow + safety (not scale). The keyhole lock draws
 * closed inside a glowing "vault" with floating trust chips; the Quata Flow
 * gradient (Aurora) is only allowed here (Documents/11 §11.7).
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
  const trust = [
    { icon: Lock, label: t("trust.f1Title") },
    { icon: ShieldCheck, label: t("trust.f2Title") },
    { icon: MessageSquare, label: t("trust.f3Title") },
  ];
  const chips = [
    { icon: Lock, label: t("chip1"), className: "-left-4 top-10" },
    { icon: ShieldCheck, label: t("chip2"), className: "-right-4 top-24" },
    { icon: MessageSquare, label: t("chip3"), className: "-bottom-4 left-10" },
  ];

  return (
    <section className="relative overflow-hidden border-b border-border">
      <Aurora />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:gap-10 md:px-6 md:py-24">
        {/* left */}
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
            <Link href="/register" className={buttonClassName({ size: "lg" })}>
              {t("ctaPrimary")} <ArrowRight size={16} aria-hidden />
            </Link>
            <Link href="/how-it-works" className={buttonClassName({ size: "lg", variant: "secondary" })}>
              {t("ctaHow")}
            </Link>
          </motion.div>

          {/* Pay-with card */}
          <motion.div
            className="mt-8 inline-flex flex-col gap-2.5 rounded-card border border-border bg-surface-1/70 p-4 text-left backdrop-blur"
            {...rise(0.24)}
          >
            <span className="text-xs font-medium uppercase tracking-wide text-text-3">{t("payWith")}</span>
            <div className="flex flex-wrap gap-2">
              <PaymentMethodChip method="MTN_MOMO" />
              <PaymentMethodChip method="ORANGE_MONEY" />
              <PaymentMethodChip method="QUATAPAY" />
            </div>
          </motion.div>

          {/* trust strip */}
          <motion.ul
            className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 md:justify-start"
            {...rise(0.3)}
          >
            {trust.map((it, i) => {
              const Icon = it.icon;
              return (
                <li key={i} className="inline-flex items-center gap-1.5 text-xs text-text-2">
                  <Icon size={14} className="text-accent-400" aria-hidden /> {it.label}
                </li>
              );
            })}
          </motion.ul>
        </div>

        {/* right — the vault */}
        <div className="flex justify-center">
          <motion.div
            className="relative rounded-[2rem] border border-border bg-surface-1/40 px-10 py-12 backdrop-blur"
            {...rise(0.2)}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 rounded-[2rem]"
              style={{ background: "radial-gradient(58% 58% at 50% 42%, rgba(47,212,167,0.16), transparent 70%)" }}
            />
            <AnimatedKeyhole size={216} />
            <div className="mt-4 flex flex-col items-center gap-1">
              <span className="font-money text-xl font-semibold tabular-nums text-text-1">
                150.00 <span className="text-sm font-normal text-text-3">USDT</span>
              </span>
              <span className="text-xs text-text-3">{t("protectedDemo")}</span>
            </div>

            {chips.map((c, i) => {
              const Icon = c.icon;
              return (
                <motion.div
                  key={i}
                  className={`absolute ${c.className} flex items-center gap-1.5 rounded-chip border border-border bg-surface-1 px-2.5 py-1 text-[11px] font-medium text-text-1 shadow-lg shadow-black/25`}
                  animate={reduce ? undefined : { y: [0, -8, 0] }}
                  transition={
                    reduce
                      ? undefined
                      : { duration: 4, repeat: Infinity, repeatType: "mirror", ease: "easeInOut", delay: i * 0.8 }
                  }
                >
                  <Icon size={12} className="text-accent-400" aria-hidden /> {c.label}
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
