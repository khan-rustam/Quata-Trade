/**
 * Legal document SCAFFOLDS (Documents/14 §13.B). These describe how QuataTrade
 * actually works (fees, escrow, KYC, security — sourced from Documents 01–11)
 * and mark, with `[[...]]`, everything the operator + a Cameroon-qualified
 * lawyer must confirm. NOT legal advice and NOT binding until reviewed.
 *
 * Keep this file versioned in git — it is the audit trail of legal-text changes.
 */

export type LegalBlock =
  | { type: "p"; text: string }
  | { type: "list"; items: string[] }
  | { type: "placeholder"; label: string };

export interface LegalSection {
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDoc {
  slug: string;
  title: string;
  version: string;
  lastUpdated: string;
  summary?: string;
  sections: LegalSection[];
}

const UPDATED = "2 July 2026";
const p = (text: string): LegalBlock => ({ type: "p", text });
const list = (items: string[]): LegalBlock => ({ type: "list", items });
const need = (label: string): LegalBlock => ({ type: "placeholder", label });

const COMPANY_INTRO = p(
  "QuataTrade is operated by [[legal company name]] ([[RCCM number]], [[NIU / taxpayer number]]), registered at [[registered address, Cameroon]] (the “Operator”, “we”, “us”).",
);

export const LEGAL_DOCS: Record<string, LegalDoc> = {
  terms: {
    slug: "terms",
    title: "Terms of Service",
    version: "0.1",
    lastUpdated: UPDATED,
    summary:
      "These terms govern your use of QuataTrade, a peer-to-peer marketplace for buying and selling USDT with escrow protection. By creating an account you agree to them.",
    sections: [
      {
        heading: "Who we are",
        blocks: [
          COMPANY_INTRO,
          p(
            "QuataTrade is a P2P marketplace, not a bank, a licensed exchange, or a money-services business unless [[state any license held and issuing authority]]. We never take custody of your fiat currency: fiat payments happen directly between users via MTN Mobile Money, Orange Money, or the internal QuataPay balance.",
          ),
        ],
      },
      {
        heading: "Eligibility",
        blocks: [
          p("To use QuataTrade you must:"),
          list([
            "be at least [[18]] years old and legally able to enter contracts;",
            "reside in a supported country ([[supported countries at launch — e.g. Cameroon only]]);",
            "complete identity verification (KYC) to the tier required for the amounts you trade or withdraw;",
            "not be subject to sanctions or listed on any applicable prohibited-persons list.",
          ]),
        ],
      },
      {
        heading: "Your account & security",
        blocks: [
          p(
            "You are responsible for your login credentials, your transaction PIN, and your two-factor authentication (2FA). 2FA is required to withdraw funds and to release escrow. Never share these. Tell us immediately if you suspect unauthorized access.",
          ),
          p(
            "We may suspend, freeze, or close an account to protect users, comply with law, or investigate suspected fraud or breach of these terms, as described in our Prohibited Use Policy.",
          ),
        ],
      },
      {
        heading: "How trading works",
        blocks: [
          p(
            "A seller lists an offer; when a buyer opens a trade, the seller’s USDT is locked in escrow. The buyer pays the seller off-platform and submits proof. The seller confirms receipt in their own account, and escrow releases the crypto to the buyer minus the trading fee. If the payment window expires without confirmation, escrow returns to the seller. Full mechanics are in the Trade & Escrow Rules.",
          ),
          p(
            "You authorize QuataTrade to lock, release, refund, or — in a dispute — award escrowed crypto strictly according to the outcomes described in the Trade & Escrow Rules and Dispute Policy. Admin dispute decisions are final within the platform.",
          ),
        ],
      },
      {
        heading: "Fees",
        blocks: [
          p(
            "Trading fees are charged in crypto from the trade amount and are published in full on the Fees page: 0.3% for QuataPay, 0.5% for MTN Mobile Money, 0.5% for Orange Money. Blockchain network fees apply to withdrawals. There are no hidden fees.",
          ),
        ],
      },
      {
        heading: "Prohibited conduct",
        blocks: [
          p(
            "You must not use QuataTrade for fraud, money laundering, sanctions evasion, third-party payments (paying from an account not in your own name), operating multiple accounts to evade limits, or trading proceeds of crime. See the Prohibited Use Policy.",
          ),
        ],
      },
      {
        heading: "Risk & no advice",
        blocks: [
          p(
            "Crypto assets are volatile and blockchain transactions are irreversible. Nothing on QuataTrade is investment, legal, or tax advice. See the Risk Disclosure.",
          ),
        ],
      },
      {
        heading: "Liability",
        blocks: [
          need(
            "Limitation-of-liability, disclaimer of warranties, and indemnity clauses — to be drafted by the Operator’s lawyer to the extent permitted by Cameroonian law.",
          ),
        ],
      },
      {
        heading: "Governing law & disputes with us",
        blocks: [
          p("These terms are governed by the laws of [[governing law / country]]."),
          need("Dispute resolution venue and method (courts of [[city]] / arbitration under [[rules]]), and complaints escalation path."),
        ],
      },
      {
        heading: "Changes & contact",
        blocks: [
          p(
            "We may update these terms; material changes will be notified in-app or by email, with the “last updated” date changed here. Continued use means acceptance.",
          ),
          p("Contact: [[legal@ / support@ email]] · [[registered address]]."),
        ],
      },
    ],
  },

  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    version: "0.1",
    lastUpdated: UPDATED,
    summary:
      "How we collect, use, protect, and retain your personal data, aligned with Cameroon Law No. 2024/017 on personal data protection.",
    sections: [
      {
        heading: "Data controller",
        blocks: [COMPANY_INTRO, need("Data-protection contact / DPO name and email, and any registration or notification made under Law 2024/017.")],
      },
      {
        heading: "What we collect",
        blocks: [
          list([
            "Account data: email, phone, name, country, password/PIN (stored only as strong hashes — argon2id).",
            "Verification (KYC) data: identity-document images and a selfie, and any details extracted from them.",
            "Transaction data: trades, deposits, withdrawals, ledger entries, chat messages and payment proofs.",
            "Technical data: IP address, device fingerprint, session and audit logs.",
          ]),
        ],
      },
      {
        heading: "Why we use it (purpose & lawful basis)",
        blocks: [
          list([
            "To operate your account and process trades (performance of contract).",
            "To verify identity and prevent fraud, money laundering and sanctions breaches (legal obligation / legitimate interest).",
            "To provide support and resolve disputes.",
            "To meet record-keeping and reporting duties.",
          ]),
          p("We do NOT use your KYC documents to train AI systems. There is no automated decision that approves KYC — every verification is reviewed by a person."),
        ],
      },
      {
        heading: "How long we keep it (retention)",
        blocks: [
          p(
            "We keep verification documents encrypted and only for the legal retention period, then purge them automatically. Current default retention is [[confirm retention period — the platform is configured for 5 years / 1825 days; the lawyer must confirm the correct period]].",
          ),
          need("Confirmed retention schedule per data category, and the legal basis for each period."),
        ],
      },
      {
        heading: "Who we share it with",
        blocks: [
          list([
            "The identity-verification provider ([[Smile ID or chosen provider]]), only to verify you.",
            "Payment counterparties see limited details needed to complete a trade (e.g. the name/reference you submit).",
            "Authorities where required by law or valid legal process.",
          ]),
          need("Full list of processors/sub-processors and any cross-border transfer, with safeguards under Law 2024/017."),
        ],
      },
      {
        heading: "Security",
        blocks: [
          p(
            "Passwords and PINs are hashed with argon2id; verification files are encrypted at rest with per-file keys; access is audit-logged; the platform holds no user spending keys online. See the Security page.",
          ),
        ],
      },
      {
        heading: "Your rights",
        blocks: [
          p("Subject to Law 2024/017 and the limits of our legal obligations, you may request access to, correction of, or deletion of your personal data, and object to certain processing."),
          need("Exact rights, how to exercise them, response timeframe, and the supervisory authority users may complain to."),
        ],
      },
      {
        heading: "Cookies",
        blocks: [p("We use only the cookies needed to keep you logged in and remember your language/theme. See the Cookie Policy.")],
      },
    ],
  },

