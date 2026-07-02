import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpFromLine,
  BadgeCheck,
  CreditCard,
  HelpCircle,
  Rocket,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Tag,
} from "lucide-react";
import { Section, SectionHeading } from "@/components/public/marketing";

export const metadata: Metadata = {
  title: "Help Center — QuataTrade",
  description: "Guides for getting started, verification, buying, selling, payments, wallet, disputes, and security.",
};

const CATEGORIES = [
  { icon: Rocket, title: "Getting started", desc: "Create an account, verify email, and take your first steps." },
  { icon: BadgeCheck, title: "Verification (KYC)", desc: "Why we verify, tiers and limits, and what documents to submit." },
  { icon: ShoppingCart, title: "Buying USDT", desc: "Open a trade, pay a seller, and receive crypto safely." },
  { icon: Tag, title: "Selling USDT", desc: "Create offers, get paid, and release escrow." },
  { icon: CreditCard, title: "Payments", desc: "Using MTN MoMo, Orange Money, and QuataPay." },
  { icon: ArrowUpFromLine, title: "Wallet & withdrawals", desc: "Deposit, withdraw, transfer, and network fees." },
  { icon: ShieldAlert, title: "Disputes", desc: "What to do if a trade goes wrong, and how reviews work." },
  { icon: ShieldCheck, title: "Security", desc: "2FA, PIN, and keeping your account safe." },
];

const STARTERS = [
  { q: "What is escrow and why is it safe?", a: "Escrow locks the seller's crypto until they confirm your payment. Neither side can move the funds until the trade completes or a dispute is resolved — so a buyer can't take crypto without paying, and a seller can't take payment without releasing crypto." },
  { q: "Which crypto and network does QuataTrade support?", a: "At launch, USDT on the TRON network (TRC20). Always send and withdraw using this network — other networks can cause permanent loss." },
  { q: "How long do I have to pay for a trade?", a: "When you open a trade, a payment timer starts. Pay the seller and submit proof before it runs out, or the trade auto-cancels and the crypto returns to the seller." },
  { q: "The seller isn't releasing my crypto. What do I do?", a: "First, make sure you submitted your payment reference and details. If the seller still hasn't confirmed, open a dispute from the trade room — escrow freezes and a person reviews the evidence." },
  { q: "Are there any hidden fees?", a: "No. Trading fees are published on the Fees page (0.3%–0.5% per method) and shown before you open a trade. Withdrawals pay only the blockchain network fee, shown before you confirm." },
];

export default function HelpPage(): React.JSX.Element {
  return (
    <>
      <Section narrow>
        <SectionHeading eyebrow="Help center" title="How can we help?" subtitle="Browse a topic, or read the common questions below." />
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {CATEGORIES.map((c) => (
            <div key={c.title} className="flex items-start gap-3 rounded-xl border border-border bg-surface-1 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-400/15 text-accent-400">
                <c.icon size={18} aria-hidden />
              </div>
              <div>
                <p className="font-medium">{c.title}</p>
                <p className="mt-0.5 text-sm text-text-2">{c.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-lg border border-dashed border-accent-400/40 bg-accent-400/5 px-3 py-2 text-sm text-text-2">
          <span className="font-semibold text-accent-400">To write: </span>~30 short articles across these categories
          for launch. The questions below are a starting set.
        </p>
      </Section>

      <div className="border-t border-border bg-surface-1">
        <Section narrow>
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
            <HelpCircle size={20} className="text-accent-400" /> Common questions
          </h2>
          <div className="mt-5 space-y-3">
            {STARTERS.map((f) => (
              <details key={f.q} className="group rounded-xl border border-border bg-bg p-4">
                <summary className="cursor-pointer list-none font-medium text-text-1 [&::-webkit-details-marker]:hidden">
                  {f.q}
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-text-2">{f.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-6 text-sm text-text-2">
            Still stuck?{" "}
            <Link href="/contact" className="text-accent-400 hover:underline">
              Contact support
            </Link>
            .
          </p>
        </Section>
      </div>
    </>
  );
}
