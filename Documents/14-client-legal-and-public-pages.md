# 13 — What to Get From the Client, Legal Documents & Public Website Pages

> Three checklists: (A) everything to request from the client before/at launch, (B) every legal document the platform needs, (C) the complete numbered list of public (pre-login) website pages with footer structure. All public content ships in **English + French** from day one.

## 13.A What to ask/require from the client (send as a written list; keep replies in writing)

### A1. Protecting YOU (before writing more code)
1. **Signed development agreement** covering: scope = these docs (Parts 01–12), payment terms (milestones strongly preferred over/alongside the 30% revenue share), IP ownership, limitation of liability, and an **indemnification clause** (client indemnifies developer against regulatory/legal claims arising from operating the platform).
2. **Written acknowledgment of regulatory risk**: client confirms in writing they were advised of the CEMAC/COBAC position on crypto and Cameroon Law 2024/017 obligations, and that operating licenses/authorizations are the client's responsibility ("my business will cover its license" — get that sentence into the contract with specifics: which license, from which authority, by when).
3. **Deviations Log sign-off** (Part 10) — client accepts the Phase-1 scope and the security-driven changes.
4. **Key custody statement**: client (not developer) holds cold-wallet hardware keys, treasury access, and super-admin credentials at launch; developer holds no sole control of user funds in production.
5. Clarify the **30% arrangement**: is it profit or revenue, measured how, paid when, audited how, and does it survive if you stop working? Push for it to be documented as compensation, not partnership/co-ownership, unless you deliberately want operator status (with its liability).

### A2. Company & legal identity (needed for legal pages + accounts)
6. Legal entity documents: registration certificate (RCCM), taxpayer number (NIU), registered address, legal representative name — these go on the Legal Notice page and in the ToS.
7. Confirmation of **who the data controller is** (the entity), designation of a data-protection contact, and any registration/notification required under Law 2024/017.
8. Designated **compliance officer / dispute decision-maker** (a named human who will run KYC reviews and resolve disputes — it cannot be you forever).
9. Any license, authorization, or legal opinion the client obtains — copies on file.

### A3. Accounts & assets (must be in the CLIENT's name)
10. Domain (quatatrade.com) ownership + registrar access; DNS.
11. Hosting/VPS accounts, TronGrid/RPC API accounts, MinIO/backup storage, monitoring accounts.
12. Business email domain + support inbox (support@), abuse@, legal@.
13. Smile ID (or chosen KYC provider) contract + billing.
14. SMTP/email provider, later SMS + FCM (Firebase) accounts.
15. Company MoMo/Orange/bank accounts used for QuataPay float or fee settlement (developer never receives user fiat).
16. Hardware wallet(s) purchased by client for cold storage; key ceremony scheduled with client present.
17. Monthly budget confirmation for running costs (approx. $50–150/mo at launch) and who pays it.

### A4. Content the client must supply for public pages
18. Company story/mission for About, founder/team info (or approval to keep it lean), registered company details, support hours/channels (WhatsApp number? phone?), social links, and approval of the tagline + brand (Part 11).
19. Business decisions embedded in legal text: exact fees (confirm 0.3/0.5/0.5), trade timeout window, KYC tier limits, withdrawal caps, dispute SLA (e.g. resolved within 72h), supported countries at launch (Cameroon only?), minimum age (18+).

## 13.B Legal documents the platform needs (public unless marked internal)

