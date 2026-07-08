"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { api } from "@/lib/api/client";

const REFRESH_MS = 300_000;

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

/**
 * Crypto news (CryptoPanic). Renders nothing when the feed is empty (no
 * CRYPTOPANIC_API_KEY configured), so the section simply switches on once set.
 */
export function MarketNews(): React.JSX.Element | null {
  const tx = useTranslations("markets");
  const { data } = useQuery({ queryKey: ["markets", "news"], queryFn: () => api.marketsNews(), refetchInterval: REFRESH_MS });
  const items = data?.items ?? [];
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-medium">{tx("newsTitle")}</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.slice(0, 8).map((n, i) => (
          <a
            key={i}
            href={n.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl border border-border p-3 transition-colors hover:bg-surface-2"
          >
            <p className="line-clamp-2 text-sm font-medium">{n.title}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-text-3">
              <span>{n.source}</span>
              {n.publishedAt && <span>· {timeAgo(n.publishedAt)}</span>}
              {n.currencies.slice(0, 3).map((c) => (
                <span key={c} className="rounded bg-surface-2 px-1.5 py-0.5 font-money text-text-2">
                  {c}
                </span>
              ))}
              <ExternalLink size={11} className="ml-auto" />
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