  aml: {
    slug: "aml",
    title: "AML / KYC Policy",
    version: "0.1",
    lastUpdated: UPDATED,
    summary: "Our approach to identity verification, sanctions screening, monitoring, and record-keeping.",
    sections: [
      {
        heading: "Identity verification (KYC) tiers",
        blocks: [
          p("Access to trading and withdrawals is gated by verification tier. Higher tiers unlock higher limits."),
          list([
            "Tier 0 (registered, unverified): no trading.",
            "Tier 1–3: increasing trade and daily-withdrawal limits after document verification.",
          ]),
          need("Exact documents required and the precise trade/withdrawal limits per tier (the platform ships with configurable defaults; the Operator confirms the business values)."),
        ],
      },
      {
        heading: "Manual review",
        blocks: [
          p("Verification decisions are made by a trained reviewer — no code path auto-approves KYC. Automated tools only assist the human reviewer."),
          need("Named compliance officer / decision-maker responsible for KYC and monitoring."),
        ],
      },
      {
        heading: "Sanctions & prohibited persons",
        blocks: [
          p("We screen names and, where applicable, wallet addresses against sanctions and prohibited-persons datasets. Matches are escalated and may result in refusal or freezing."),
        ],
      },
      {
        heading: "Monitoring & the right to freeze",
        blocks: [
          p("We use deterministic risk rules (velocity, device, IP, duplicate-account and large-transaction signals) to flag activity. We may hold, freeze, or refuse transactions to comply with law or protect users."),
        ],
      },
      {
        heading: "Record-keeping & reporting",
        blocks: [need("Retention of KYC/transaction records and the Operator’s reporting obligations to the competent authority — to be specified by the lawyer.")],
      },
    ],
  },

