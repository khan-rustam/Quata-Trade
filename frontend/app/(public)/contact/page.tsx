import type { Metadata } from "next";
import { AlertOctagon, Clock, Mail, MessageCircle, Scale } from "lucide-react";
import { useTranslations } from "next-intl";
import { Section, SectionHeading } from "@/components/public/marketing";
import { Reveal } from "@/components/motion/reveal";

export const metadata: Metadata = {
  title: "Contact & Support — QuataTrade",
  description: "Get help with your QuataTrade account, trades, and disputes.",
};

const CHANNELS: {
  icon: typeof Mail;
  titleKey: string;
  valueKey: string;
  noteKey: string;
}[] = [
  { icon: Mail, titleKey: "emailTitle", valueKey: "emailValue", noteKey: "emailNote" },
  { icon: Clock, titleKey: "hoursTitle", valueKey: "hoursValue", noteKey: "hoursNote" },
  { icon: MessageCircle, titleKey: "whatsappTitle", valueKey: "whatsappValue", noteKey: "whatsappNote" },
  { icon: Scale, titleKey: "legalTitle", valueKey: "legalValue", noteKey: "legalNote" },
];

export default function ContactPage(): React.JSX.Element {
  const t = useTranslations("contact");

  return (
    <Section narrow>
      <Reveal>
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />
      </Reveal>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {CHANNELS.map((c, i) => (
          <Reveal key={c.titleKey} delay={i * 0.07} className="h-full">
            <Channel icon={c.icon} title={t(c.titleKey)} value={t(c.valueKey)} note={t(c.noteKey)} />
          </Reveal>
        ))}
      </div>

      <Reveal>
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm">
          <AlertOctagon size={18} className="mt-0.5 shrink-0 text-danger" />
          <p className="text-text-2">
            {t("fraudLead")}{" "}
            <span className="font-medium text-text-1">{t("fraudEmail")}</span>. {t("fraudWarning")}
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.07}>
        <div className="mt-6 rounded-xl border border-dashed border-accent-400/40 bg-accent-400/5 px-3 py-2 text-sm">
          <span className="font-semibold text-accent-400">{t("toWireLabel")}</span>{" "}
          <span className="text-text-2">{t("toWireBody")}</span>
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
      <p className="mt-2 font-medium">{value}</p>
      <p className="mt-0.5 text-xs text-text-3">{note}</p>
    </div>
  );
}
