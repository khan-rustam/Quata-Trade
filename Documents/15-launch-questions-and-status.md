# 15 — Launch Questions & Public-Page Status

> What is built, what content is filled in, and the **exact** questions to send the client and the
> lawyer. Built from Documents/14. Send Sections B and C in writing; keep replies in writing.

## A. What's built (status of the public site)

All public pages exist, in the brand system, on the typed platform. Legal pages are **drafts with
every operator/lawyer detail highlighted in mint** and an amber "pending legal review" banner — they
must not go to production until a Cameroon-qualified lawyer reviews and both languages exist.

| Area | Pages | Status |
|---|---|---|
| Marketing | Home, How it works, Fees, Security, About, Help center, Contact | ✅ Built with real content; About/Contact have marked placeholders |
| Legal | Terms, Privacy, AML/KYC, Risk, Trade rules, Prohibited use, Cookies, Imprint, Refunds, Complaints | ✅ Draft scaffolds with platform mechanics + highlighted placeholders |
| Auth | Login, Register, Forgot, Reset, Verify email, 2FA | ✅ Built earlier |
| Utility | System status, Maintenance, Account suspended, 404, robots.txt, sitemap.xml | ✅ Built |
| Deferred (Phase 2) | Markets SEO page, Blog, Referral landing, Download, Careers, Phone-verify | ⏳ Stubbed/omitted |

**What "we have" in the legal pages:** correct, plain-language descriptions of how QuataTrade
actually works — escrow flow, the 0.3%/0.5%/0.5% fees, KYC-tier gating with manual-only review,
30-minute trade timeout, withdrawal 2FA/PIN + caps + dual-approval, USDT-TRC20 only, off-platform
fiat, cold storage, audit trail, and Cameroon Law 2024/017 alignment for privacy. **What's missing
is only the operator-specific and lawyer-authored substance** — the mint-highlighted items below.

---

## B. Send to the CLIENT (business + identity + accounts)

### B1. Protect the working relationship (before more build)
1. **Signed development agreement**: scope = Documents 01–14, payment terms (prefer milestones alongside/over the 30% share), IP ownership, **limitation of liability**, and an **indemnification clause** (client indemnifies you against regulatory/legal claims from operating the platform).
2. **Written acknowledgment** that they were advised of the CEMAC/COBAC crypto position and Law 2024/017, and that **licenses/authorizations are their responsibility** — with specifics: *which* license, *from which* authority, *by when*.
3. **Deviations Log sign-off** (Documents/10): they accept Phase-1 scope and the security-driven changes (incl. D12–D23).
4. **Key-custody statement**: the client (not you) holds cold-wallet hardware keys, treasury access, and super-admin credentials at launch.
5. **Clarify the 30%**: revenue or profit? measured how? paid when? audited how? survives if you stop working? Document it as **compensation, not co-ownership**, unless operator status is intended.

### B2. Company identity — needed to fill the highlighted legal placeholders
6. Legal company name; **RCCM** number; **NIU** (taxpayer number); registered address; legal representative name/role. *(These fill Imprint, Terms, Privacy.)*
7. Who is the **data controller**, the **data-protection contact/DPO**, and any Law 2024/017 registration/notification made.
8. Named **compliance officer / dispute decision-maker** (the human running KYC reviews and dispute resolutions).
9. Any **license, authorization, or legal opinion** obtained — copies on file.

### B3. Business decisions embedded in the legal text (confirm exact values)
10. Fees — confirm **0.3% QuataPay / 0.5% MoMo / 0.5% Orange**.
11. **Trade payment window** (platform default 30 min — confirm).
12. **KYC tier limits** (exact trade + daily-withdrawal caps per tier 1–3).
13. **Withdrawal caps** (per-tx, daily, dual-approval threshold — defaults exist; confirm).
14. **KYC document retention period** (platform default 5 years / 1825 days — lawyer must confirm legal period).
15. **Dispute SLA** (e.g. resolved within 72h).
16. **Supported countries** at launch (Cameroon only?) and **minimum age** (18+).
17. Support details: **support@ / legal@ / abuse@ emails**, support hours, **WhatsApp/phone** (if offered), social links.
18. About page: mission, founding story, team info (or approval to keep lean).

### B4. Accounts & assets — must be in the CLIENT's name
19. Domain (quatatrade.com) + registrar/DNS access.
20. Hosting/VPS, TronGrid/RPC, MinIO/backup, monitoring accounts.
21. Business email domain + support/abuse/legal inboxes.
22. KYC provider (Smile ID or chosen) contract + billing.
23. SMTP provider (later SMS + Firebase FCM).
24. Company MoMo/Orange/bank accounts for QuataPay float / fee settlement (you never receive user fiat).
25. Hardware wallet(s) for cold storage; schedule the key ceremony with the client present.
26. Confirmed monthly running-cost budget (~$50–150/mo at launch) and who pays.

---

## C. Give to the LAWYER (Cameroon-qualified)

Ask them to **draft/formalize and localize (EN + FR)** these, and to fill or correct every
mint-highlighted placeholder in the draft pages. You implement; they own the legal substance.

| Doc | Page route | Key placeholders the lawyer must resolve |
|---|---|---|
| Terms of Service | `/legal/terms` | Company identity; license status; **limitation of liability, warranties, indemnity**; **governing law + dispute venue/arbitration**; eligibility/age; jurisdiction |
| Privacy Policy | `/legal/privacy` | Data controller + DPO; **confirmed retention schedule** per data type; processors + **cross-border transfer** safeguards; **user rights + supervisory authority**; lawful bases |
| AML / KYC Policy | `/legal/aml` | Exact documents + tier limits; named compliance officer; **record-keeping + reporting obligations** to the competent authority |
| Risk Disclosure | `/legal/risk` | Any **regulatory status/notice** required for crypto activity |
| Trade & Escrow Rules | `/legal/trade-rules` | Payment window; **dispute SLA**; fraud penalties/forfeiture wording |
| Prohibited Use | `/legal/prohibited-use` | Confirm the list + enforcement/reporting wording |
| Cookie Policy | `/legal/cookies` | Confirm final cookie list / any analytics |
| Legal Notice / Imprint | `/legal/imprint` | Full company identity block |
| Refund & Cancellation | `/legal/refunds` | Confirm wording is consistent with local consumer law |
| Complaints Procedure | `/legal/complaints` | Acknowledgement/resolution SLA + external escalation body |
| **Development Agreement + IP + indemnity** (internal) | — | Item B1.1 — this protects *you* |
| Internal (drives code) | — | Data Retention & Deletion, Law-Enforcement Request, Incident/Breach plan |

### The single most important questions to get answered first
1. **Who is the legal entity** operating this (name, RCCM, NIU, address, representative)? — unblocks Imprint + all legal pages.
2. **What license/authorization** covers crypto activity in Cameroon, from whom, and is it obtained or pending? — determines whether launch is even permissible.
3. **Governing law + dispute venue** for the Terms.
4. **Confirmed data retention periods** under Law 2024/017.
5. **Who signs the development agreement with liability + indemnity protecting the developer**, and how is the 30% defined?

## D. Launch gate for the public site
Do not go live until **L1–L10 exist in EN + FR, lawyer-reviewed**, every mint placeholder is
resolved, the amber draft banner is removed, and a "last updated" date is set. Legal text stays
versioned in git for the audit trail.
