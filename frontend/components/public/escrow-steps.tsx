"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { motion, useScroll } from "motion/react";
import {
  Banknote,
  Lock,
  Send,
  ShieldCheck,
  Store,
  Terminal,
  Unlock,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Icons for the three timeline cards on the right rail. */
const CARD_ICONS = [Lock, Send, ShieldCheck] as const;

/**
 * A node in the escrow-flow diagram (Seller · Escrow · Buyer). Active nodes lift
 * and gain the escrow glow; the vault swaps its lock for an open lock on release.
 * Icon-only so nodes and rails share one centered baseline — the label sits in
 * the row below via the parent grid. All motion is CSS (transition / motion-safe),
 * so reduced motion is honoured without any SSR/client branch.
 */
function FlowNode({
  icon: Icon,
  active,
  size = "md",
}: {
  icon: React.ComponentType<{ size?: number }>;
  active: boolean;
  size?: "md" | "lg";
}): React.JSX.Element {
  const isLg = size === "lg";
  return (
    <div
      className={cn(
        "relative flex items-center justify-center border transition-all duration-300 motion-reduce:transition-none",
        isLg ? "h-14 w-14 rounded-2xl" : "h-12 w-12 rounded-xl",
        active
          ? "border-accent-400/70 bg-accent-400/10 text-accent-400 shadow-[0_0_18px_rgba(47,212,167,0.18)] motion-safe:scale-[1.06]"
          : "border-border bg-surface-2 text-text-3",
      )}
    >
      <Icon size={isLg ? 24 : 20} />
      {active && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-accent-400/40 motion-safe:animate-ping"
        />
      )}
    </div>
  );
}

/**
 * A connector between two nodes. The accent fill grows from the source end when
 * active; a packet then travels the rail in the flow direction (CSS keyframes,
 * parked under reduced motion).
 */
function Rail({
  active,
  dir,
  dashed = false,
}: {
  active: boolean;
  dir: "ltr" | "rtl";
  dashed?: boolean;
}): React.JSX.Element {
  const ltr = dir === "ltr";
  return (
    <div className="relative flex h-6 w-full items-center px-1">
      <div className="relative h-px w-full">
        {/* base track */}
        <div
          className={cn(
            "absolute inset-0",
            dashed ? "border-t border-dashed border-border" : "bg-border",
          )}
        />
        {/* accent fill — grows from the source end */}
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 bg-accent-400 transition-transform duration-500 ease-out motion-reduce:transition-none",
            ltr ? "origin-left" : "origin-right",
            active ? "scale-x-100" : "scale-x-0",
            active && "shadow-[0_0_8px_var(--color-accent-400)]",
            dashed && "opacity-80",
          )}
        />
        {/* travelling packet */}
        {active && (
          <span
            aria-hidden
            className={cn(
              "absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-accent-200 shadow-[0_0_10px_var(--color-accent-400)]",
              ltr ? "qt-rail-ltr" : "qt-rail-rtl",
            )}
          />
        )}
      </div>
    </div>
  );
}

