import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ShieldCheck } from "lucide-react";
import { zPublicTrader, type PublicTrader } from "@quatatrade/shared";
import { API_BASE_URL } from "@/lib/env";
import { Section } from "@/components/public/marketing";
import { Reveal } from "@/components/motion/reveal";
import { Avatar } from "@/components/ui/avatar";
import { ReputationBadge } from "@/components/ui/reputation-badge";
import { buttonClassName } from "@/components/ui/button";

async function fetchTrader(id: string): Promise<PublicTrader | null> {
  const res = await fetch(`${API_BASE_URL}/api/v1/traders/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  const parsed = zPublicTrader.safeParse(await res.json());
  return parsed.success ? parsed.data : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const trader = await fetchTrader(id);
  return { title: trader ? `${trader.displayName} — QuataTrade` : "Trader — QuataTrade" };
}

export default async function TraderProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const [t, locale, trader] = await Promise.all([getTranslations("trader"), getLocale(), fetchTrader(id)]);
  if (!trader) notFound();

  const verified = trader.kycTier >= 2;
  const memberSince = new Date(trader.memberSince).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", {
    year: "numeric",
    month: "long",
  });

  const stats: { label: string; value: string }[] = [
    { label: t("completedTrades"), value: trader.completedTrades.toString() },
    { label: t("completionRate"), value: `${trader.completionRate}%` },
    { label: t("activeOffers"), value: trader.activeOffers.toString() },
    { label: t("kycTier"), value: trader.kycTier.toString() },
  ];

  return (
    <Section narrow>
      <Reveal>
        <div className="rounded-card border border-border bg-surface-1 p-6">
          <div className="flex items-start gap-4">
            <Avatar
              seed={trader.avatarSeed ?? trader.id}
              style={trader.avatarStyle}
              name={trader.displayName}
              size={72}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate font-display text-2xl font-bold tracking-tight">{trader.displayName}</h1>
                {verified && (
                  <span className="inline-flex items-center gap-1 rounded-chip bg-accent-400/12 px-2 py-0.5 text-xs font-medium text-accent-400">
                    <ShieldCheck size={12} aria-hidden /> {t("verified")}
                  </span>
                )}
                <ReputationBadge tier={trader.reputationTier} label={t(`tier${trader.reputationTier}`)} />
              </div>
              <p className="mt-1 text-sm text-text-3">{t("memberSince", { date: memberSince })}</p>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-text-2">{trader.bio ?? t("noBio")}</p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-card border border-border bg-surface-2/50 p-4 text-center">
                <div className="font-money text-xl font-semibold tabular-nums text-text-1">{s.value}</div>
                <div className="mt-1 text-xs text-text-3">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.08} className="mt-6 flex flex-wrap items-center gap-3">
        <Link href="/register" className={buttonClassName({ size: "lg" })}>
          {t("cta", { name: trader.displayName })}
        </Link>
        <Link href="/how-it-works" className="text-sm text-text-2 hover:text-text-1">
          {t("viewOffers")}
        </Link>
      </Reveal>
    </Section>
  );
}
