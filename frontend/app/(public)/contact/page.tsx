import type { Metadata } from "next";
import { AlertOctagon, Clock, Mail, MessageCircle, Scale } from "lucide-react";
import { Section, SectionHeading } from "@/components/public/marketing";

export const metadata: Metadata = {
  title: "Contact & Support — QuataTrade",
  description: "Get help with your QuataTrade account, trades, and disputes.",
};

export default function ContactPage(): React.JSX.Element {
  return (
    <Section narrow>
      <SectionHeading
        eyebrow="Contact"
        title="We&rsquo;re here to help"
        subtitle="For a problem with a specific trade, open a dispute from the trade room. For anything else, reach us here."
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Channel icon={Mail} title="Support email" value="[[support@quatatrade.com]]" note="Best for account and general help." />
        <Channel icon={Clock} title="Support hours" value="[[support hours, e.g. Mon–Sat 8am–8pm WAT]]" note="Typical first response: [[response time]]." />
        <Channel icon={MessageCircle} title="WhatsApp" value="[[WhatsApp number, if offered]]" note="Quick questions, if enabled." />
        <Channel icon={Scale} title="Legal" value="[[legal@quatatrade.com]]" note="Legal and data-protection requests." />
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm">
        <AlertOctagon size={18} className="mt-0.5 shrink-0 text-danger" />
        <p className="text-text-2">
          Report fraud or abuse to <span className="font-medium text-text-1">[[abuse@quatatrade.com]]</span>. Never share
          your password, PIN, or 2FA codes — QuataTrade staff will never ask for them.
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-dashed border-accent-400/40 bg-accent-400/5 px-3 py-2 text-sm">
        <span className="font-semibold text-accent-400">To wire: </span>
        <span className="text-text-2">
          an in-app support ticket form (the platform has a notifications/ticket surface to connect). Until then this
          page routes users to the support email above.
        </span>
      </div>
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
    <div className="rounded-xl border border-border bg-surface-1 p-4">
      <div className="flex items-center gap-2 text-text-2">
        <Icon size={16} className="text-accent-400" />
        <span className="text-sm font-medium text-text-1">{title}</span>
      </div>
      <p className="mt-2 font-medium">{value}</p>
      <p className="mt-0.5 text-xs text-text-3">{note}</p>
    </div>
  );
}
