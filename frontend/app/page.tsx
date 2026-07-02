import { useTranslations } from "next-intl";
import { ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Keyhole } from "@/components/brand/keyhole";

export default function LandingPage(): React.JSX.Element {
  const t = useTranslations("landing");
  const nav = useTranslations("nav");
  const brand = useTranslations("brand");

  const trust = [
    { icon: Keyhole, title: t("trust1Title"), body: t("trust1Body") },
    { icon: Wallet, title: t("trust2Title"), body: t("trust2Body") },
    { icon: ShieldCheck, title: t("trust3Title"), body: t("trust3Body") },
  ];

  return (
    <main className="min-h-full">
      {/* top bar */}
      <header className="flex items-center justify-between px-6 py-4 md:px-10">
        <div className="flex items-center gap-2">
          <Keyhole className="text-accent-400" />
          <span className="font-display text-xl font-bold tracking-tight">
            {brand("name")}
          </span>
        </div>
        <nav className="flex items-center gap-3">
          <Button variant="ghost" size="sm">
            {nav("login")}
          </Button>
          <Button size="sm">{nav("register")}</Button>
        </nav>
      </header>

      {/* hero — the only place the Quata Flow gradient is allowed */}
      <section className="relative overflow-hidden px-6 py-20 md:px-10 md:py-28">
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-25"
          style={{
            background:
              "radial-gradient(60% 60% at 30% 20%, #0e5f55 0%, transparent 60%), radial-gradient(50% 50% at 80% 30%, #159e85 0%, transparent 55%), radial-gradient(45% 45% at 60% 90%, #2fd4a7 0%, transparent 55%)",
          }}
        />
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-display text-4xl font-bold leading-[1.15] md:text-6xl">
            {t("heroTitle")}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-text-2">
            {t("heroSubtitle")}
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg">{t("ctaPrimary")}</Button>
            <Button size="lg" variant="secondary">
              {t("ctaSecondary")}
            </Button>
          </div>
        </div>
      </section>

      {/* trust signals */}
      <section className="mx-auto max-w-5xl px-6 pb-24 md:px-10">
        <div className="grid gap-4 md:grid-cols-3">
          {trust.map(({ icon: Icon, title, body }) => (
            <Card key={title}>
              <Icon className="text-accent-400" size={24} aria-hidden />
              <h2 className="mt-4 font-display text-lg font-medium">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-text-2">{body}</p>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t border-border px-6 py-8 text-center text-sm text-text-3 md:px-10">
        <p className="font-money">{brand("tagline")}</p>
        <p className="mt-2">© 2026 {brand("name")}. Cameroon.</p>
      </footer>
    </main>
  );
}
