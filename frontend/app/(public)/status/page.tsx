import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Section, SectionHeading } from "@/components/public/marketing";
import { Badge } from "@/components/ui/badge";
import { API_BASE_URL } from "@/lib/env";
import { buildMetadata } from "@/lib/seo-engine";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("status");
  return buildMetadata("/status", { title: t("metaTitle"), description: t("metaDescription") });
}

type Health = {
  reachable: boolean;
  db: string;
  redis: string;
  withdrawalsPaused: boolean;
  tradesPaused: boolean;
};

// Read the real readiness probe server-side so this page reflects actual state
// (and reflects an active kill switch) instead of always claiming "operational".
async function fetchHealth(): Promise<Health> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${API_BASE_URL}/health/ready`, {
      cache: "no-store",
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    // /health/ready returns 200 when core deps are up, 503 (degraded) otherwise.
    const body = (await res.json().catch(() => ({}))) as {
      db?: string;
      redis?: string;
      killSwitches?: { withdrawalsPaused?: boolean; tradesPaused?: boolean };
    };
    return {
      reachable: true,
      db: body.db ?? (res.ok ? "up" : "down"),
      redis: body.redis ?? (res.ok ? "up" : "down"),
      withdrawalsPaused: !!body.killSwitches?.withdrawalsPaused,
      tradesPaused: !!body.killSwitches?.tradesPaused,
    };
  } catch {
    return { reachable: false, db: "down", redis: "down", withdrawalsPaused: false, tradesPaused: false };
  }
}

type Status = "operational" | "degraded" | "paused";

export default async function StatusPage(): Promise<React.JSX.Element> {
  const t = await getTranslations("status");
  const h = await fetchHealth();
  const apiUp = h.reachable && h.db === "up" && h.redis === "up";

  const components: { key: string; label: string; status: Status }[] = [
    { key: "websiteApi", label: t("componentWebsiteApi"), status: apiUp ? "operational" : "degraded" },
    { key: "trading", label: t("componentTrading"), status: !apiUp ? "degraded" : h.tradesPaused ? "paused" : "operational" },
    { key: "deposits", label: t("componentDeposits"), status: apiUp ? "operational" : "degraded" },
    { key: "withdrawals", label: t("componentWithdrawals"), status: !apiUp ? "degraded" : h.withdrawalsPaused ? "paused" : "operational" },
    { key: "payments", label: t("componentPayments"), status: apiUp ? "operational" : "degraded" },
    { key: "notifications", label: t("componentNotifications"), status: apiUp ? "operational" : "degraded" },
  ];

  const allOk = components.every((c) => c.status === "operational");
  const checkedAt = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";

  return (
    <Section narrow>
      <SectionHeading as="h1" eyebrow={t("eyebrow")} title={allOk ? t("allOperational") : t("someDegraded")} />
      <div
        className={`mt-6 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
          allOk ? "border-success/30 bg-success/5 text-success" : "border-warning/30 bg-warning/5 text-warning"
        }`}
      >
        {allOk ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
        {allOk ? t("runningNormally") : t("degradedNotice")}
      </div>
      <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border">
        {components.map((c) => (
          <div key={c.key} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm">{c.label}</span>
            <Badge tone={c.status === "operational" ? "success" : c.status === "paused" ? "warning" : "danger"}>
              {c.status === "operational" ? t("operational") : c.status === "paused" ? t("paused") : t("degraded")}
            </Badge>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-text-3">{t("lastChecked", { time: checkedAt })}</p>
    </Section>
  );
}
