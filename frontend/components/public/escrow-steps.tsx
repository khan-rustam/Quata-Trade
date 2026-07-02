"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { Lock, Send, ShieldCheck } from "lucide-react";
import { AnimatedKeyhole } from "@/components/brand/animated-keyhole";
import { cn } from "@/lib/utils";

const ICONS = [Lock, Send, ShieldCheck] as const;

/**
 * "How a trade stays safe" — a sticky lock panel whose active step advances and
 * whose progress line fills as you scroll, driven entirely by Framer Motion
 * (useScroll). CSS `sticky` keeps the lock pinned; reduced-motion collapses to a
 * static list (Documents/11 §11.7). No GSAP, no design assets.
 */
export function EscrowSteps(): React.JSX.Element {
  const t = useTranslations("landing.steps");
  const reduce = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const { scrollYProgress } = useScroll({ target: root, offset: ["start 60%", "end 70%"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (reduce) return;
    setActive(v < 0.34 ? 0 : v < 0.67 ? 1 : 2);
  });

  const items = [0, 1, 2].map((i) => ({
    n: i + 1,
    Icon: ICONS[i],
    title: t(`s${i + 1}Title`),
    body: t(`s${i + 1}Body`),
  }));

  return (
    <div ref={root} className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
      <div className="grid gap-10 md:grid-cols-[0.9fr_1.1fr] md:gap-14">
        {/* sticky lock panel */}
        <div className="md:sticky md:top-24 md:h-fit">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-accent-400">{t("eyebrow")}</p>
          <h2 className="text-balance font-display text-3xl font-bold tracking-tight md:text-4xl">{t("title")}</h2>
          <div className="mt-8 flex items-center gap-5 rounded-card border border-border bg-surface-1 p-6">
            <AnimatedKeyhole size={96} />
            <div>
              <div className="font-money text-xs tabular-nums text-text-3">{t("stepLabel", { n: active + 1 })}</div>
              <div className="mt-1 font-display text-lg font-medium text-text-1">{items[active]?.title}</div>
            </div>
          </div>
        </div>

        {/* steps rail */}
        <div className="relative">
          <span
            className="pointer-events-none absolute left-[19px] top-3 hidden h-[calc(100%-1.5rem)] w-px bg-border md:block"
            aria-hidden
          />
          <motion.span
            aria-hidden
            style={{ scaleY: reduce ? 1 : scrollYProgress }}
            className="pointer-events-none absolute left-[19px] top-3 hidden h-[calc(100%-1.5rem)] w-px origin-top bg-accent-400 md:block"
          />
          <div className="flex flex-col gap-6">
            {items.map((it, i) => {
              const Icon = it.Icon;
              const isActive = active === i;
              return (
                <div
                  key={it.n}
                  className={cn(
                    "relative rounded-card border p-6 transition-colors duration-300 md:pl-16",
                    isActive ? "border-accent-400/60 bg-surface-1" : "border-border bg-surface-1/40",
                  )}
                >
                  <span
                    className={cn(
                      "absolute left-1.5 top-6 hidden h-9 w-9 items-center justify-center rounded-full border transition-colors md:flex",
                      isActive
                        ? "border-accent-400 bg-accent-400 text-[#0e1416]"
                        : "border-border bg-surface-2 text-text-3",
                    )}
                    aria-hidden
                  >
                    <Icon size={16} />
                  </span>
                  <h3 className="font-display text-lg font-medium text-text-1">{it.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-2">{it.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