  risk: {
    slug: "risk",
    title: "Risk Disclosure",
    version: "0.1",
    lastUpdated: UPDATED,
    summary: "Important risks of using QuataTrade and trading crypto. Please read before you trade.",
    sections: [
      {
        heading: "Crypto is volatile",
        blocks: [p("The value of USDT and other crypto assets can change. You are responsible for the rates and amounts you agree to in each trade.")],
      },
      {
        heading: "Transactions are irreversible",
        blocks: [
          p("Blockchain withdrawals cannot be reversed once broadcast. Always double-check the destination address and network (USDT on TRON / TRC20). Sending to the wrong address or network can cause permanent loss."),
        ],
      },
      {
        heading: "We are a marketplace, not a bank",
        blocks: [
          p("QuataTrade connects buyers and sellers and protects trades with escrow. We are not a bank or a deposit-taking institution, and fiat payments happen off-platform between users."),
        ],
      },
      {
        heading: "No advice",
        blocks: [p("Nothing here is investment, financial, legal, or tax advice. Trade only what you can afford and understand.")],
      },
      {
        heading: "Counterparty & payment risk",
        blocks: [
          p("Escrow protects the crypto side of a trade. You are still responsible for verifying that you actually received the agreed fiat payment in your own account before confirming a trade — a screenshot is not proof of payment."),
        ],
      },
      { heading: "Regulatory notice", blocks: [need("Any regulatory status/notice required for crypto activity in the supported country — to be confirmed by the lawyer.")] },
    ],
  },

  "trade-rules": {
    slug: "trade-rules",
    title: "Trade & Escrow Rules and Dispute Policy",
    version: "0.1",
    lastUpdated: UPDATED,
    summary: "The user-readable version of how a trade and its escrow work, and how disputes are decided.",
    sections: [
      {
        heading: "Opening a trade",
        blocks: [
          p("When a buyer opens a trade against an offer, the seller’s USDT for that amount is immediately locked in escrow and a payment timer starts ([[confirm payment window — platform default is 30 minutes]])."),
        ],
      },
      {
        heading: "Paying and submitting proof",
        blocks: [
          p("The buyer pays the seller off-platform using the agreed method (MTN MoMo, Orange Money, or QuataPay) and submits the payment reference, sender name and number, and any screenshot. Pay only from an account in your own name."),
        ],
      },
      {
        heading: "Seller confirmation & release",
        blocks: [
          p("The seller must confirm they received the money in their own account. On confirmation, escrow releases the crypto to the buyer minus the trading fee, and the fee goes to the platform treasury. The seller’s confirmation — not a screenshot — is what releases funds."),
        ],
      },
      {
        heading: "Timeouts & cancellation",
        blocks: [
          p("If the timer expires without a submitted payment, the trade auto-cancels and escrow returns to the seller. A buyer may cancel before confirming; escrow returns to the seller. Crypto network fees are non-refundable."),
        ],
      },
      {
        heading: "Disputes",
        blocks: [
          p("Either party may open a dispute. This freezes the escrow — no automatic release or refund can occur — until an authorized admin reviews the evidence and decides to release to the buyer or refund to the seller."),
          p("Provide clear evidence: payment references, bank/MoMo statements, and chat history. Decisions are made by a person and are final within the platform."),
          need("Dispute response time / SLA (e.g. resolved within 72 hours) and any escalation path."),
        ],
      },
      {
        heading: "Fraud & penalties",
        blocks: [need("Consequences of fraud or abuse (account freeze/closure, forfeiture, reporting) — to be set by the Operator and lawyer.")],
      },
    ],
  },

