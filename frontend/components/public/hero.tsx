"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Lock, MessageSquare, ShieldCheck, Sparkles } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { PaymentMethodChip } from "@/components/trade/payment-method-chip";
import { Aurora } from "@/components/motion/aurora";
import { cn } from "@/lib/utils";

export function Hero(): React.JSX.Element {
  const t = useTranslations("landing");
  const reduce = useReducedMotion();

  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const, delay },
        };

  const trust = [
    { icon: Lock, label: t("trust.f1Title") },
    { icon: ShieldCheck, label: t("trust.f2Title") },
    { icon: MessageSquare, label: t("trust.f3Title") },
  ];

  return (
    <section className="relative overflow-hidden border-b border-border bg-bg/85 py-16 md:py-24">
      {/* Aurora Breathing Ambient Glow */}
      <Aurora />

      {/* Grid Blueprint overlay */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.15] pointer-events-none -z-10" />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 md:grid-cols-2 md:gap-14 md:px-6">
        
        {/* Left Column: Copy & Actions */}
        <div className="text-center md:text-left space-y-6">
          
          {/* Stylized Glowing Badge */}
          <motion.div
            className="inline-flex items-center gap-2 rounded-full border border-accent-400/25 bg-accent-400/5 px-3.5 py-1.5 text-xs font-semibold text-accent-400 shadow-sm backdrop-blur"
            {...rise(0)}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-400"></span>
            </span>
            {t("badge")}
          </motion.div>

          {/* Heading with text gradient highlight */}
          <motion.h1
            className="text-balance font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-text-1 md:text-6xl"
            {...rise(0.06)}
          >
            Crypto to cash. <br />
            <span className="bg-gradient-to-r from-accent-400 via-accent-200 to-accent-400 bg-clip-text text-transparent">
              Protected.
            </span>
          </motion.h1>

          <motion.p 
            className="mx-auto max-w-xl text-base md:text-lg text-text-2 leading-relaxed md:mx-0" 
            {...rise(0.12)}
          >
            {t("heroSubtitle")}
          </motion.p>

          {/* Action Buttons with glowing shadow */}
          <motion.div
            className="flex flex-col items-center gap-3.5 sm:flex-row sm:justify-center md:justify-start"
            {...rise(0.18)}
          >
            <Link 
              href="/register" 
              className={cn(
                buttonClassName({ size: "lg" }),
                "w-full sm:w-auto shadow-[0_4px_20px_rgba(47,212,167,0.25)] hover:shadow-[0_4px_30px_rgba(47,212,167,0.4)] transition-all duration-300"
              )}
            >
              {t("ctaPrimary")} <ArrowRight size={16} className="ml-1" aria-hidden />
            </Link>
            <Link 
              href="/how-it-works" 
              className={cn(
                buttonClassName({ size: "lg", variant: "secondary" }),
                "w-full sm:w-auto hover:bg-surface-2 transition-colors border border-border"
              )}
            >
              {t("ctaHow")}
            </Link>
          </motion.div>

          {/* Styled Pay-With Glassmorphic Card */}
          <motion.div
            className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface-1/40 p-5 text-left backdrop-blur-md max-w-sm mx-auto md:mx-0 shadow-lg group hover:border-accent-400/35 transition-colors duration-300"
            {...rise(0.24)}
          >
            <div className="absolute -right-16 -top-16 h-28 w-28 rounded-full bg-accent-400/5 blur-xl group-hover:bg-accent-400/10 transition-all pointer-events-none" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-3 block mb-3">
              {t("payWith")}
            </span>
            <div className="flex flex-wrap gap-2">
              <PaymentMethodChip method="MTN_MOMO" />
              <PaymentMethodChip method="ORANGE_MONEY" />
              <PaymentMethodChip method="QUATAPAY" />
            </div>
          </motion.div>

          {/* Trust Strip */}
          <motion.ul
            className="flex flex-wrap justify-center gap-x-6 gap-y-2 md:justify-start pt-2"
            {...rise(0.30)}
          >
            {trust.map((it, i) => {
              const Icon = it.icon;
              return (
                <li key={i} className="inline-flex items-center gap-2 text-xs font-semibold text-text-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-400/10 text-accent-400">
                    <Icon size={12} />
                  </span>
                  {it.label}
                </li>
              );
            })}
          </motion.ul>
        </div>

        {/* Right Column: Premium Illustration Frame */}
        <div className="flex justify-center">
          <motion.div
            className="relative w-full max-w-[460px] rounded-3xl border border-accent-400/25 bg-surface-1/50 p-2.5 shadow-2xl shadow-accent-400/5 backdrop-blur-md overflow-hidden group"
            {...rise(0.2)}
          >
            {/* Blueprint Grid Overlay */}
            <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-transparent z-10 pointer-events-none" />

            {/* Glowing spot overlay */}
            <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-accent-400/10 blur-3xl opacity-75 group-hover:opacity-100 transition-opacity" />

            {/* Illustration */}
            <div className="relative rounded-2xl overflow-hidden border border-border/80 aspect-[16/10] shadow-inner bg-bg/50">
              <img
                src="/images/escrow_vault_illustration.jpg"
                alt="Quata P2P Escrow Vault Protection"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            </div>

            {/* Overlaid Float Status Badge */}
            <div className="absolute bottom-6 left-6 right-6 z-20 flex justify-between items-center bg-surface-2/85 backdrop-blur-md border border-accent-400/35 rounded-xl p-3.5 shadow-lg">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-400"></span>
                </span>
                <span className="text-[11px] font-bold tracking-wider text-text-1 uppercase">ESCROW ACTIVE</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-accent-200 font-bold font-money">
                <Sparkles size={13} className="text-accent-400" />
                <span>100% SECURED</span>
              </div>
            </div>

            {/* Glowing borders */}
            <div className="absolute -inset-px -z-10 bg-gradient-to-r from-accent-400/20 via-transparent to-accent-400/20 opacity-0 group-hover:opacity-100 blur transition-all duration-500 rounded-3xl" />
          </motion.div>
        </div>

      </div>
    </section>
  );
}
