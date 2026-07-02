import type { Metadata } from "next";
import Link from "next/link";
import { Fingerprint, KeyRound, Lock, Server, ShieldCheck, Snowflake } from "lucide-react";
import { Section, SectionHeading, FeatureCard } from "@/components/public/marketing";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Security & Trust — QuataTrade",
  description: "How QuataTrade protects your account and your funds: escrow, 2FA, cold storage, KYC, and dispute protection.",
};

export default function SecurityPage(): React.JSX.Element {
  return (
    <>
      <Section narrow>
        <SectionHeading
          eyebrow="Security & trust"
          title="Your funds, protected by design"
          subtitle="Security is built into how QuataTrade works — not bolted on. Here are the real controls, in plain language."
        />
      </Section>

      <div className="border-y border-border bg-surface-1">
        <Section>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard icon={Lock} title="Escrow on every trade">
              The seller&rsquo;s crypto is locked until they confirm payment. No trade releases funds automatically without
              that confirmation.
            </FeatureCard>
            <FeatureCard icon={ShieldCheck} title="2FA & transaction PIN">
              Two-factor authentication and a separate transaction PIN are required to withdraw or release funds.
            </FeatureCard>
            <FeatureCard icon={Snowflake} title="Cold storage">
              Most funds are held in cold storage under the operator&rsquo;s hardware keys. Only a small operational float is
              kept online, with strict caps.
            </FeatureCard>
            <FeatureCard icon={KeyRound} title="Isolated signing">
              The website never holds spending keys. Withdrawals are signed by an isolated service with independent caps —
              so a compromised website cannot drain funds.
            </FeatureCard>
            <FeatureCard icon={Fingerprint} title="Verified identities">
              Identity verification (KYC) and deterministic risk checks help keep fraudsters out. Every verification is
              reviewed by a person.
            </FeatureCard>
            <FeatureCard icon={Server} title="Tamper-evident audit">
              Every sensitive action is written to an append-only, hash-chained audit log, and balances are tracked on a
              double-entry ledger that reconciles against the blockchain.
            </FeatureCard>
          </div>
        </Section>
      </div>

      <Section narrow>
        <div className="rounded-xl border border-border bg-surface-1 p-5">
          <h3 className="font-display text-lg font-medium">What you can do to stay safe</h3>
          <ul className="mt-3 space-y-2 text-sm text-text-2">
            <li>• Turn on 2FA and set a transaction PIN in your security center.</li>
            <li>• Confirm the money is in YOUR own account before releasing a trade — a screenshot is not proof.</li>
            <li>• Only pay from an account in your own name, and never trade for someone else.</li>
            <li>• Double-check the address and network (USDT on TRON / TRC20) before withdrawing.</li>
          </ul>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <Link href="/register">
            <Button>Create a secure account</Button>
          </Link>
          <Link href="/legal/privacy" className="text-sm text-text-2 hover:text-text-1">
            Read our privacy policy
          </Link>
        </div>
      </Section>
    </>
  );
}
