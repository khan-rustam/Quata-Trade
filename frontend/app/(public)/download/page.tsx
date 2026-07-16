import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { Smartphone, Zap, WifiOff, ShieldCheck } from "lucide-react";
import { Section, SectionHeading, FeatureCard } from "@/components/public/marketing";
import { InstallAppButton } from "@/components/pwa/install-app-button";
import { buildMetadata } from "@/lib/seo-engine";

export function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/download", {
    title: "Get the app — QuataTrade",
    description:
      "Install QuataTrade on your phone or desktop for one-tap access, a full-screen app experience, and a safer, faster way to trade.",
  });
}

const FEATURES = [
  { icon: Smartphone, titleKey: "feat1Title", bodyKey: "feat1Body" },
  { icon: Zap, titleKey: "feat2Title", bodyKey: "feat2Body" },
  { icon: WifiOff, titleKey: "feat3Title", bodyKey: "feat3Body" },
  { icon: ShieldCheck, titleKey: "feat4Title", bodyKey: "feat4Body" },
] as const;

const STEPS = [
  { titleKey: "androidTitle", bodyKey: "androidSteps" },
  { titleKey: "iosTitle2", bodyKey: "iosSteps2" },
  { titleKey: "desktopTitle", bodyKey: "desktopSteps" },
] as const;

export default function DownloadPage(): React.JSX.Element {
  const t = useTranslations("download");

  return (
    <>
      <Section className="text-center">
        <SectionHeading center as="h1" eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />
        <div className="mt-8 flex flex-col items-center gap-3">
          <InstallAppButton />
          <p className="text-xs text-text-3">{t("noStoreNote")}</p>
        </div>
      </Section>

      <Section className="pt-0">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <FeatureCard key={f.titleKey} icon={f.icon} title={t(f.titleKey)}>
              {t(f.bodyKey)}
            </FeatureCard>
          ))}
        </div>
      </Section>

      <Section className="pt-0" narrow>
        <SectionHeading title={t("howTitle")} subtitle={t("howSubtitle")} />
        <div className="mt-8 space-y-4">
          {STEPS.map((s, i) => (
            <div key={s.titleKey} className="flex gap-4 rounded-card border border-border bg-surface-1 p-5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-400/15 font-display font-semibold text-accent-400">
                {i + 1}
              </div>
              <div>
                <h3 className="font-medium text-text-1">{t(s.titleKey)}</h3>
                <p className="mt-1 text-sm text-text-2">{t(s.bodyKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
