"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { toDisplay } from "@quatatrade/shared";
import { api } from "@/lib/api/client";
import { motion, useReducedMotion } from "motion/react";
import { Percent, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function FeeCalculator(): React.JSX.Element {
  const t = useTranslations("fees");
  const reduce = useReducedMotion();

  const [volume, setVolume] = useState<number>(250);
  const [promoMode, setPromoMode] = useState<boolean>(true);
  const [method, setMethod] = useState<"QUATAPAY" | "MOMO_ORANGE">("QUATAPAY");

  // Read the configured schedule so this widget cannot illustrate a fee the
  // platform does not actually charge. Falls back to the seeded defaults while
  // loading / offline so the calculator always renders something coherent.
  const { data: schedule } = useQuery({
    queryKey: ["fee-schedule"],
    queryFn: () => api.feeSchedule(),
    staleTime: 5 * 60_000,
  });
  const depositFee = schedule ? Number(toDisplay(schedule.depositFee.fixed, "USDT_TRC20", 2)) : 1;
  const quatapayPct = (schedule?.tradingFeeBps.QUATAPAY ?? 30) / 100;
  const momoPct = (schedule?.tradingFeeBps.MTN_MOMO ?? 50) / 100;

  // Trading fee rate
  // If promo is active, trade fee is 0%. Otherwise, 0.3% for QuataPay, 0.5% for MoMo/OM
  const tradeFeeRate = promoMode ? 0 : (method === "QUATAPAY" ? quatapayPct : momoPct) / 100;
  const tradeFeeAmount = volume * tradeFeeRate;

  // Total fees (Trade + flat Deposit)
  const totalFees = tradeFeeAmount + depositFee;
  const netUSDT = Math.max(0, volume - totalFees);

  // Competitor standard fees (usually around 1% to 2% flat P2P fees)
  const competitorFeeRate = 0.015; // 1.5%
  const competitorFees = volume * competitorFeeRate + 2.5; // 1.5% + network flat fee
  const savings = Math.max(0, competitorFees - totalFees);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-1/40 p-6 md:p-8 backdrop-blur-md">
      {/* Grid Pattern Background */}
      <div className="absolute inset-0 -z-10 bg-grid-pattern opacity-25" aria-hidden />

      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:gap-12 items-center">
        {/* Left Side: Inputs */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-400/10 text-accent-400">
              <Percent size={12} />
            </span>
            <h3 className="font-display text-xl font-bold text-text-1">Interactive Cost Estimator</h3>
          </div>

          {/* Pricing Tier Selector */}
          <div className="flex bg-surface-2/60 p-1 rounded-xl border border-border max-w-sm">
            <button
              key="promo-mode-btn"
              type="button"
              onClick={() => setPromoMode(true)}
              className={cn(
                "flex-1 rounded-lg py-2 text-xs font-semibold transition-all",
                promoMode 
                  ? "bg-accent-400 text-bg shadow-md" 
                  : "text-text-2 hover:text-text-1"
              )}
            >
              Launch Promo (0%)
            </button>
            <button
              key="standard-mode-btn"
              type="button"
              onClick={() => setPromoMode(false)}
              className={cn(
                "flex-1 rounded-lg py-2 text-xs font-semibold transition-all",
                !promoMode 
                  ? "bg-accent-400 text-bg shadow-md" 
                  : "text-text-2 hover:text-text-1"
              )}
            >
              Standard Rates
            </button>
          </div>

          {/* Slider input */}
          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-3">
                Volume to Trade
              </label>
              <span className="font-money text-lg font-bold text-accent-400 tabular-nums">
                {volume} <span className="text-xs font-normal text-text-3">USDT</span>
              </span>
            </div>
            <input
              type="range"
              aria-label={t("calcVolumeAria")}
              aria-valuetext={`${volume} USDT`}
              min="10"
              max="2000"
              step="10"
              value={volume}
              onChange={(e) => setVolume(parseInt(e.target.value))}
              className="w-full h-1.5 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-accent-400"
            />
            <div className="flex justify-between text-[10px] text-text-3 font-money">
              <span>10 USDT</span>
              <span>1,000 USDT</span>
              <span>2,000 USDT</span>
            </div>
          </div>

          {/* Payment Method Option Selector (Only visible for Standard Rates) */}
          <div className={cn("transition-all duration-300", promoMode ? "opacity-40 pointer-events-none" : "opacity-100")}>
            <label className="text-xs font-semibold uppercase tracking-wider text-text-3">
              Payment Method
            </label>
            <div className="mt-2 flex gap-3">
              <button
                key="method-quatapay-btn"
                type="button"
                onClick={() => setMethod("QUATAPAY")}
                className={cn(
                  "flex-1 rounded-xl border p-3 text-center transition-all text-xs font-semibold",
                  method === "QUATAPAY"
                    ? "border-accent-400 bg-accent-400/10 text-accent-400"
                    : "border-border bg-surface-2/40 text-text-2 hover:bg-surface-2"
                )}
              >
                {t("calcRailQuatapay", { pct: quatapayPct })}
              </button>
              <button
                key="method-momo-orange-btn"
                type="button"
                onClick={() => setMethod("MOMO_ORANGE")}
                className={cn(
                  "flex-1 rounded-xl border p-3 text-center transition-all text-xs font-semibold",
                  method === "MOMO_ORANGE"
                    ? "border-accent-400 bg-accent-400/10 text-accent-400"
                    : "border-border bg-surface-2/40 text-text-2 hover:bg-surface-2"
                )}
              >
                {t("calcRailMomo", { pct: momoPct })}
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Cost Breakdown Cards */}
        <div className="rounded-xl border border-border bg-surface-2/30 p-5 md:p-6 space-y-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-3">
            Estimated Cost Breakdown
          </span>

          <div className="space-y-3 font-money text-sm">
            <div className="flex justify-between items-center py-1.5 border-b border-border/40">
              <span className="text-text-2 font-sans text-xs">{t("calcDepositFee")}</span>
              <span className="text-text-1 font-semibold tabular-nums">{depositFee} USDT</span>
            </div>
            
            <div className="flex justify-between items-center py-1.5 border-b border-border/40">
              <span className="text-text-2 font-sans text-xs">{t("calcTradingFee", { pct: tradeFeeRate * 100 })}</span>
              <span className="text-text-1 font-semibold tabular-nums">{tradeFeeAmount.toFixed(2)} USDT</span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-border/40">
              <span className="text-text-2 font-sans text-xs">Withdrawal Platform Fee</span>
              <span className="text-accent-400 font-semibold tabular-nums">0 USDT</span>
            </div>

            <div className="flex justify-between items-center py-2.5">
              <span className="text-text-1 font-sans text-xs font-bold">{t("calcTotalNet")}</span>
              <span className="text-accent-400 text-lg font-bold tabular-nums">{netUSDT.toFixed(2)} USDT</span>
            </div>
          </div>

          {/* Competitor savings callout card */}
          {savings > 0 && (
            <motion.div
              initial={{ scale: reduce ? 1 : 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="rounded-lg bg-accent-400/10 border border-accent-400/25 p-3.5 flex items-start gap-2.5"
            >
              <Zap size={16} className="text-accent-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-accent-400">{t("calcSavings", { amount: savings.toFixed(1) })}</div>
                <div className="text-[10px] text-text-2 font-sans leading-relaxed mt-0.5">
                  Compared to traditional high-fee P2P exchangers.
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
