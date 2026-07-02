import Link from "next/link";
import { ArrowRight, Lock, MessageSquare, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section, SectionHeading, Step, FeatureCard } from "@/components/public/marketing";
import { PaymentMethodChip } from "@/components/trade/payment-method-chip";
import { Keyhole } from "@/components/brand/keyhole";

export default function LandingPage(): React.JSX.Element {
  return (
    <>
      {/* hero — the one place the Quata Flow gradient is allowed */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-25"
          style={{
            background:
              "radial-gradient(60% 60% at 25% 15%, #0e5f55 0%, transparent 60%), radial-gradient(50% 50% at 85% 25%, #159e85 0%, transparent 55%), radial-gradient(45% 45% at 60% 95%, #2fd4a7 0%, transparent 55%)",
          }}
        />
        <div className="mx-auto max-w-3xl px-4 py-20 text-center md:px-6 md:py-28">
          <h1 className="font-display text-4xl font-bold leading-[1.12] md:text-6xl">Crypto to cash. Protected.</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-text-2">
            Trade USDT with real people in Cameroon using MTN Mobile Money, Orange Money, or QuataPay — every trade
            locked in escrow until you&rsquo;re paid.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register">
              <Button size="lg">
                Start trading <ArrowRight size={16} />
              </Button>
            </Link>
            <Link href="/how-it-works">
              <Button size="lg" variant="secondary">
                How it works
              </Button>
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <span className="text-sm text-text-3">Pay with</span>
            <PaymentMethodChip method="MTN_MOMO" />
            <PaymentMethodChip method="ORANGE_MONEY" />
            <PaymentMethodChip method="QUATAPAY" />
          </div>
        </div>
      </section>

      {/* how escrow works in 3 steps */}
      <Section>
        <SectionHeading eyebrow="Protected by escrow" title="How a trade stays safe" center />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Step n={1} title="Crypto locks in escrow">
            When a trade opens, the seller&rsquo;s USDT is locked. Neither side can move it until the deal completes.
          </Step>
          <Step n={2} title="You pay off-platform">
            The buyer pays the seller with MoMo, Orange Money, or QuataPay, then submits proof in the trade room.
          </Step>
          <Step n={3} title="Escrow releases">
            Once the seller confirms the money landed in their account, escrow releases the crypto to the buyer.
          </Step>
        </div>
      </Section>

      {/* trust features */}
      <div className="border-y border-border bg-surface-1">
        <Section>
          <SectionHeading eyebrow="Built for trust" title="Safety in every trade" />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard icon={Lock} title="Escrow on every trade">
              A screenshot isn&rsquo;t money — escrow is. Funds stay locked until the seller confirms payment.
            </FeatureCard>
            <FeatureCard icon={ShieldCheck} title="Verified traders">
              Identity verification, transaction PINs, and 2FA protect your account and your funds.
            </FeatureCard>
            <FeatureCard icon={MessageSquare} title="Human dispute review">
              If something goes wrong, escrow freezes and a real person reviews the evidence.
            </FeatureCard>
            <FeatureCard icon={Wallet} title="Your rate, your method">
              Pick the offer, price, and payment method that work for you. No order book, no surprises.
            </FeatureCard>
          </div>
        </Section>
      </div>

      {/* CTA */}
      <Section className="text-center">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-5">
          <Keyhole size={40} className="text-accent-400" />
          <h2 className="font-display text-3xl font-bold tracking-tight">Ready to trade with confidence?</h2>
          <p className="text-text-2">Create your account in minutes. Crypto to cash. Protected.</p>
          <Link href="/register">
            <Button size="lg">
              Get started <ArrowRight size={16} />
            </Button>
          </Link>
        </div>
      </Section>
    </>
  );
}
