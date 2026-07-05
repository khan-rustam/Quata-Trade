import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

export function Section({
  children,
  className,
  narrow,
}: {
  children: ReactNode;
  className?: string;
  narrow?: boolean;
}): React.JSX.Element {
  return (
    <section className={cn("mx-auto px-4 py-14 md:px-6 md:py-20", narrow ? "max-w-3xl" : "max-w-6xl", className)}>
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  center,
  as: Heading = "h2",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  center?: boolean;
  /** Render as `h1` when this is the page's main heading (one per page). */
  as?: "h1" | "h2";
}): React.JSX.Element {
  return (
    <div className={cn("max-w-2xl", center && "mx-auto text-center")}>
      {eyebrow && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-accent-400">{eyebrow}</p>
      )}
      <Heading className="font-display text-3xl font-bold tracking-tight md:text-4xl">{title}</Heading>
      {subtitle && <p className="mt-3 text-lg text-text-2">{subtitle}</p>}
    </div>
  );
}

export function FeatureCard({
  icon: Icon,
  title,
  children,
}: {
  icon: ComponentType<LucideProps>;
  title: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-surface-1 p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-400/15 text-accent-400">
        <Icon size={20} aria-hidden />
      </div>
      <h3 className="mt-4 font-display text-lg font-medium">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-text-2">{children}</p>
    </div>
  );
}

export function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <div className="relative rounded-xl border border-border bg-surface-1 p-5">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-400 font-display text-sm font-bold text-bg">
        {n}
      </span>
      <h3 className="mt-3 font-display text-base font-medium">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-text-2">{children}</p>
    </div>
  );
}