Have these drafted/reviewed by a Cameroon-qualified lawyer (client's cost). Developer implements them as pages; developer does not author legal substance.

| # | Document | Notes |
|---|---|---|
| L1 | **Terms of Service / User Agreement** | Governs accounts, trading rules, escrow authority (platform's right to lock/release/refund per dispute outcome), account suspension, arbitration/venue (Cameroon), age 18+ |
| L2 | **Privacy Policy** | Law 2024/017-aligned: what data (incl. KYC/biometrics), purpose, lawful basis, retention schedule, sharing (KYC provider, authorities), user rights, cross-border transfer, contact |
| L3 | **AML / KYC Policy** | Tier requirements, screening (sanctions), record-keeping, reporting obligations, right to freeze |
| L4 | **Risk Disclosure** | Crypto volatility, no investment advice, irreversibility of blockchain tx, platform is a P2P marketplace not a bank/exchange |
| L5 | **Trade & Escrow Rules + Dispute Policy** | The user-readable version of our FSM: timers, proof requirements, seller-confirm rule, dispute evidence, admin decision finality, penalties for fraud |
| L6 | **Fee Schedule** | All fees exact and public: trading fees per method, withdrawal network fees, zero hidden fees statement |
| L7 | **Prohibited Use / Acceptable Use Policy** | Fraud, sanctions evasion, third-party payments (paying from an account not in your name), multiple accounts, illegal goods |
| L8 | **Cookie Policy** | Can be a section of L2 if cookies are minimal |
| L9 | **Refund & Cancellation Policy** | What happens on cancel/expire; crypto network fees non-refundable |
| L10 | **Legal Notice / Imprint** | Company name, RCCM, NIU, address, representative, contact — required for trust and often by law |
| L11 | **Complaints Procedure** | How to complain beyond disputes; response SLA |
| L12 | *(internal)* Data Retention & Deletion Policy | Drives the purge jobs in §04/§08 |
| L13 | *(internal)* Law-Enforcement Request Policy | Who responds, what's disclosed, logging |
| L14 | *(internal)* Incident Response & Breach Notification plan | Ties to Law 2024/017 breach duties |
| L15 | *(between you & client)* Development Agreement + IP assignment + indemnification | Item A1 |
| L16 | *(later)* Referral Program Terms, Dealer/Merchant Terms | When those modules ship |

## 13.C Complete public (pre-login) website pages — numbered

### Core marketing (7)
| # | Page | Route | Content notes |
|---|---|---|---|
| P1 | **Home / Landing** | `/` | Hero (tagline "Crypto to cash. Protected."), how escrow works in 3 steps, payment-method logos (MTN/Orange/QuataPay), live USDT↔XAF rate widget, trust stats, top offers preview, CTA register, FAQ teaser, app badges (later) |
| P2 | **How It Works** | `/how-it-works` | Buyer flow + seller flow step-by-step with the trade-room visuals; escrow explainer; links to L5 |
| P3 | **Fees** | `/fees` | Fee table per payment method + examples ("Sell 100 USDT via MoMo → you receive…"); implements L6 |
| P4 | **Security & Trust** | `/security` | Escrow, 2FA/PIN, cold storage, KYC, dispute protection — plain-language version of our real controls; no overclaiming |
| P5 | **About Us** | `/about` | Mission, Cameroon-first story, company identity (from A4) |
| P6 | **FAQ / Help Center** | `/help` (+ `/help/[category]/[article]`) | Categories: Getting started, Verification, Buying, Selling, Payments (MoMo/OM/QuataPay), Wallet & withdrawals, Disputes, Security, Fees. Launch with ~30 articles |
| P7 | **Contact / Support** | `/contact` | Support form (creates ticket), support email, hours, WhatsApp (if client approves), abuse/legal contacts |

### Legal (8 pages, from 13.B)
| # | Page | Route |
|---|---|---|
| P8 | Terms of Service | `/legal/terms` |
| P9 | Privacy Policy | `/legal/privacy` |
| P10 | AML / KYC Policy | `/legal/aml` |
| P11 | Risk Disclosure | `/legal/risk` |
| P12 | Trade & Escrow Rules + Dispute Policy | `/legal/trade-rules` |
| P13 | Prohibited Use Policy | `/legal/prohibited-use` |
| P14 | Cookie Policy | `/legal/cookies` |
| P15 | Legal Notice / Imprint | `/legal/imprint` |
(Refund policy P16 `/legal/refunds` if kept separate from P12.)

### Auth & entry (7 — public but functional; from Part 07)
P17 Login `/login` · P18 Register `/register` (+ referral code param) · P19 Forgot password `/forgot` · P20 Reset password `/reset` · P21 Email verify `/verify-email` · P22 Phone verify `/verify-phone` · P23 2FA challenge `/2fa`

### Utility & system (7)
P24 System Status `/status` (Uptime Kuma public page or simple status) · P25 404 Not Found · P26 500 Error · P27 Maintenance mode page · P28 Account Suspended notice · P29 Force-update notice (mobile, later) · P30 Sitemap `/sitemap.xml` + `robots.txt` + OG images

### SEO & growth (optional Phase 2)
P31 Markets/price page `/markets` (public USDT-XAF rate — strong SEO) · P32 Blog `/blog` · P33 Referral landing `/r/[code]` · P34 Download apps `/download` · P35 Careers `/careers`

### Footer structure (every public page)
- **Product:** How it works · Fees · Security · Markets*
- **Support:** Help Center · Contact · System Status · Complaints
- **Legal:** Terms · Privacy · AML/KYC · Risk Disclosure · Trade Rules · Prohibited Use · Cookies · Imprint
- **Company:** About · Blog* · Careers*
- Bottom bar: © QuataTrade {year} · language switch EN/FR · social icons · "Crypto assets are volatile. Trade responsibly." one-liner.
(* = Phase 2)

### Rules for all public pages
Bilingual EN/FR (next-intl routes `/fr/...`), Part 11 brand tokens, WCAG AA, SEO meta + OG per page, no legal page ships as "lorem ipsum" — launch blocks until L1–L10 exist in both languages, last-updated date on every legal page, and legal text versioned in git (audit trail of changes).

**Launch-minimum count: 30 public pages/routes (P1–P30) + 16 legal/contract documents (L1–L16), of which 10 are user-facing.**
