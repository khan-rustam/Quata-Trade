import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { Section, SectionHeading } from "@/components/public/marketing";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "System Status — QuataTrade",
  description: "Current operational status of QuataTrade services.",
};

const COMPONENTS = ["Website & API", "Trading & escrow", "Deposits", "Withdrawals", "Payments", "Notifications"];

export default function StatusPage(): React.JSX.Element {
  return (
    <Section narrow>
      <SectionHeading eyebrow="System status" title="All systems operational" />
      <div className="mt-6 flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
        <CheckCircle2 size={18} /> QuataTrade is running normally.
      </div>
      <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border">
        {COMPONENTS.map((c) => (
          <div key={c} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm">{c}</span>
            <Badge tone="success">Operational</Badge>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-text-3">
        This page can be connected to a live monitoring service (e.g. Uptime Kuma) for real-time status and incident
        history.
      </p>
    </Section>
  );
}
