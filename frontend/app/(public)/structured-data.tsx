import { headers } from "next/headers";
import type { Faq } from "@quatatrade/shared";
import { getCompany } from "@/lib/content-server";

/**
 * Static JSON-LD floor for the public site.
 *
 * QuataTrade previously shipped NO structured data at all: the only JSON-LD on
 * the site came from `EngineJsonLd`, which is fail-open by design and renders
 * nothing whenever the SEO engine has no blocks for the path. With the engine
 * newly connected but not yet populated, that meant every public page served
 * zero structured data — and because the component is meant to render nothing,
 * nothing looked wrong. This file is the floor the engine layers on top of.
 *
 * Company details come from `getCompany()`, the same admin-managed record the
 * footer renders, rather than hardcoded copy — so the operator's real legal
 * name, contact details and social profiles are what Google sees, and editing
 * them in the admin panel updates the markup. Blank fields are dropped rather
 * than emitted empty: a `sameAs: [""]` or an empty `telephone` is worse than
 * the property being absent.
 *
 * The `<` escape and the defensively-read nonce mirror `engine-json-ld.tsx` —
 * see that file for the reasoning.
 */

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://quatatrade.com").replace(/\/$/, "");

/** Serialise + escape once, in one place. */
function LdScript({ data, nonce }: { data: unknown; nonce?: string }) {
  const ldJson = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: ldJson }}
    />
  );
}

/**
 * Organization + WebSite + the service itself. Rendered from the public layout,
 * so every marketing/legal page carries it.
 */
export async function SiteStructuredData() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const company = await getCompany();

  const sameAs = [
    company.social.facebook,
    company.social.x,
    company.social.instagram,
    company.social.linkedin,
    company.social.telegram,
  ]
    .map((u) => (u ?? "").trim())
    .filter((u) => u.length > 0);

  const address = {
    "@type": "PostalAddress",
    ...(company.addressLine ? { streetAddress: company.addressLine } : {}),
    ...(company.city ? { addressLocality: company.city } : {}),
    addressCountry: "CM",
  };

  const organization = {
    "@type": "Organization",
    "@id": `${SITE_URL}#organization`,
    name: company.name || "QuataTrade",
    ...(company.legalName ? { legalName: company.legalName } : {}),
    url: SITE_URL,
    logo: `${SITE_URL}/assets/master-logo.png`,
    description:
      "Peer-to-peer USDT trading with escrow protection for Cameroon. Buy and sell against MTN MoMo, Orange Money or QuataPay, with funds held in escrow until both sides confirm.",
    ...(sameAs.length > 0 ? { sameAs } : {}),
    address,
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        areaServed: "CM",
        availableLanguage: ["English", "French"],
        ...(company.email ? { email: company.email } : {}),
        ...(company.phone ? { telephone: company.phone } : {}),
      },
    ],
  };

  const website = {
    "@type": "WebSite",
    "@id": `${SITE_URL}#website`,
    url: SITE_URL,
    name: company.name || "QuataTrade",
    inLanguage: ["en", "fr"],
    publisher: { "@id": `${SITE_URL}#organization` },
  };

  // FinancialService rather than a generic Service: this is an exchange
  // marketplace, and the more specific type is what Google's finance-related
  // rich results key off. `priceRange` is required by the type; the real fee
  // schedule lives on /fees and is deliberately not duplicated here.
  const service = {
    "@type": "FinancialService",
    "@id": `${SITE_URL}#service`,
    name: "QuataTrade P2P Escrow Marketplace",
    url: SITE_URL,
    provider: { "@id": `${SITE_URL}#organization` },
    areaServed: { "@type": "Country", name: "Cameroon" },
    currenciesAccepted: "XAF",
    paymentAccepted: ["MTN Mobile Money", "Orange Money", "QuataPay"],
    priceRange: "XAF",
    address,
  };

  return (
    <LdScript
      nonce={nonce}
      data={{ "@context": "https://schema.org", "@graph": [organization, website, service] }}
    />
  );
}

/**
 * FAQPage markup for /help.
 *
 * Takes the ALREADY-FETCHED, already-rendered FAQ list rather than fetching its
 * own copy. That is not just to save a request: Google requires FAQPage markup
 * to describe FAQ content actually visible on the same page, and marking up
 * questions a visitor cannot see is a structured-data violation that can earn a
 * manual action. Passing the same array the page renders makes the two
 * impossible to drift apart — which is also why this is not in the layout.
 */
export async function FaqStructuredData({ faqs }: { faqs: Faq[] }) {
  const visible = faqs.filter((f) => f.published && f.question.trim() && f.answer.trim());
  if (visible.length === 0) return null;

  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <LdScript
      nonce={nonce}
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "@id": `${SITE_URL}/help#faq`,
        mainEntity: visible.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      }}
    />
  );
}
