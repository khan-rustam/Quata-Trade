import type { Metadata } from "next";
import { AlertOctagon, Clock, Mail, MapPin, MessageCircle, Scale } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Section, SectionHeading } from "@/components/public/marketing";
import { Reveal } from "@/components/motion/reveal";
import { ContactForm } from "@/components/public/contact-form";
import { getCompany } from "@/lib/content-server";
import { buildMetadata } from "@/lib/seo-engine";

export function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/contact", {
    title: "Contact & Support — QuataTrade",
    description: "Get help with your QuataTrade account, trades, and disputes.",
  });
}

export default async function ContactPage(): Promise<React.JSX.Element> {
  const t = await getTranslations("contact");
  const company = await getCompany();

  const legalValue =
    company.legalName && company.registrationNo
      ? `${company.legalName} · ${company.registrationNo}`
      : company.legalName;
  const address = [company.addressLine, company.city, company.country].filter(Boolean).join(", ");

  // Only render channels backed by real data. Fields the client has not filled in
  // the admin content panel are omitted rather than shown as `[[placeholder]]`
  // tokens. Email is always seeded (support@…); hours has no data field yet, so it
  // is omitted until one exists rather than displaying a bracketed placeholder.
  const channels: { icon: typeof Mail; title: string; value: string; note: string }[] = [
    ...(company.email ? [{ icon: Mail, title: t("emailTitle"), value: company.email, note: t("emailNote") }] : []),
    { icon: Mail, title: t("generalTitle"), value: "info@quatatrade.com", note: t("generalNote") },
    ...(company.whatsapp
      ? [{ icon: MessageCircle, title: t("whatsappTitle"), value: company.whatsapp, note: t("whatsappNote") }]
      : []),
    { icon: Clock, title: t("hoursTitle"), value: t("hoursValue"), note: t("hoursNote") },
    ...(address ? [{ icon: MapPin, title: t("addressTitle"), value: address, note: t("addressNote") }] : []),
    ...(legalValue ? [{ icon: Scale, title: t("legalTitle"), value: legalValue, note: t("legalNote") }] : []),
  ];

  return (
    <Section narrow>
      <Reveal>
        <SectionHeading as="h1" eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />
      </Reveal>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {channels.map((c, i) => (
          <Reveal key={c.title} delay={i * 0.07} className="h-full">
            <Channel icon={c.icon} title={c.title} value={c.value} note={c.note} />
          </Reveal>
        ))}
      </div>

      <Reveal>
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm">
          <AlertOctagon size={18} className="mt-0.5 shrink-0 text-danger" />
          <p className="text-text-2">
            {t("fraudLead")}{" "}
            <span className="font-medium text-text-1">{company.email || t("fraudEmail")}</span>. {t("fraudWarning")}
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.07}>
        <div className="mt-6">
          <ContactForm />
        </div>
      </Reveal>
    </Section>
  );
}

function Channel({
  icon: Icon,
  title,
  value,
  note,
}: {
  icon: typeof Mail;
  title: string;
  value: string;
  note: string;
}): React.JSX.Element {
  return (
    <div className="h-full rounded-xl border border-border bg-surface-1 p-4">
      <div className="flex items-center gap-2 text-text-2">
        <Icon size={16} className="text-accent-400" />
        <span className="text-sm font-medium text-text-1">{title}</span>
      </div>
      <p className="mt-2 font-medium break-words">{value}</p>
      <p className="mt-0.5 text-xs text-text-3">{note}</p>
    </div>
  );
}
