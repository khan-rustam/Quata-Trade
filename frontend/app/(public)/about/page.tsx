import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHeading } from "@/components/public/marketing";
import { Button } from "@/components/ui/button";
import { Keyhole } from "@/components/brand/keyhole";

export const metadata: Metadata = {
  title: "About — QuataTrade",
  description: "QuataTrade is a Cameroon-first P2P crypto marketplace built on trust and escrow protection.",
};

export default function AboutPage(): React.JSX.Element {
  return (
    <>
      <Section narrow>
        <SectionHeading eyebrow="About us" title="Crypto to cash, built for Central Africa" />
        <div className="mt-6 space-y-4 text-text-2">
          <p>
            QuataTrade is the safest way in Central Africa to turn crypto into cash and cash into crypto — person to
            person, in the payment apps you already use, with every trade protected by escrow until you&rsquo;re paid.
          </p>
          <p>
            We built QuataTrade because sending and receiving crypto shouldn&rsquo;t mean trusting a stranger blindly. Escrow,
            verified identities, and human dispute review make peer-to-peer trading feel safe — without a bank in the
            middle and without a centralized exchange holding your money.
          </p>
          <p className="rounded-lg border border-dashed border-accent-400/40 bg-accent-400/5 px-3 py-2 text-sm text-text-2">
            <span className="font-semibold text-accent-400">To supply: </span>
            company mission, founding story, team or leadership details, and any milestones you want on this page
            (kept lean is fine).
          </p>
        </div>
      </Section>

      <div className="border-y border-border bg-surface-1">
        <Section narrow>
          <h2 className="font-display text-xl font-semibold">What we stand for</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              { t: "Protected", d: "Escrow on every trade, and funds held safely until the deal is done." },
              { t: "Direct", d: "You trade with real people, at your rate, in your payment method." },
              { t: "Fresh", d: "A clean, fast, modern experience made for how people actually pay here." },
            ].map((v) => (
              <div key={v.t} className="rounded-xl border border-border bg-bg p-4">
                <p className="font-display font-medium">{v.t}</p>
                <p className="mt-1 text-sm text-text-2">{v.d}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section className="text-center">
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4">
          <Keyhole size={36} className="text-accent-400" />
          <p className="text-text-2">
            Company details and legal identity are on our{" "}
            <Link href="/legal/imprint" className="text-accent-400 hover:underline">
              legal notice
            </Link>
            .
          </p>
          <Link href="/register">
            <Button>Join QuataTrade</Button>
          </Link>
        </div>
      </Section>
    </>
  );
}
