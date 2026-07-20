"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Lock, Send, ShieldCheck, Sparkles } from "lucide-react";
import { PaymentMethodChip, paymentMethodLabel } from "@/components/trade/payment-method-chip";
import { cn } from "@/lib/utils";

const EXCHANGE_RATE = 650; // 1 USDT = 650 XAF constant for demo

export function EscrowSimulator(): React.JSX.Element {
  const t = useTranslations("landing.simulator");
  const reduce = useReducedMotion();

  const [amount, setAmount] = useState<number>(100);
  const [method, setMethod] = useState<"QUATAPAY" | "MTN_MOMO" | "ORANGE_MONEY">("QUATAPAY");
  const [step, setStep] = useState<number>(0);

  // Fee rates come from the configured schedule so this illustration cannot show
  // a rate the platform does not charge; seeded defaults are the offline fallback.
  const { data: schedule } = useQuery({
    queryKey: ["fee-schedule"],
    queryFn: () => api.feeSchedule(),
    staleTime: 5 * 60_000,
  });
  const feeRate =
    (schedule?.tradingFeeBps[method] ?? (method === "QUATAPAY" ? 30 : 50)) / 10_000;
  const feeAmount = amount * feeRate;
  const netAmount = amount - feeAmount;
  const cashAmount = amount * EXCHANGE_RATE;

  const methodName = paymentMethodLabel(method);

  const steps = [
    {
      title: t("step1Title"),
      desc: t("step1Desc"),
      icon: Lock,
      color: "text-accent-400 border-accent-400/30 bg-accent-400/5",
    },
    {
      title: t("step2Title"),
      desc: t("step2Desc", { method: methodName }),
      icon: Send,
      color: "text-warning border-warning/30 bg-warning/5",
    },
    {
      title: t("step3Title"),
      desc: t("step3Desc"),
      icon: ShieldCheck,
      color: "text-success border-success/30 bg-success/5",
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-1/40 p-6 md:p-8 backdrop-blur-md">
      {/* Blueprint Grid Overlay background */}
      <div className="absolute inset-0 -z-10 bg-grid-pattern opacity-30" aria-hidden />
      
      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-12">
        {/* Left pane: Simulator Inputs & Math */}
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-400/10 text-accent-400">
              <Sparkles size={12} />
            </span>
            <h3 className="font-display text-xl font-bold text-text-1 md:text-2xl">{t("title")}</h3>
          </div>
          <p className="mt-2 text-sm text-text-2">{t("subtitle")}</p>

          <div className="mt-6 space-y-4">
            {/* Input field */}
            <div>
              <label
                htmlFor="escrow-sim-amount"
                className="text-xs font-semibold uppercase tracking-wider text-text-3"
              >
                {t("labelAmount")} (USDT)
              </label>
              <div className="relative mt-2 rounded-xl border border-border bg-surface-2 focus-within:border-accent-400 focus-within:ring-2 focus-within:ring-accent-400/20 transition-all">
                <input
                  id="escrow-sim-amount"
                  type="number"
                  min="5"
                  max="10000"
                  value={amount || ""}
                  onChange={(e) => setAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full bg-transparent px-4 py-3 font-money text-lg font-semibold text-text-1 focus:outline-none"
                />
                <span className="absolute right-4 top-3.5 font-sans text-xs font-medium text-text-3">
                  ≈ {(amount * EXCHANGE_RATE).toLocaleString()} XAF
                </span>
              </div>
            </div>

            {/* Method selector */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-text-3">
                {t("selectMethod")}
              </label>
              <div className="mt-2 grid grid-cols-3 gap-3">
                {(["QUATAPAY", "MTN_MOMO", "ORANGE_MONEY"] as const).map((m) => {
                  const isActive = method === m;
                  
                  // Style configurations per partner
                  const config = {
                    QUATAPAY: {
                      name: "QuataPay",
                      fee: "0.3% fee",
                      activeClass: "border-accent-400 bg-accent-400/5 ring-1 ring-accent-400/20",
                      dotBg: "bg-accent-400",
                      badgeClass: "bg-accent-400/10 text-accent-400",
                    },
                    MTN_MOMO: {
                      name: "MTN MoMo",
                      fee: "0.5% fee",
                      activeClass: "border-warning bg-warning/5 ring-1 ring-warning/20",
                      dotBg: "bg-warning",
                      badgeClass: "bg-warning/10 text-warning",
                    },
                    ORANGE_MONEY: {
                      name: "Orange Money",
                      fee: "0.5% fee",
                      activeClass: "border-danger bg-danger/5 ring-1 ring-danger/20",
                      dotBg: "bg-danger",
                      badgeClass: "bg-danger/10 text-danger",
                    },
                  }[m];

                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={cn(
                        "relative flex flex-col justify-between items-start gap-4 rounded-xl border p-3.5 text-left transition-all duration-300",
                        isActive
                          ? config.activeClass
                          : "border-border bg-surface-2/40 hover:bg-surface-2 hover:border-border/80"
                      )}
                    >
                      {/* Top row: indicator dot + name */}
                      <div className="w-full flex items-center justify-between">
                        <span className="text-xs font-semibold text-text-1">{config.name}</span>
                        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-border bg-bg/50">
                          {isActive && (
                            <span className={cn("h-1.5 w-1.5 rounded-full", config.dotBg)} />
                          )}
                        </span>
                      </div>
                      
                      {/* Bottom row: fee badge */}
                      <span className={cn("rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase", config.badgeClass)}>
                        {config.fee}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="rounded-xl border border-border bg-surface-2/50 p-4 space-y-2.5">
              <div className="flex justify-between text-xs text-text-2">
                <span>{t("feeRate")} ({feeRate * 100}%)</span>
                <span className="font-money tabular-nums">
                  {feeAmount.toFixed(2)} USDT
                </span>
              </div>
              
              {method === "QUATAPAY" && (
                <div className="flex items-center gap-1.5 text-xs text-accent-400 font-medium">
                  <Sparkles size={12} />
                  <span>{t("savings")}</span>
                </div>
              )}

              <div className="border-t border-border/60 pt-2.5 flex justify-between items-baseline">
                <span className="text-sm font-medium text-text-1">{t("youReceive")}</span>
                <span className="font-money text-lg font-bold text-accent-400 tabular-nums">
                  {(cashAmount - (feeAmount * EXCHANGE_RATE)).toLocaleString()} XAF
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right pane: Interactive Escrow Simulator Steps */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface-2/30 p-5 md:p-6">
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-3">
                Escrow Live Demo
              </span>
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 w-6 rounded-full transition-colors",
                      step === i ? "bg-accent-400" : "bg-border"
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Main simulation graphic container */}
            <div className="relative flex items-center justify-center min-h-[140px] rounded-lg border border-border bg-bg/50 overflow-hidden py-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, scale: 0.95, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -5 }}
                  transition={{ duration: reduce ? 0.01 : 0.25 }}
                  className="flex flex-col items-center text-center px-4"
                >
                  {/* Step Icon with animations */}
                  <div className={cn("flex h-12 w-12 items-center justify-center rounded-full border mb-3", steps[step].color)}>
                    {step === 0 && (
                      <motion.div animate={{ rotate: [0, -10, 10, 0] }} transition={{ repeat: Infinity, duration: 2.5, repeatDelay: 1.5 }}>
                        <Lock size={22} />
                      </motion.div>
                    )}
                    {step === 1 && (
                      <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                        <Send size={20} />
                      </motion.div>
                    )}
                    {step === 2 && (
                      <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                        <ShieldCheck size={22} />
                      </motion.div>
                    )}
                  </div>
                  <h4 className="font-display font-semibold text-text-1">{steps[step].title}</h4>
                  <p className="mt-1 max-w-[280px] text-xs text-text-2">{steps[step].desc}</p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Stepper Buttons */}
          <div className="mt-6 flex gap-3">
            <button
              key="prev-btn"
              type="button"
              onClick={() => setStep((s) => (s > 0 ? s - 1 : 2))}
              className="flex-1 rounded-btn border border-border bg-surface-3/30 py-2.5 text-xs font-semibold hover:bg-surface-3 transition-colors"
            >
              Previous
            </button>
            <button
              key="next-btn"
              type="button"
              onClick={() => setStep((s) => (s < 2 ? s + 1 : 0))}
              className="flex-1 rounded-btn bg-accent-400 py-2.5 text-xs font-semibold text-bg hover:bg-accent-400/90 transition-colors shadow-lg shadow-accent-400/10"
            >
              {step === 2 ? "Reset Demo" : "Next Step"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
