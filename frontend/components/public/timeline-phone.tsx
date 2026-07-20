"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Smartphone, Sparkles, Shield, Send, CheckCircle2, User, Coins, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [1, 2, 3, 4] as const;

export function TimelinePhone(): React.JSX.Element {
  const t = useTranslations("howItWorks");
  const reduce = useReducedMotion();

  const [mode, setMode] = useState<"BUY" | "SELL">("BUY");
  const [activeStep, setActiveStep] = useState<number>(1);

  const heading = mode === "BUY" ? t("buyHeading") : t("sellHeading");

  const getPhoneScreen = () => {
    if (mode === "BUY") {
      switch (activeStep) {
        case 1:
          return (
            <div className="flex flex-col h-full bg-bg p-4 justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
                  <span className="text-[11px] font-semibold text-text-3">{t("phBuyUsdt")}</span>
                  <span className="h-2 w-2 rounded-full bg-accent-400" />
                </div>
                <div className="space-y-2.5">
                  <div className="rounded-lg border border-border bg-surface-1 p-2.5 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-text-1">{t("phTrader", { name: "Jean M.", rate: 99 })}</div>
                      <div className="text-[10px] text-text-3">{t("phTraderMeta", { rate: 651, limits: "20-500" })}</div>
                    </div>
                    <span className="rounded-md bg-accent-400/10 px-2 py-1 text-[10px] font-bold text-accent-400">{t("phBuy")}</span>
                  </div>
                  <div className="rounded-lg border border-border bg-surface-1 p-2.5 flex items-center justify-between opacity-60">
                    <div>
                      <div className="text-xs font-semibold text-text-1">{t("phTrader", { name: "Amina T.", rate: 96 })}</div>
                      <div className="text-[10px] text-text-3">{t("phTraderMeta", { rate: 652, limits: "50-1000" })}</div>
                    </div>
                    <span className="rounded-md bg-accent-400/10 px-2 py-1 text-[10px] font-bold text-accent-400">{t("phBuy")}</span>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-center text-text-3">{t("phFindRates")}</p>
            </div>
          );
        case 2:
          return (
            <div className="flex flex-col h-full bg-bg p-4 justify-between items-center text-center">
              <div className="w-full flex items-center justify-between mb-4 border-b border-border pb-2 text-left">
                <span className="text-[11px] font-semibold text-text-3">{t("phEscrowLocked")}</span>
                <Shield size={12} className="text-accent-400" />
              </div>
              <div className="my-auto flex flex-col items-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-400/15 border border-accent-400/30 text-accent-400 mb-3 shadow-[0_0_20px_rgba(47,212,167,0.15)]">
                  <Shield size={26} />
                </div>
                <div className="font-money text-base font-semibold text-text-1">100.00 USDT</div>
                <div className="mt-1 text-[10px] text-text-3 px-3 uppercase tracking-wider">
                  Held Safely in Escrow
                </div>
              </div>
              <p className="text-[10px] text-text-3">{t("phLockedLedger")}</p>
            </div>
          );
        case 3:
          return (
            <div className="flex flex-col h-full bg-bg p-4 justify-between">
              <div>
                <div className="flex items-center justify-between mb-3 border-b border-border pb-2">
                  <span className="text-[11px] font-semibold text-text-3">{t("phPaySeller")}</span>
                  <span className="text-[10px] font-money text-warning">29:55</span>
                </div>
                <div className="rounded-lg border border-border bg-surface-1 p-2.5 space-y-2">
                  <div className="text-[10px] text-text-3 uppercase">{t("phMtnMomo")}</div>
                  <div className="text-xs font-semibold text-text-1">Name: Jean Marc</div>
                  <div className="text-xs font-semibold text-text-1 font-money">Number: 677 88 99 00</div>
                  <div className="text-xs font-bold text-accent-400 font-money">Amount: 65,000 XAF</div>
                </div>
              </div>
              <div className="rounded-md border border-dashed border-border bg-surface-1/50 p-2 text-center text-[10px] text-text-2">
                [ Upload MoMo Receipt ]
              </div>
            </div>
          );
        case 4:
          return (
            <div className="flex flex-col h-full bg-bg p-4 justify-between items-center text-center">
              <div className="w-full flex items-center justify-between mb-4 border-b border-border pb-2 text-left">
                <span className="text-[11px] font-semibold text-text-3">{t("phSuccess")}</span>
                <CheckCircle2 size={12} className="text-success" />
              </div>
              <div className="my-auto flex flex-col items-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 border border-success/30 text-success mb-3">
                  <Check size={26} />
                </div>
                <div className="text-sm font-bold text-text-1">Trade Completed!</div>
                <div className="mt-1 text-[10px] text-text-2">
                  100.00 USDT added to your wallet
                </div>
              </div>
              <p className="text-[10px] text-text-3">{t("phZeroRisk")}</p>
            </div>
          );
      }
    } else {
      // SELL mode
      switch (activeStep) {
        case 1:
          return (
            <div className="flex flex-col h-full bg-bg p-4 justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
                  <span className="text-[11px] font-semibold text-text-3">{t("phPostOffer")}</span>
                  <span className="h-2 w-2 rounded-full bg-danger" />
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[9px] text-text-3 uppercase">{t("phIWantToSell")}</label>
                    <div className="rounded-md border border-border bg-surface-1 px-2.5 py-1.5 font-money text-xs font-semibold">
                      100.00 USDT
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-text-3 uppercase">{t("phMyRate")}</label>
                    <div className="rounded-md border border-border bg-surface-1 px-2.5 py-1.5 font-money text-xs font-semibold">
                      650 XAF / USDT
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-center text-text-3">{t("phSetRate")}</p>
            </div>
          );
        case 2:
          return (
            <div className="flex flex-col h-full bg-bg p-4 justify-between items-center text-center">
              <div className="w-full flex items-center justify-between mb-4 border-b border-border pb-2 text-left">
                <span className="text-[11px] font-semibold text-text-3">{t("phEscrowReserve")}</span>
                <Shield size={12} className="text-accent-400" />
              </div>
              <div className="my-auto flex flex-col items-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-400/15 border border-accent-400/30 text-accent-400 mb-3">
                  <Shield size={26} />
                </div>
                <div className="font-money text-base font-semibold text-text-1">100.00 USDT</div>
                <div className="mt-1 text-[10px] text-text-3 px-3 uppercase tracking-wider">
                  Reserved in Escrow
                </div>
              </div>
              <p className="text-[10px] text-text-3">{t("phFundsLocked")}</p>
            </div>
          );
        case 3:
          return (
            <div className="flex flex-col h-full bg-bg p-4 justify-between">
              <div>
                <div className="flex items-center justify-between mb-3 border-b border-border pb-2">
                  <span className="text-[11px] font-semibold text-text-3">{t("phReceiveCash")}</span>
                  <span className="text-[10px] font-money text-warning">{t("phWaiting")}</span>
                </div>
                <div className="rounded-lg border border-border bg-surface-1 p-2.5 text-center my-4 space-y-1">
                  <div className="text-[10px] text-text-3 uppercase">{t("phCheckMomo")}</div>
                  <div className="text-xs font-bold text-text-1">+65,000 XAF received</div>
                  <div className="text-[9px] text-success">Reference: CM188299X</div>
                </div>
              </div>
              <p className="text-[10px] text-center text-text-3">Check your bank or MoMo app first!</p>
            </div>
          );
        case 4:
          return (
            <div className="flex flex-col h-full bg-bg p-4 justify-between items-center text-center">
              <div className="w-full flex items-center justify-between mb-4 border-b border-border pb-2 text-left">
                <span className="text-[11px] font-semibold text-text-3">{t("phReleased")}</span>
                <CheckCircle2 size={12} className="text-success" />
              </div>
              <div className="my-auto flex flex-col items-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 border border-success/30 text-success mb-3">
                  <Check size={26} />
                </div>
                <div className="text-sm font-bold text-text-1">{t("phUsdtReleased")}</div>
                <div className="mt-1 text-[10px] text-text-2">
                  Buyer credited successfully
                </div>
              </div>
              <p className="text-[10px] text-text-3">{t("phSettled")}</p>
            </div>
          );
      }
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-1/40 p-6 md:p-8">
      {/* Background blueprint pattern */}
      <div className="absolute inset-0 -z-10 bg-grid-pattern opacity-25" aria-hidden />

      {/* Selector Tabs */}
      <div className="flex justify-center gap-4 mb-10">
        <button
          key="buy-mode-btn"
          type="button"
          onClick={() => {
            setMode("BUY");
            setActiveStep(1);
          }}
          className={cn(
            "rounded-btn px-6 py-2.5 text-xs font-semibold transition-all border",
            mode === "BUY"
              ? "border-accent-400 bg-accent-400/10 text-accent-400"
              : "border-border bg-surface-2/40 text-text-2 hover:bg-surface-2"
          )}
        >
          {t("buyHeading")}
        </button>
        <button
          key="sell-mode-btn"
          type="button"
          onClick={() => {
            setMode("SELL");
            setActiveStep(1);
          }}
          className={cn(
            "rounded-btn px-6 py-2.5 text-xs font-semibold transition-all border",
            mode === "SELL"
              ? "border-accent-400 bg-accent-400/10 text-accent-400"
              : "border-border bg-surface-2/40 text-text-2 hover:bg-surface-2"
          )}
        >
          {t("sellHeading")}
        </button>
      </div>

      <div className="grid gap-10 md:grid-cols-[1.1fr_0.9fr] md:gap-14 items-center">
        {/* Left Side: Step Steppers */}
        <div className="space-y-4">
          <h3 className="font-display text-2xl font-bold text-text-1">{heading}</h3>
          
          <div className="relative border-l border-border pl-6 space-y-6 mt-6 ml-3">
            {STEPS.map((stepNum) => {
              const isActive = activeStep === stepNum;
              const title = mode === "BUY" ? t(`buyStep${stepNum}Title`) : t(`sellStep${stepNum}Title`);
              const body = mode === "BUY" ? t(`buyStep${stepNum}Body`) : t(`sellStep${stepNum}Body`);

              return (
                <div
                  key={stepNum}
                  onClick={() => setActiveStep(stepNum)}
                  className={cn(
                    "relative group cursor-pointer border rounded-xl p-4 transition-all duration-300",
                    isActive
                      ? "border-accent-400/60 bg-surface-1 shadow-[0_4px_20px_rgba(47,212,167,0.06)]"
                      : "border-border/60 bg-surface-1/40 hover:bg-surface-2/40"
                  )}
                >
                  {/* Glowing vertical line connector item */}
                  <span
                    className={cn(
                      "absolute -left-[31px] top-6 flex h-4 w-4 items-center justify-center rounded-full border transition-colors",
                      isActive
                        ? "border-accent-400 bg-accent-400 text-bg shadow-[0_0_10px_var(--color-accent-400)]"
                        : "border-border bg-bg text-text-3"
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  </span>
                  <div className="text-[10px] font-semibold text-accent-400 tracking-wider mb-0.5">
                    STEP 0{stepNum}
                  </div>
                  <h4 className="font-display text-sm font-semibold text-text-1">{title}</h4>
                  <p className="mt-1 text-xs text-text-2 leading-relaxed">{body}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Mock Phone Container */}
        <div className="flex justify-center">
          <div className="relative w-[240px] h-[480px] rounded-[2.5rem] border-4 border-border bg-surface-2 p-3 shadow-2xl shadow-black/40">
            {/* Phone Speaker notch */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 h-4 w-20 rounded-full bg-border" />
            
            {/* Phone Screen Container */}
            <div className="w-full h-full rounded-[2rem] overflow-hidden border border-border bg-bg relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${mode}-${activeStep}`}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: reduce ? 0.01 : 0.2 }}
                  className="w-full h-full"
                >
                  {getPhoneScreen()}
                </motion.div>
              </AnimatePresence>
            </div>
            
            {/* Bottom home button bar element */}
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 h-1 w-24 rounded-full bg-border" />
          </div>
        </div>
      </div>
    </div>
  );
}