export function EscrowSteps(): React.JSX.Element {
  const t = useTranslations("landing.steps");
  const root = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [active, setActive] = useState(0);

  // Laser fill on the right rail tracks raw scroll progress (decorative only).
  const { scrollYProgress } = useScroll({ target: root, offset: ["start 60%", "end 70%"] });

  // Active phase = the timeline card nearest the viewport's reading line. A global
  // progress-threshold split compressed to a few pixels and skipped the middle
  // phase; this scrollspy is robust to section height and maps the sticky flow
  // visual to whichever step is actually in view. rAF-throttled so it stays cheap.
  useEffect(() => {
    let raf = 0;
    const pick = (): void => {
      raf = 0;
      const els = cardRefs.current.filter((el): el is HTMLDivElement => el !== null);
      if (els.length === 0) return;
      const line = window.innerHeight * 0.45;
      let best = 0;
      let bestDist = Infinity;
      els.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const dist = Math.abs(r.top + r.height / 2 - line);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      setActive(best);
    };
    const onScroll = (): void => {
      if (!raf) raf = requestAnimationFrame(pick);
    };
    pick();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const items = [0, 1, 2].map((i) => ({
    n: i + 1,
    Icon: CARD_ICONS[i],
    title: t(`s${i + 1}Title`),
    body: t(`s${i + 1}Body`),
  }));

  // Flow state derived from the active phase.
  const sellerActive = active === 0 || active === 1; // sends USDT, then receives cash
  const buyerActive = active === 1 || active === 2; // pays cash, then receives USDT
  const VaultIcon = active === 2 ? Unlock : Lock;
  const stateLabel = t(`console.state${active + 1}`);
  const message = t(`console.msg${active + 1}`);

  return (
    <div ref={root} className="relative mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
      {/* Blueprint grid backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-10" />

      <div className="relative z-10 grid items-start gap-12 md:grid-cols-[0.95fr_1.05fr] md:gap-16">
        {/* Left: sticky escrow-flow monitor */}
        <div className="space-y-6 md:sticky md:top-28 md:h-fit">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-accent-400">
              {t("eyebrow")}
            </p>
            <h2 className="text-balance font-display text-3xl font-extrabold tracking-tight text-text-1 md:text-4xl">
              {t("title")}
            </h2>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-accent-400/25 bg-surface-1/40 p-5 shadow-xl shadow-accent-400/5 backdrop-blur-md md:p-6">
            {/* ambient inner glow */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent-400/5 to-transparent" />

            <div className="relative space-y-6">
              {/* Escrow-flow diagram: Seller → Vault → Buyer + cash lane */}
              <div className="space-y-3">
                <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-y-2">
                  <div className="col-start-1 row-start-1 flex justify-center">
                    <FlowNode icon={Store} active={sellerActive} />
                  </div>
                  <div className="col-start-2 row-start-1">
                    <Rail active={active === 0} dir="ltr" />
                  </div>
                  <div className="col-start-3 row-start-1 flex justify-center">
                    <FlowNode icon={VaultIcon} active size="lg" />
                  </div>
                  <div className="col-start-4 row-start-1">
                    <Rail active={active === 2} dir="ltr" />
                  </div>
                  <div className="col-start-5 row-start-1 flex justify-center">
                    <FlowNode icon={Wallet} active={buyerActive} />
                  </div>

                  <span className="col-start-1 row-start-2 text-center text-[10px] font-semibold tracking-wide text-text-2">
                    {t("flow.seller")}
                  </span>
                  <span className="col-start-3 row-start-2 text-center text-[10px] font-semibold tracking-wide text-text-2">
                    {t("flow.vault")}
                  </span>
                  <span className="col-start-5 row-start-2 text-center text-[10px] font-semibold tracking-wide text-text-2">
                    {t("flow.buyer")}
                  </span>
                </div>

                {/* Cash lane — buyer pays seller off-platform (right → left) */}
                <div>
                  <Rail active={active === 1} dir="rtl" dashed />
                  <p className="mt-1 flex items-center justify-center gap-1 text-[10px] font-medium tracking-wide text-text-3">
                    <Banknote size={11} aria-hidden />
                    {t("flow.cash")}
                  </p>
                </div>
              </div>

              {/* Ledger console readout */}
              <div className="rounded-xl border border-border bg-bg/70 p-3.5">
                <div className="mb-2.5 flex items-center gap-1.5 border-b border-border/60 pb-2 text-[10px] uppercase tracking-wider text-text-3">
                  <Terminal size={11} className="text-accent-400" aria-hidden />
                  <span>{t("console.label")}</span>
                  <span
                    aria-hidden
                    className="ml-auto h-1.5 w-1.5 rounded-full bg-accent-400 shadow-[0_0_6px_var(--color-accent-400)] motion-safe:animate-pulse"
                  />
                </div>

                <dl className="space-y-1 font-money text-[11px]">
                  <div className="flex justify-between">
                    <dt className="uppercase tracking-wider text-text-3">{t("console.state")}</dt>
                    <dd className="font-bold uppercase text-accent-400">{stateLabel}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="uppercase tracking-wider text-text-3">{t("console.asset")}</dt>
                    <dd className="text-text-1">USDT · TRC20</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="uppercase tracking-wider text-text-3">{t("console.phase")}</dt>
                    <dd className="text-accent-200">0{active + 1} / 03</dd>
                  </div>
                </dl>

                {/* Command line — re-fades on each phase change (keyed remount) */}
                <div className="mt-2.5 flex min-h-[42px] items-start gap-1.5 rounded-lg border border-border bg-surface-1/60 p-2.5">
                  <span aria-hidden className="font-mono text-[10px] leading-relaxed text-accent-400">
                    &gt;
                  </span>
                  <span
                    key={active}
                    className="qt-animate-fade font-mono text-[10px] leading-relaxed text-text-2"
                  >
                    {message}
                    <span
                      aria-hidden
                      className="ml-0.5 inline-block h-3 w-[6px] translate-y-[1px] bg-accent-400 align-middle motion-safe:animate-pulse"
                    />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: timeline rail */}
        <div className="relative">
          {/* base connecting line */}
          <span
            aria-hidden
            className="pointer-events-none absolute left-[42px] top-6 hidden h-[calc(100%-3rem)] w-px bg-border md:block"
          />
          {/* progress fill, driven by scroll */}
          <motion.span
            aria-hidden
            style={{ scaleY: scrollYProgress }}
            className="pointer-events-none absolute left-[42px] top-6 hidden h-[calc(100%-3rem)] w-px origin-top bg-accent-400 shadow-[0_0_10px_var(--color-accent-400)] md:block"
          />

          <div className="flex flex-col gap-5">
            {items.map((it, i) => {
              const Icon = it.Icon;
              const isActive = active === i;
              return (
                <div
                  key={it.n}
                  ref={(el) => {
                    cardRefs.current[i] = el;
                  }}
                  aria-current={isActive ? "step" : undefined}
                  className={cn(
                    "group relative rounded-2xl border p-6 transition-all duration-300 motion-reduce:transition-none md:pl-20",
                    isActive
                      ? "border-accent-400/60 bg-surface-1 shadow-[0_4px_25px_rgba(47,212,167,0.08)] md:motion-safe:scale-[1.015]"
                      : "border-border bg-surface-1/30",
                  )}
                >
                  {/* desktop badge on the rail */}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-5 top-6 hidden h-11 w-11 items-center justify-center rounded-xl border transition-all duration-300 motion-reduce:transition-none md:flex",
                      isActive
                        ? "border-accent-400 bg-accent-400 text-bg shadow-[0_0_18px_rgba(47,212,167,0.35)]"
                        : "border-border bg-surface-2 text-text-3",
                    )}
                  >
                    <Icon size={18} />
                  </span>

                  <span className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-accent-400">
                    <Icon size={13} className="md:hidden" aria-hidden />
                    {t("stepLabel", { n: it.n })}
                  </span>
                  <h3 className="font-display text-lg font-bold text-text-1">{it.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-2">{it.body}</p>

                  {/* active underline */}
                  {isActive && (
                    <span
                      aria-hidden
                      className="qt-animate-fade absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-accent-400 to-transparent"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
