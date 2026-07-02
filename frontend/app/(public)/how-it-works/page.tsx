import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHeading, Step } from "@/components/public/marketing";
import { Button } from "@/components/ui/button";
import { Keyhole } from "@/components/brand/keyhole";

export const metadata: Metadata = {
  title: "How it works — QuataTrade",
  description: "Buyer and seller flows on QuataTrade, and how escrow protects every trade.",
};

export default function HowItWorksPage(): React.JSX.Element {
  return (
    <>
      <Section narrow>
        <SectionHeading
          eyebrow="How it works"
          title="Trade crypto with people, safely"
          subtitle="QuataTrade is a peer-to-peer marketplace. You trade directly with another person, and escrow holds the crypto until the deal is done."
        />
      </Section>

      <div className="border-y border-border bg-surface-1">
        <Section>
          <h2 className="font-display text-2xl font-bold">If you&rsquo;re buying USDT</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <Step n={1} title="Pick an offer">Browse sellers by price and payment method, and open a trade for the amount you want.</Step>
            <Step n={2} title="Seller&rsquo;s crypto locks">The seller&rsquo;s USDT is locked in escrow the moment your trade opens.</Step>
            <Step n={3} title="Pay & submit proof">Pay the seller with MoMo, Orange Money, or QuataPay, then submit your reference and details.</Step>
            <Step n={4} title="Receive crypto">When the seller confirms your payment, escrow releases the USDT to your wallet.</Step>
          </div>
        </Section>
      </div>

      <Section>
        <h2 className="font-display text-2xl font-bold">If you&rsquo;re selling USDT</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <Step n={1} title="Create an offer">Set your rate, limits, and which payment methods you accept.</Step>
          <Step n={2} title="Crypto locks in escrow">When a buyer opens a trade, your USDT for that amount locks automatically.</Step>
          <Step n={3} title="Get paid">The buyer pays you off-platform and submits proof in the trade room.</Step>
          <Step n={4} title="Confirm & release">Confirm the money is in YOUR account, then release. Escrow sends the crypto to the buyer minus the fee.</Step>
        </div>
      </Section>

      <div className="border-y border-border bg-surface-1">
        <Section narrow>
          <div className="flex items-start gap-4 rounded-xl border border-accent-400/30 bg-accent-400/5 p-5">
            <Keyhole size={28} className="mt-0.5 shrink-0 text-accent-400" />
            <div>
              <h3 className="font-display text-lg font-medium">Why escrow matters</h3>
              <p className="mt-1 text-sm leading-relaxed text-text-2">
                Escrow means the seller&rsquo;s crypto is held safely until they confirm your payment landed. If there&rsquo;s
                a problem, either side can open a dispute — escrow freezes and a real person reviews the evidence.
                A screenshot is not money; the seller&rsquo;s confirmation is what releases funds.
              </p>
              <Link href="/legal/trade-rules" className="mt-2 inline-block text-sm text-accent-400 hover:underline">
                Read the full trade &amp; escrow rules →
              </Link>
            </div>
          </div>
        </Section>
      </div>

      <Section className="text-center">
        <Link href="/register">
          <Button size="lg">Create your account</Button>
        </Link>
      </Section>
    </>
  );
}