  "prohibited-use": {
    slug: "prohibited-use",
    title: "Prohibited Use Policy",
    version: "0.1",
    lastUpdated: UPDATED,
    summary: "What you may not do on QuataTrade. Breaching this policy can lead to freezing or closure of your account.",
    sections: [
      {
        heading: "You must not",
        blocks: [
          list([
            "commit fraud or attempt to obtain crypto or fiat you are not entitled to;",
            "launder money or transact proceeds of crime;",
            "evade sanctions or trade with prohibited persons or jurisdictions;",
            "make or accept third-party payments — pay only from an account in your own name;",
            "operate multiple accounts to evade limits or verification;",
            "trade for illegal goods or services;",
            "abuse disputes, chargebacks, or the escrow system;",
            "attempt to attack, probe, or disrupt the platform.",
          ]),
        ],
      },
      {
        heading: "Enforcement",
        blocks: [
          p("We may freeze, suspend, or close accounts, refuse or reverse transactions where possible, and report to authorities where required. Kill switches allow us to pause trading or withdrawals platform-wide during incidents."),
        ],
      },
    ],
  },

  cookies: {
    slug: "cookies",
    title: "Cookie Policy",
    version: "0.1",
    lastUpdated: UPDATED,
    summary: "We keep cookies minimal.",
    sections: [
      {
        heading: "What we use",
        blocks: [
          list([
            "A secure session cookie to keep you logged in (httpOnly refresh token).",
            "A small preference cookie for your language (EN/FR) and light/dark theme.",
          ]),
          p("We do not use advertising or third-party tracking cookies at launch."),
          need("Confirm the final cookie list and whether any analytics cookie is added before launch."),
        ],
      },
    ],
  },

  imprint: {
    slug: "imprint",
    title: "Legal Notice / Imprint",
    version: "0.1",
    lastUpdated: UPDATED,
    summary: "Company identity and contact details.",
    sections: [
      {
        heading: "Operator",
        blocks: [
          need("Legal company name"),
          need("RCCM registration number"),
          need("NIU / taxpayer number"),
          need("Registered address in Cameroon"),
          need("Legal representative (name & role)"),
          need("Contact email (legal@ / support@) and, if provided, phone / WhatsApp"),
          need("Any license or authorization number and issuing authority, if applicable"),
        ],
      },
    ],
  },

  refunds: {
    slug: "refunds",
    title: "Refund & Cancellation Policy",
    version: "0.1",
    lastUpdated: UPDATED,
    summary: "What happens when a trade is cancelled, expires, or disputed.",
    sections: [
      {
        heading: "Cancellation & expiry",
        blocks: [
          p("If a trade is cancelled before confirmation, or the payment timer expires, the escrowed crypto returns to the seller. No trading fee is charged on cancelled or expired trades."),
        ],
      },
      {
        heading: "Disputes",
        blocks: [p("In a dispute, funds move only by admin decision — either released to the buyer or refunded to the seller. See the Trade & Escrow Rules.")],
      },
      {
        heading: "Network fees",
        blocks: [p("Blockchain (TRON) network fees paid to move crypto on-chain are non-refundable, as they are paid to the network, not to us.")],
      },
    ],
  },

  complaints: {
    slug: "complaints",
    title: "Complaints Procedure",
    version: "0.1",
    lastUpdated: UPDATED,
    summary: "How to raise a complaint beyond a single trade dispute.",
    sections: [
      {
        heading: "How to complain",
        blocks: [
          p("For a problem with a specific trade, open a dispute from the trade room. For anything else — an account issue, a policy concern, or how a dispute was handled — contact support with the details and any references."),
          p("Contact: [[support@ email]]" + " · [[support hours]]" + " · [[WhatsApp/phone if provided]]."),
        ],
      },
      {
        heading: "What happens next",
        blocks: [need("Acknowledgement time and resolution SLA, and any external escalation body users can approach.")],
      },
    ],
  },
};

export const LEGAL_SLUGS = Object.keys(LEGAL_DOCS);
