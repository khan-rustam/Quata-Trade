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
  | { type: "subheading"; text: string }
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
  /** "final" = published, operator-approved copy (no draft banner). Defaults to draft. */
  status?: "draft" | "final";
  summary?: string;
  sections: LegalSection[];
}

/** Effective date for the operator-approved, published (final) documents. */
const EFFECTIVE = "July 2026";
const p = (text: string): LegalBlock => ({ type: "p", text });
const sub = (text: string): LegalBlock => ({ type: "subheading", text });
const list = (items: string[]): LegalBlock => ({ type: "list", items });

export const LEGAL_DOCS: Record<string, LegalDoc> = {
  terms: {
    slug: "terms",
    title: "Terms of Service",
    version: "1.0",
    lastUpdated: EFFECTIVE,
    status: "final",
    summary:
      "These Terms govern your access to and use of the QuataTrade platform, operated by Quata Digital Enterprise from Bamenda, Cameroon. By accessing, registering for, or using the Platform, you acknowledge that you have read, understood, and agree to be legally bound by these Terms. If you do not agree, you must not access or use the Platform.",
    sections: [
      {
        heading: "About QuataTrade",
        blocks: [
          p(
            "QuataTrade provides a secure marketplace where verified users can buy and sell supported digital assets directly with one another.",
          ),
          p("QuataTrade provides:"),
          list([
            "A secure peer-to-peer trading platform.",
            "Digital asset escrow services.",
            "Identity verification (KYC).",
            "Fraud detection and prevention measures.",
            "Trade monitoring.",
            "Dispute resolution services.",
            "Platform security and compliance.",
          ]),
          p(
            "QuataTrade is not a bank, payment processor, broker, investment adviser, financial institution, or money transmitter for peer-to-peer fiat payments conducted between users.",
          ),
        ],
      },
      {
        heading: "Eligibility",
        blocks: [
          p("To use QuataTrade, you must:"),
          list([
            "Be at least eighteen (18) years of age.",
            "Have full legal capacity to enter into binding agreements.",
            "Successfully complete all required identity verification procedures before trading.",
            "Provide accurate, complete, and truthful information.",
            "Comply with all applicable laws and regulations.",
          ]),
          p("QuataTrade reserves the right to deny registration or access where permitted by law."),
        ],
      },
      {
        heading: "Services Supported at Launch",
        blocks: [
          p("At launch, QuataTrade supports:"),
          list([
            "USDT on the TRON (TRC20) blockchain.",
            "Peer-to-peer trading between verified users.",
            "Secure escrow protection for eligible trades.",
          ]),
          p("Additional digital assets, blockchain networks, and services may be introduced in future releases."),
        ],
      },
      {
        heading: "Nature of Peer-to-Peer Trading",
        blocks: [
          p("QuataTrade provides the technology platform that connects buyers and sellers."),
          p("Digital assets are exchanged through the Platform using escrow protection."),
          p("However, fiat currency payments are not processed through QuataTrade. Instead:"),
          list([
            "Sellers determine which payment methods they accept.",
            "Buyers and sellers agree on a payment method before completing payment.",
            "Fiat payments are made directly between traders outside the QuataTrade Platform.",
            "QuataTrade does not receive, process, hold, or control fiat payments exchanged between users.",
          ]),
          p("Examples of payment methods that traders may choose include:"),
          list(["MTN Mobile Money", "Orange Money", "Bank Transfer", "QuataPay Wallet", "Other payment methods accepted by the seller"]),
          p(
            "These payment methods are provided solely as examples. Availability depends on the individual seller’s preferences and applicable laws.",
          ),
        ],
      },
      {
        heading: "Account Registration",
        blocks: [
          p("To use QuataTrade, users must register an account. During registration, you agree to:"),
          list([
            "Provide accurate information.",
            "Keep your information updated.",
            "Maintain the security of your account.",
            "Keep your password confidential.",
            "Immediately notify QuataTrade if you suspect unauthorized access.",
          ]),
          p("You remain responsible for all activities conducted through your account."),
        ],
      },
      {
        heading: "Identity Verification (KYC)",
        blocks: [
          p("Identity verification is mandatory before any trading activity. QuataTrade may request:"),
          list([
            "Government-issued identification.",
            "Selfie verification.",
            "Proof of address.",
            "Source of funds documentation where legally required.",
            "Additional compliance documentation when necessary.",
          ]),
          p("Failure to complete verification may result in restrictions, suspension, or closure of your account."),
        ],
      },
      {
        heading: "Trading Process",
        blocks: [
          p("When a trade is initiated:"),
          list([
            "The seller deposits the agreed amount of USDT (TRC20) into QuataTrade escrow.",
            "The buyer sends payment directly to the seller using the payment method selected by the seller.",
            "The seller independently confirms receipt of payment.",
            "Once payment is confirmed, QuataTrade releases the escrowed USDT to the buyer.",
          ]),
          p(
            "QuataTrade does not verify bank balances or mobile money balances before escrow release. Sellers are responsible for confirming that payment has been successfully received before releasing digital assets.",
          ),
          p("Users must never claim payment has been made or received unless it has actually been completed."),
        ],
      },
      {
        heading: "Escrow Protection",
        blocks: [
          p("Escrow is designed to reduce fraud during peer-to-peer trading. QuataTrade may temporarily suspend escrow release when:"),
          list([
            "Fraud is suspected.",
            "Payment evidence conflicts.",
            "Identity verification is incomplete.",
            "Compliance reviews are required.",
            "A dispute has been opened.",
            "Required by law or regulatory authorities.",
          ]),
          p("Escrow protection applies only to trades completed entirely through the official QuataTrade Platform."),
        ],
      },
      {
        heading: "User Responsibilities",
        blocks: [
          p("By using QuataTrade, you agree to:"),
          list([
            "Trade honestly and in good faith.",
            "Complete payments within the agreed timeframe.",
            "Follow all Platform rules.",
            "Maintain accurate account information.",
            "Protect your login credentials.",
            "Respect other users.",
            "Report suspicious activities immediately.",
            "Cooperate during compliance reviews and dispute investigations.",
          ]),
          p("You remain solely responsible for your trading decisions and financial activities."),
        ],
      },
      {
        heading: "Prohibited Activities",
        blocks: [
          p(
            "Users must not engage in any activity that threatens the integrity or security of the Platform. Prohibited activities include, but are not limited to:",
          ),
          list([
            "Fraud or attempted fraud.",
            "Uploading fake payment receipts.",
            "Falsely claiming payment has been sent.",
            "Releasing digital assets without proper authorization.",
            "Money laundering.",
            "Terrorist financing.",
            "Identity theft or impersonation.",
            "Using stolen financial accounts.",
            "Creating multiple accounts to bypass restrictions.",
            "Manipulating market prices.",
            "Abuse of the dispute system.",
            "Attempting to bypass escrow.",
            "Hacking, probing, reverse engineering, or interfering with Platform security.",
            "Violating sanctions or applicable laws.",
            "Using QuataTrade for any unlawful purpose.",
          ]),
          p(
            "Violation of these Terms may result in immediate suspension, restriction, or permanent termination of your account without prior notice where permitted by law.",
          ),
        ],
      },
      {
        heading: "Platform Fees",
        blocks: [
          p("Certain services on QuataTrade may be subject to fees."),
          p(
            "Applicable fees are published on the official Fees page and may be updated from time to time. By using the Platform, you agree to pay all applicable fees associated with your transactions.",
          ),
          p(
            "QuataTrade reserves the right to introduce, modify, or remove fees by providing reasonable notice through the Platform where required.",
          ),
        ],
      },
      {
        heading: "Dispute Resolution",
        blocks: [
          p(
            "QuataTrade provides a dispute resolution process to help resolve disagreements arising from trades conducted through the Platform. A dispute may be opened if:",
          ),
          list([
            "The buyer claims payment has been made but the seller has not released the escrowed digital asset.",
            "The seller disputes the validity of a payment.",
            "Fraud or suspicious activity is suspected.",
            "Either party believes the trade has not been completed according to the agreed terms.",
          ]),
          p("A dispute must be opened within 30 minutes of the issue arising while the trade remains active."),
          p(
            "Users must provide any evidence requested, including payment confirmations, transaction receipts, chat history, blockchain transaction IDs, screenshots, or other relevant information.",
          ),
          p(
            "QuataTrade administrators will review all available evidence and make a decision based on the information available, applicable Platform policies, and security considerations.",
          ),
          p("The decision of QuataTrade regarding disputes is final for the purposes of resolving disputes on the Platform."),
        ],
      },
      {
        heading: "Account Suspension and Termination",
        blocks: [
          p("QuataTrade may suspend, restrict, or permanently terminate an account if it determines that a user has:"),
          list([
            "Violated these Terms.",
            "Engaged in fraud or attempted fraud.",
            "Submitted fake payment confirmations or forged documents.",
            "Participated in money laundering or terrorist financing.",
            "Violated applicable sanctions or laws.",
            "Created multiple accounts to evade restrictions.",
            "Manipulated the market or abused the Platform.",
            "Threatened the security, integrity, or reputation of QuataTrade or its users.",
          ]),
          p("Where permitted by law, QuataTrade may take immediate action without prior notice to protect the Platform and its users."),
        ],
      },
      {
        heading: "Security",
        blocks: [
          p(
            "QuataTrade employs commercially reasonable administrative, technical, and organizational measures to protect the Platform and user accounts.",
          ),
          p("Users are responsible for:"),
          list([
            "Keeping passwords and authentication credentials secure.",
            "Protecting devices used to access the Platform.",
            "Reporting suspected unauthorized access immediately.",
            "Following all published security guidance.",
          ]),
          p(
            "While QuataTrade works to maintain a secure environment, no online service can guarantee absolute security. Users acknowledge the inherent risks associated with internet-based services and blockchain networks.",
          ),
        ],
      },
      {
        heading: "Risk Disclosure",
        blocks: [
          p("Trading digital assets involves significant risk. Users acknowledge and accept that:"),
          list([
            "Digital asset prices may fluctuate rapidly.",
            "Blockchain transactions are generally irreversible.",
            "Third-party payment providers may experience delays or outages.",
            "Government regulations may change.",
            "Technical failures, network congestion, or cyber incidents may affect transactions.",
          ]),
          p(
            "QuataTrade does not provide investment, financial, legal, accounting, or tax advice. Users are solely responsible for evaluating the suitability and risks of their trading activities.",
          ),
        ],
      },
      {
        heading: "Intellectual Property",
        blocks: [
          p(
            "All intellectual property rights in the Platform, including software, source code, trademarks, logos, branding, graphics, documentation, text, designs, and other content, are owned by or licensed to Quata Digital Enterprise.",
          ),
          p(
            "No part of the Platform may be copied, reproduced, modified, distributed, published, or used without prior written permission, except as permitted by applicable law.",
          ),
        ],
      },
      {
        heading: "Limitation of Liability",
        blocks: [
          p(
            "QuataTrade provides a technology platform that facilitates peer-to-peer digital asset trading and escrow services.",
          ),
          p(
            "To the maximum extent permitted by applicable law, Quata Digital Enterprise, QuataTrade, its affiliates, directors, employees, contractors, and agents shall not be liable for any direct, indirect, incidental, consequential, special, exemplary, or punitive damages arising from or related to:",
          ),
          list([
            "Trading losses.",
            "Market volatility.",
            "User errors.",
            "Delays or failures by third-party payment providers.",
            "Blockchain network congestion or failures.",
            "Internet outages.",
            "Unauthorized access resulting from compromised user credentials.",
            "Actions or omissions of other users.",
            "Events beyond QuataTrade’s reasonable control.",
          ]),
          p("Nothing in these Terms excludes or limits liability where such exclusion is prohibited by applicable law."),
        ],
      },
      {
        heading: "Privacy",
        blocks: [
          p(
            "Your use of QuataTrade is also governed by the Privacy Policy, Cookie Policy, Anti-Money Laundering Policy, Risk Disclosure, Trade Rules, Prohibited Use Policy, and other policies published on the Platform.",
          ),
          p(
            "By using QuataTrade, you acknowledge and agree that these policies form part of these Terms of Service.",
          ),
        ],
      },
      {
        heading: "Changes to These Terms",
        blocks: [
          p(
            "QuataTrade may amend or update these Terms from time to time to reflect changes in law, regulatory requirements, Platform functionality, security practices, or business operations.",
          ),
          p("Updated Terms become effective upon publication unless otherwise stated."),
          p(
            "Your continued use of the Platform after updated Terms become effective constitutes your acceptance of the revised Terms.",
          ),
        ],
      },
      {
        heading: "Governing Law and Contact Information",
        blocks: [
          p("These Terms are governed by and interpreted in accordance with the laws of the Republic of Cameroon."),
          p(
            "Any dispute relating to these Terms shall be subject to the jurisdiction of the competent courts of Cameroon, unless otherwise required by applicable law.",
          ),
          p("For questions regarding these Terms or the Platform, please contact:"),
          list([
            "Quata Digital Enterprise",
            "Operating Platform: QuataTrade",
            "Location: Bamenda, Cameroon",
            "Email: support@quatatrade.com",
          ]),
          p(
            "By creating an account or using QuataTrade, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.",
          ),
        ],
      },
    ],
  },

  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    version: "1.0",
    lastUpdated: EFFECTIVE,
    status: "final",
    summary:
      "This Privacy Policy explains how QuataTrade, a product of Quata Digital Enterprise, collects, uses, stores, shares, and protects your personal information when you access or use the Platform. By creating an account or using the Platform, you acknowledge that you have read and understood this Privacy Policy.",
    sections: [
      {
        heading: "Who We Are",
        blocks: [
          p("QuataTrade is a peer-to-peer (P2P) digital asset trading platform operated by Quata Digital Enterprise from Bamenda, Cameroon."),
          p(
            "QuataTrade provides a secure marketplace where verified users can buy and sell supported digital assets using escrow protection. While QuataTrade facilitates peer-to-peer trading and secures supported digital assets in escrow, fiat payments are arranged directly between traders using payment methods agreed upon by them. QuataTrade does not receive, process, or hold fiat payments exchanged between users.",
          ),
        ],
      },
      {
        heading: "Information We Collect",
        blocks: [
          p(
            "To operate the Platform safely, securely, and in compliance with applicable laws, QuataTrade may collect the following categories of information.",
          ),
          sub("2.1 Personal Identification Information"),
          list([
            "Full name",
            "Date of birth",
            "Email address",
            "Mobile phone number",
            "Residential address",
            "Nationality",
            "Government-issued identification documents",
            "Passport, National ID card, Driver’s Licence, or other accepted identification",
            "Selfie or facial verification images",
            "Signature where required",
            "Tax or regulatory identification numbers where legally required",
          ]),
          sub("2.2 Account Information"),
          list([
            "Username",
            "Login credentials",
            "Password (stored securely using industry-standard hashing techniques)",
            "Two-factor authentication information",
            "Security questions and recovery information where applicable",
            "Account preferences",
            "Language preferences",
            "Notification settings",
          ]),
          sub("2.3 Financial and Trading Information"),
          list([
            "Blockchain wallet addresses",
            "USDT (TRC20) transaction details",
            "Blockchain transaction hashes",
            "Trade history",
            "Escrow transaction records",
            "Trade timestamps",
            "Advertisements created by users",
            "Payment method preferences selected by traders",
            "Fiat payment confirmations or evidence uploaded during trades or disputes",
            "Dispute records",
          ]),
          p(
            "QuataTrade does not receive or hold users’ fiat funds. Payment information is collected only where necessary to verify trades, investigate disputes, comply with legal obligations, or prevent fraud.",
          ),
          sub("2.4 Device and Technical Information"),
          list([
            "IP address",
            "Browser type and version",
            "Operating system",
            "Device type",
            "Device identifiers",
            "Screen resolution",
            "Language settings",
            "Time zone",
            "Network information",
            "Cookies and similar technologies",
            "Browser fingerprints where appropriate for fraud prevention",
            "Security logs",
            "Access timestamps",
          ]),
          sub("2.5 Location Information"),
          p("We may collect approximate geographic location information derived from:"),
          list(["IP address", "Device settings where permission has been granted", "Account activity"]),
          p("Location information helps us:"),
          list(["Prevent fraud", "Detect suspicious logins", "Comply with legal obligations", "Improve Platform security"]),
          sub("2.6 Communications"),
          p("We may collect information contained in communications made through the Platform, including:"),
          list([
            "Trade chat messages",
            "Customer support requests",
            "Email correspondence",
            "Feedback submitted through the Platform",
            "Dispute communications",
            "Reports of suspicious activity",
          ]),
          p(
            "These communications may be reviewed where necessary to investigate fraud, resolve disputes, improve customer support, or comply with legal obligations.",
          ),
        ],
      },
      {
        heading: "How We Use Your Information",
        blocks: [
          p(
            "QuataTrade uses personal information only where necessary for legitimate business purposes, contractual obligations, legal compliance, and Platform security. We may use your information to:",
          ),
          list([
            "Create and manage your account.",
            "Verify your identity through Know Your Customer (KYC) procedures.",
            "Facilitate peer-to-peer digital asset trading.",
            "Operate escrow services.",
            "Authenticate users.",
            "Detect and prevent fraud.",
            "Prevent money laundering and other financial crimes.",
            "Investigate suspicious activities.",
            "Resolve disputes between traders.",
            "Improve Platform performance.",
            "Maintain Platform security.",
            "Communicate important account information.",
            "Respond to customer support requests.",
            "Comply with applicable laws and regulatory obligations.",
            "Enforce our Terms of Service and Platform policies.",
            "Conduct internal audits and risk assessments.",
            "Develop new Platform features and services.",
          ]),
          p("We do not sell your personal information to third parties."),
        ],
      },
      {
        heading: "Legal Basis for Processing",
        blocks: [
          p("Where applicable, QuataTrade processes personal information based on one or more of the following legal grounds:"),
          list([
            "Your consent.",
            "Performance of a contract with you.",
            "Compliance with legal and regulatory obligations.",
            "Protection against fraud and financial crime.",
            "Protection of the legitimate interests of QuataTrade and its users.",
            "Establishment, exercise, or defence of legal claims.",
          ]),
        ],
      },
      {
        heading: "Cookies and Similar Technologies",
        blocks: [
          p(
            "QuataTrade uses cookies and similar technologies to improve security, enhance user experience, and support the operation of the Platform. We may use:",
          ),
          list([
            "Essential cookies required for Platform functionality.",
            "Security cookies used to protect accounts and detect fraudulent activity.",
            "Functional cookies that remember user preferences.",
            "Performance cookies that help improve Platform performance.",
            "Analytics cookies that help us understand how users interact with the Platform.",
          ]),
          p(
            "These technologies do not change your browser settings or access unrelated information on your device. Where required by law, you may manage cookie preferences through your browser or through the Platform when such controls are available.",
          ),
        ],
      },
      {
        heading: "Data Retention",
        blocks: [
          p("QuataTrade retains personal information only for as long as necessary to:"),
          list([
            "Provide and improve the Platform.",
            "Complete and verify transactions.",
            "Resolve disputes.",
            "Prevent fraud and abuse.",
            "Enforce our agreements.",
            "Meet legal, regulatory, accounting, tax, and compliance obligations.",
          ]),
          p(
            "Certain records may continue to be retained after account closure where required by law, necessary for legitimate business purposes, or needed to establish, exercise, or defend legal claims.",
          ),
          p(
            "When personal information is no longer required, QuataTrade will securely delete, anonymize, or otherwise dispose of it in accordance with applicable laws and industry best practices.",
          ),
        ],
      },
      {
        heading: "Sharing of Personal Information",
        blocks: [
          p(
            "QuataTrade treats your personal information with care and does not sell your personal information to third parties. We may share personal information only when necessary to operate the Platform, protect users, comply with legal obligations, or provide requested services. Your information may be shared with:",
          ),
          list([
            "Cloud hosting and infrastructure providers supporting the Platform.",
            "Identity verification (KYC) providers.",
            "Email delivery and communication service providers.",
            "Security, fraud detection, and risk monitoring providers.",
            "Analytics and system monitoring providers.",
            "Blockchain networks, including the TRON network, where transaction information is publicly recorded on the blockchain.",
            "Professional advisers, auditors, insurers, or legal representatives where required.",
            "Courts, regulators, law enforcement agencies, or government authorities where disclosure is required by applicable law or a lawful request.",
            "Successors or acquiring entities in connection with a merger, acquisition, restructuring, or sale of all or part of QuataTrade’s business, subject to appropriate safeguards.",
          ]),
          p(
            "We require service providers that process personal information on our behalf to implement appropriate security and confidentiality measures.",
          ),
        ],
      },
      {
        heading: "International Data Transfers",
        blocks: [
          p(
            "QuataTrade may process and store personal information in Cameroon and in secure cloud infrastructure located in other jurisdictions, depending on the technologies and service providers used to operate the Platform.",
          ),
          p(
            "Where personal information is transferred across borders, QuataTrade implements reasonable safeguards designed to protect your information and to ensure that it receives an appropriate level of protection consistent with applicable laws.",
          ),
        ],
      },
      {
        heading: "Security of Your Information",
        blocks: [
          p("Protecting user information is a core priority for QuataTrade."),
          p(
            "We implement administrative, technical, and organizational safeguards designed to protect personal information against unauthorized access, disclosure, alteration, loss, misuse, or destruction. Our security measures may include:",
          ),
          list([
            "Encryption of data in transit.",
            "Encryption of sensitive data at rest where appropriate.",
            "Multi-factor authentication.",
            "Role-based access controls.",
            "Least-privilege access management.",
            "Continuous security monitoring.",
            "Audit logging and security event recording.",
            "Fraud detection and prevention systems.",
            "Secure backup and disaster recovery procedures.",
            "Regular software updates and security patching.",
            "Internal security policies and staff access controls.",
          ]),
          p(
            "Although we strive to protect your information, no internet-based service or electronic storage system can guarantee absolute security. Users are also responsible for maintaining the security of their own accounts and credentials.",
          ),
        ],
      },
      {
        heading: "Your Privacy Rights",
        blocks: [
          p("Subject to applicable law, you may have the right to:"),
          list([
            "Access the personal information we hold about you.",
            "Request correction of inaccurate or incomplete information.",
            "Request deletion of personal information where legally permitted.",
            "Request a copy of your personal information in a commonly used format where applicable.",
            "Object to or request restriction of certain processing activities where permitted by law.",
            "Withdraw consent where processing is based on consent, without affecting the lawfulness of processing carried out before withdrawal.",
            "Submit a complaint to an appropriate supervisory or regulatory authority where applicable.",
          ]),
          p(
            "To exercise any of these rights, please contact us using the details provided at the end of this Privacy Policy. QuataTrade may request additional information to verify your identity before processing certain requests.",
          ),
        ],
      },
      {
        heading: "Children’s Privacy",
        blocks: [
          p("QuataTrade is intended solely for individuals who are at least eighteen (18) years of age."),
          p("We do not knowingly collect, process, or maintain personal information from anyone under the age of 18."),
          p(
            "If we become aware that personal information belonging to a minor has been collected without appropriate legal authorization, we will take reasonable steps to delete that information and, where appropriate, suspend or terminate the associated account.",
          ),
        ],
      },
      {
        heading: "Third-Party Services",
        blocks: [
          p("The Platform may interact with or rely upon third-party technologies and services. These may include:"),
          list([
            "Cloud hosting providers.",
            "Identity verification providers.",
            "Email communication providers.",
            "Analytics and monitoring services.",
            "Blockchain infrastructure.",
            "Security and fraud prevention services.",
          ]),
          p(
            "QuataTrade is not responsible for the privacy practices of independent third-party websites or services that are not controlled by Quata Digital Enterprise. Users should review the privacy policies of those services where applicable.",
          ),
        ],
      },
      {
        heading: "Changes to This Privacy Policy",
        blocks: [
          p(
            "QuataTrade may update this Privacy Policy from time to time to reflect changes in applicable laws, regulatory requirements, Platform functionality, security practices, or business operations.",
          ),
          p("The updated version becomes effective upon publication unless a different effective date is stated."),
          p("Your continued use of the Platform after changes become effective constitutes acceptance of the updated Privacy Policy."),
        ],
      },
      {
        heading: "Contact Us",
        blocks: [
          p(
            "If you have questions, concerns, or requests regarding this Privacy Policy or our handling of personal information, please contact:",
          ),
          list(["Quata Digital Enterprise", "Operating Platform: QuataTrade", "Location: Bamenda, Cameroon", "Email: support@quatatrade.com"]),
          p("We will make reasonable efforts to respond to legitimate privacy-related inquiries within a reasonable period, subject to applicable law."),
        ],
      },
      {
        heading: "Acceptance of This Privacy Policy",
        blocks: [
          p(
            "By accessing or using QuataTrade, creating an account, or continuing to use the Platform after this Privacy Policy becomes effective, you acknowledge that you have read, understood, and agree to the collection, use, storage, disclosure, and protection of your personal information as described in this Privacy Policy.",
          ),
          p(
            "This Privacy Policy should be read together with the Terms of Service, Cookie Policy, Anti-Money Laundering (AML) Policy, Risk Disclosure, Trade Rules, Prohibited Use Policy, and any other applicable policies published by QuataTrade.",
          ),
        ],
      },
    ],
  },

  aml: {
    slug: "aml",
    title: "Anti-Money Laundering (AML) & CTF Policy",
    version: "1.0",
    lastUpdated: EFFECTIVE,
    status: "final",
    summary:
      "As a product of Quata Digital Enterprise, QuataTrade is committed to preventing the misuse of our Platform for money laundering, terrorist financing, fraud, sanctions evasion, and other financial crimes. This Policy explains the measures we take to detect, prevent, investigate, and report suspicious activity.",
    sections: [
      {
        heading: "Our Commitment",
        blocks: [
          p("QuataTrade is committed to:"),
          list([
            "Preventing financial crime.",
            "Protecting the integrity of the Platform.",
            "Protecting users from fraud and criminal activity.",
            "Maintaining a risk-based compliance program.",
            "Cooperating with competent authorities where legally required.",
            "Continuously improving our compliance framework.",
          ]),
          p("Compliance is a shared responsibility between QuataTrade and every user of the Platform."),
        ],
      },
      {
        heading: "Scope",
        blocks: [
          p("This Policy applies to:"),
          list([
            "All registered users.",
            "All prospective users.",
            "Buyers and sellers.",
            "Business partners where applicable.",
            "Any individual or organization using QuataTrade services.",
          ]),
          p("By using QuataTrade, you agree to comply with this Policy and all applicable laws governing your activities."),
        ],
      },
      {
        heading: "Know Your Customer (KYC)",
        blocks: [
          p("Identity verification is mandatory before any user can buy or sell digital assets on QuataTrade. Depending on the level of risk and applicable legal requirements, users may be required to provide:"),
          list([
            "Full legal name.",
            "Date of birth.",
            "Residential address.",
            "Government-issued identification.",
            "Selfie or facial verification.",
            "Contact information.",
            "Additional documentation where necessary.",
          ]),
          p("QuataTrade may request updated information periodically to ensure records remain accurate and current."),
        ],
      },
      {
        heading: "Customer Due Diligence (CDD)",
        blocks: [
          p("QuataTrade applies Customer Due Diligence (CDD) procedures to understand who is using the Platform and to reduce the risk of financial crime. CDD measures may include:"),
          list([
            "Identity verification.",
            "Verification of personal information.",
            "Assessment of user risk.",
            "Review of trading activity.",
            "Verification of payment information where appropriate.",
          ]),
          p("Users who fail CDD requirements may be restricted from using certain or all Platform services."),
        ],
      },
      {
        heading: "Enhanced Due Diligence (EDD)",
        blocks: [
          p("Certain users or transactions may require Enhanced Due Diligence (EDD), applied where higher levels of risk are identified, including but not limited to:"),
          list([
            "Large or unusual trading activity.",
            "High-risk jurisdictions.",
            "Politically Exposed Persons (PEPs).",
            "Complex ownership structures.",
            "Suspicious transaction patterns.",
            "Regulatory requirements.",
          ]),
          p("EDD may require additional information such as source of funds, source of wealth, additional identity documentation, business documentation, or supporting financial records. Failure to provide requested information may result in delays, restrictions, or account closure."),
        ],
      },
      {
        heading: "Risk-Based Approach",
        blocks: [
          p("QuataTrade applies a risk-based approach to compliance. Users, transactions, and activities may be assessed using factors such as:"),
          list([
            "Geographic location.",
            "Trading behaviour.",
            "Transaction size.",
            "Frequency of transactions.",
            "Payment methods.",
            "Device and login activity.",
            "Blockchain activity.",
            "Historical account behaviour.",
            "Fraud indicators.",
          ]),
          p("Higher-risk activity may receive additional review before transactions are approved."),
        ],
      },
      {
        heading: "Transaction Monitoring",
        blocks: [
          p("QuataTrade continuously monitors Platform activity to detect unusual or suspicious behaviour. Monitoring may include:"),
          list([
            "Trade patterns.",
            "Wallet activity.",
            "Deposit and withdrawal behaviour.",
            "Escrow transactions.",
            "Login activity.",
            "Device changes.",
            "IP address analysis.",
            "Multiple account detection.",
            "Blockchain transaction monitoring.",
            "Other risk indicators.",
          ]),
          p("Automated systems and manual reviews may be used to identify potentially suspicious activity."),
        ],
      },
      {
        heading: "Sanctions Compliance",
        blocks: [
          p("QuataTrade is committed to complying with applicable sanctions laws and regulations. We may:"),
          list([
            "Screen users against applicable sanctions lists.",
            "Restrict or refuse access where legally required.",
            "Block transactions involving prohibited persons or entities.",
            "Freeze or delay activity where necessary to comply with legal obligations.",
          ]),
          p("Users must not use QuataTrade in violation of applicable sanctions or export control laws."),
        ],
      },
      {
        heading: "Politically Exposed Persons (PEPs)",
        blocks: [
          p(
            "QuataTrade may identify and apply additional compliance measures to Politically Exposed Persons (PEPs), their family members, and close associates where required by applicable law. PEP status does not automatically prevent the use of the Platform but may require Enhanced Due Diligence and ongoing monitoring.",
          ),
        ],
      },
      {
        heading: "Source of Funds & Source of Wealth",
        blocks: [
          p("Where appropriate, QuataTrade may request information regarding the origin of funds or assets used on the Platform. Examples include:"),
          list(["Employment income.", "Business income.", "Investment income.", "Savings.", "Asset sales.", "Other lawful sources."]),
          p("Users may also be asked to explain the origin of accumulated wealth where required by applicable laws or internal compliance procedures."),
        ],
      },
      {
        heading: "Suspicious Activity",
        blocks: [
          p("Examples of activity that may be considered suspicious include:"),
          list([
            "Use of false identity documents.",
            "Fake payment confirmations.",
            "Structuring transactions to avoid monitoring.",
            "Multiple accounts used to bypass restrictions.",
            "Unusual trading patterns.",
            "Transactions inconsistent with a user's profile.",
            "Attempted money laundering.",
            "Terrorist financing.",
            "Fraud or attempted fraud.",
            "Sanctions evasion.",
            "Any other activity that appears unlawful or suspicious.",
          ]),
          p("The identification of suspicious activity does not necessarily indicate wrongdoing but may result in further review."),
        ],
      },
      {
        heading: "Compliance Actions",
        blocks: [
          p("Where necessary, QuataTrade may take one or more of the following actions:"),
          list([
            "Request additional documentation.",
            "Delay or suspend transactions.",
            "Place temporary restrictions on an account.",
            "Reject deposits or withdrawals.",
            "Restrict trading activity.",
            "Close user accounts.",
            "Preserve relevant records.",
            "Cooperate with competent authorities where legally required.",
          ]),
          p("These measures are intended to protect the Platform, our users, and the integrity of the financial system."),
        ],
      },
      {
        heading: "Record Retention",
        blocks: [
          p("QuataTrade retains compliance-related records for as long as necessary to:"),
          list([
            "Meet legal and regulatory obligations.",
            "Support fraud investigations.",
            "Resolve disputes.",
            "Protect the Platform.",
            "Establish, exercise, or defend legal claims.",
          ]),
          p("Records are retained securely and handled in accordance with our Privacy Policy."),
        ],
      },
      {
        heading: "Regulatory Cooperation",
        blocks: [
          p(
            "Where required by applicable law, QuataTrade may cooperate with competent courts, regulators, law enforcement agencies, financial intelligence units, and other authorized authorities. Such cooperation may include the lawful disclosure of relevant information or records in response to valid legal requests.",
          ),
        ],
      },
      {
        heading: "User Responsibilities",
        blocks: [
          p("Every user is responsible for:"),
          list([
            "Providing accurate information.",
            "Keeping identity documents up to date.",
            "Responding promptly to compliance requests.",
            "Using only lawfully obtained funds.",
            "Complying with applicable laws.",
            "Avoiding any activity that may facilitate financial crime.",
          ]),
          p("Failure to comply with these responsibilities may result in restrictions on Platform access."),
        ],
      },
      {
        heading: "Consequences of Non-Compliance",
        blocks: [
          p("Violations of this Policy may result in one or more of the following actions:"),
          list([
            "Temporary account restrictions.",
            "Suspension of trading privileges.",
            "Delayed or rejected transactions.",
            "Permanent account closure.",
            "Loss of access to Platform services.",
            "Reporting to competent authorities where required by law.",
          ]),
          p("QuataTrade reserves the right to take appropriate action to protect the Platform and comply with its legal obligations."),
        ],
      },
      {
        heading: "Changes to This Policy",
        blocks: [
          p(
            "QuataTrade may update this AML & CTF Policy to reflect changes in applicable laws, regulatory requirements, industry standards, or Platform operations. The latest version will always be published on the Platform, and continued use of QuataTrade after changes become effective constitutes acceptance of the updated Policy.",
          ),
        ],
      },
      {
        heading: "Contact Us",
        blocks: [
          p("If you have questions regarding this Policy or receive a compliance request from QuataTrade, please contact:"),
          list(["Quata Digital Enterprise", "Operating Platform: QuataTrade", "Location: Bamenda, Cameroon", "Support & Compliance: support@quatatrade.com"]),
        ],
      },
    ],
  },

  risk: {
    slug: "risk",
    title: "Risk Disclosure",
    version: "1.0",
    lastUpdated: EFFECTIVE,
    status: "final",
    summary:
      "Trading digital assets involves significant risks that cannot be completely eliminated. This Risk Disclosure explains the principal risks associated with using QuataTrade. By creating an account or using the Platform, you acknowledge that you understand these risks and accept full responsibility for your decisions.",
    sections: [
      {
        heading: "No Investment Advice",
        blocks: [
          p("QuataTrade does not provide:"),
          list([
            "Investment advice.",
            "Financial advice.",
            "Trading recommendations.",
            "Tax advice.",
            "Legal advice.",
            "Portfolio management services.",
          ]),
          p(
            "Information provided on the Platform is for general informational purposes only and should not be interpreted as a recommendation to buy, sell, or hold any digital asset. Users are solely responsible for evaluating their own financial circumstances and seeking independent professional advice where appropriate.",
          ),
        ],
      },
      {
        heading: "Cryptocurrency Market Risk",
        blocks: [
          p("Cryptocurrency markets are highly dynamic and may experience significant price movements within short periods. The value of digital assets may increase or decrease rapidly due to:"),
          list([
            "Market supply and demand.",
            "Global economic conditions.",
            "News and media reports.",
            "Regulatory developments.",
            "Technological changes.",
            "Market sentiment.",
            "Other external factors.",
          ]),
          p("There is no guarantee that the value of any digital asset will remain stable."),
        ],
      },
      {
        heading: "Price Volatility",
        blocks: [
          p(
            "Digital asset prices can change dramatically before, during, or after a trade. A price that appears attractive when a trade is initiated may change significantly before the transaction is completed. Users should understand that market volatility is an inherent characteristic of cryptocurrency markets.",
          ),
        ],
      },
      {
        heading: "Liquidity Risk",
        blocks: [
          p("Market liquidity may vary depending on trading activity. At certain times:"),
          list([
            "Fewer buyers or sellers may be available.",
            "Trades may take longer to complete.",
            "Desired prices may not be available.",
            "Large trades may be more difficult to execute.",
          ]),
          p("Liquidity conditions are influenced by market participation and cannot be guaranteed by QuataTrade."),
        ],
      },
      {
        heading: "Peer-to-Peer Trading Risk",
        blocks: [
          p("QuataTrade is a peer-to-peer marketplace where users trade directly with one another. Although QuataTrade provides escrow protection, users remain responsible for:"),
          list([
            "Selecting trading partners.",
            "Reviewing advertisement terms.",
            "Sending payments correctly.",
            "Confirming receipt of payment.",
            "Following Platform policies.",
          ]),
          p("QuataTrade cannot guarantee that every trade will be completed successfully."),
        ],
      },
      {
        heading: "Escrow Limitations",
        blocks: [
          p(
            "Escrow is designed to reduce the risk of fraud by temporarily holding supported digital assets during an active trade. However, escrow does not eliminate every possible risk. For example:",
          ),
          list([
            "Buyers remain responsible for sending payment correctly.",
            "Sellers remain responsible for independently confirming receipt of payment before releasing cryptocurrency.",
            "Users must provide accurate information during disputes.",
            "Escrow cannot prevent losses caused by user error, false information, or activity outside the Platform.",
          ]),
          p("Escrow protects the cryptocurrency involved in eligible trades but does not protect fiat payments made outside the Platform."),
        ],
      },
      {
        heading: "Third-Party Payment Risks",
        blocks: [
          p(
            "QuataTrade does not process or hold fiat payments between traders. Buyers send payment directly to sellers using payment methods chosen by the seller. As a result, users may be exposed to risks associated with third-party payment providers, including:",
          ),
          list([
            "Banking delays.",
            "Mobile Money service interruptions.",
            "Incorrect account details.",
            "Payment reversals where permitted.",
            "Technical failures.",
            "Human error.",
          ]),
          p("Users should always verify payment independently before releasing cryptocurrency."),
        ],
      },
      {
        heading: "Blockchain Network Risks",
        blocks: [
          p("At launch, QuataTrade supports USDT on the TRON (TRC20) network. Blockchain networks may experience:"),
          list([
            "Network congestion.",
            "Delayed confirmations.",
            "Increased transaction fees.",
            "Software bugs.",
            "Forks or protocol changes.",
            "Temporary service interruptions.",
          ]),
          p("These events may affect deposits, withdrawals, or transaction processing and are generally outside QuataTrade's direct control."),
        ],
      },
      {
        heading: "Irreversible Transactions",
        blocks: [
          p(
            "Most blockchain transactions are irreversible once confirmed. If cryptocurrency is sent to an incorrect wallet address, unsupported network, or unintended recipient, recovery may not be possible. Users are responsible for carefully verifying all wallet addresses, blockchain networks, and transaction details before confirming any transfer.",
          ),
        ],
      },
      {
        heading: "Technical Risks",
        blocks: [
          p("Like all online platforms, QuataTrade may occasionally experience technical issues, including:"),
          list([
            "Internet connectivity problems.",
            "Hardware failures.",
            "Software bugs.",
            "Unexpected service interruptions.",
            "Maintenance activities.",
            "Third-party infrastructure failures.",
          ]),
          p("While we work to minimize disruption, uninterrupted access to the Platform cannot be guaranteed."),
        ],
      },
      {
        heading: "Cybersecurity Risks",
        blocks: [
          p("Cyber threats continue to evolve. Examples include:"),
          list([
            "Phishing attacks.",
            "Malware.",
            "Account compromise.",
            "Social engineering.",
            "Credential theft.",
            "Unauthorized access.",
            "Distributed Denial-of-Service (DDoS) attacks.",
          ]),
          p("QuataTrade implements multiple security controls, but users must also take reasonable steps to protect their accounts, devices, and credentials."),
        ],
      },
      {
        heading: "Regulatory & Legal Risks",
        blocks: [
          p("Laws and regulations relating to digital assets may change at any time. Changes may affect:"),
          list([
            "Platform availability.",
            "Supported services.",
            "Trading activities.",
            "User obligations.",
            "Tax treatment.",
            "Reporting requirements.",
          ]),
          p("QuataTrade may modify, suspend, or discontinue certain services where necessary to comply with applicable laws or regulatory requirements."),
        ],
      },
      {
        heading: "Tax Risks",
        blocks: [
          p(
            "Users are solely responsible for determining and complying with any tax obligations arising from their use of QuataTrade. Depending on applicable laws, buying, selling, holding, or transferring digital assets may result in tax liabilities. Users should seek independent professional advice regarding their tax responsibilities.",
          ),
        ],
      },
      {
        heading: "Operational Risks",
        blocks: [
          p("Unexpected operational events may affect the availability of Platform services. Examples include:"),
          list([
            "Scheduled maintenance.",
            "Infrastructure upgrades.",
            "Third-party service interruptions.",
            "Power failures.",
            "Telecommunications outages.",
            "Natural disasters.",
            "Other events beyond QuataTrade's reasonable control.",
          ]),
          p("We work to restore affected services as quickly as reasonably possible."),
        ],
      },
      {
        heading: "Force Majeure",
        blocks: [
          p("QuataTrade shall not be responsible for delays, interruptions, or failures resulting from events beyond its reasonable control, including but not limited to:"),
          list([
            "Natural disasters.",
            "War or armed conflict.",
            "Civil unrest.",
            "Government actions.",
            "Labour disputes.",
            "Public health emergencies.",
            "Internet or telecommunications failures.",
            "Blockchain network disruptions.",
            "Other extraordinary events.",
          ]),
        ],
      },
      {
        heading: "User Responsibilities",
        blocks: [
          p("Every user is responsible for:"),
          list([
            "Understanding the risks of digital asset trading.",
            "Verifying payment before releasing cryptocurrency.",
            "Protecting account credentials.",
            "Using secure devices and networks.",
            "Following Platform policies.",
            "Complying with applicable laws.",
            "Making independent trading decisions.",
          ]),
          p("Users should never invest funds they cannot afford to lose."),
        ],
      },
      {
        heading: "Limitation of Liability",
        blocks: [
          p("To the maximum extent permitted by applicable law, QuataTrade and Quata Digital Enterprise shall not be liable for losses resulting from:"),
          list([
            "Market fluctuations.",
            "Trading decisions.",
            "Third-party payment failures.",
            "Blockchain network issues.",
            "User mistakes.",
            "Technical failures.",
            "Cybersecurity incidents beyond our reasonable control.",
            "Regulatory changes.",
            "Force majeure events.",
          ]),
          p("Nothing in this Risk Disclosure limits liability where such limitation is prohibited by applicable law."),
        ],
      },
      {
        heading: "Changes to This Risk Disclosure",
        blocks: [
          p(
            "QuataTrade may update this Risk Disclosure from time to time to reflect changes in technology, law, regulatory requirements, or Platform operations. The latest version will always be available on the Platform. Continued use of QuataTrade after updates become effective constitutes acceptance of the revised Risk Disclosure.",
          ),
        ],
      },
      {
        heading: "Contact Us",
        blocks: [
          p("If you have questions regarding this Risk Disclosure or the risks associated with using QuataTrade, please contact:"),
          list(["Quata Digital Enterprise", "Operating Platform: QuataTrade", "Location: Bamenda, Cameroon", "Email: support@quatatrade.com"]),
          p(
            "By using QuataTrade, you acknowledge that you have read, understood, and accepted the risks described in this Risk Disclosure. You agree that you are solely responsible for your own trading decisions and for using the Platform in accordance with applicable laws and QuataTrade's published policies.",
          ),
        ],
      },
    ],
  },

  "trade-rules": {
    slug: "trade-rules",
    title: "Trading Rules",
    version: "1.0",
    lastUpdated: EFFECTIVE,
    status: "final",
    summary:
      "These Trading Rules govern all peer-to-peer (P2P) trading activities conducted on QuataTrade. By creating advertisements, initiating trades, or participating in transactions, you agree to comply with these Rules and all other applicable Platform policies. Failure to comply may result in warnings, restrictions, suspension, or permanent removal from the Platform.",
    sections: [
      {
        heading: "Purpose",
        blocks: [
          p("The purpose of these Trading Rules is to:"),
          list([
            "Promote fair trading practices.",
            "Protect buyers and sellers.",
            "Reduce fraud.",
            "Maintain marketplace integrity.",
            "Provide clear expectations for all users.",
            "Support consistent dispute resolution.",
          ]),
        ],
      },
      {
        heading: "Eligibility to Trade",
        blocks: [
          p("Only verified users may participate in trading. To trade on QuataTrade, you must:"),
          list([
            "Be at least 18 years old.",
            "Successfully complete identity verification (KYC).",
            "Maintain an active account in good standing.",
            "Comply with all applicable laws and Platform policies.",
          ]),
          p("Accounts under investigation or subject to restrictions may be prevented from trading."),
        ],
      },
      {
        heading: "Creating Advertisements",
        blocks: [
          p("Sellers and eligible users creating advertisements must ensure that all information is accurate and up to date. Advertisements should clearly state:"),
          list([
            "Price.",
            "Minimum trade amount.",
            "Maximum trade amount.",
            "Accepted payment methods.",
            "Payment time limit.",
            "Additional trading instructions, where applicable.",
          ]),
          p("Advertisements containing misleading, deceptive, or inaccurate information are prohibited."),
        ],
      },
      {
        heading: "Pricing Rules",
        blocks: [
          p("Users are responsible for setting their own prices. Prices must:"),
          list([
            "Be clearly displayed.",
            "Accurately reflect the intended trading price.",
            "Not intentionally mislead or deceive other users.",
            "Comply with applicable laws and Platform policies.",
          ]),
          p("QuataTrade does not control or guarantee market prices."),
        ],
      },
      {
        heading: "Payment Method Rules",
        blocks: [
          p("Payment methods are selected by the seller when creating an advertisement. Buyers must:"),
          list([
            "Use only the payment methods accepted by the seller.",
            "Send payment only to the payment details displayed within the active trade.",
            "Follow the seller's payment instructions.",
          ]),
          p("QuataTrade does not process, receive, or hold fiat payments exchanged between buyers and sellers."),
        ],
      },
      {
        heading: "Trade Time Limits",
        blocks: [
          p(
            "Every trade includes a payment countdown. The standard payment window is 30 minutes, although Platform settings may change over time. If payment is not completed within the allowed time and no dispute has been opened, the trade may be cancelled automatically and the escrowed cryptocurrency returned to the seller.",
          ),
        ],
      },
      {
        heading: "Escrow Rules",
        blocks: [
          p("Escrow protects the cryptocurrency involved in eligible trades. When a trade begins:"),
          list([
            "The seller's USDT (TRC20) is locked in escrow.",
            "The cryptocurrency remains locked until the trade is completed or a dispute is resolved.",
            "Sellers cannot withdraw or transfer escrowed assets during an active trade.",
          ]),
          p("Escrow applies only to trades conducted entirely through the official QuataTrade Platform."),
        ],
      },
      {
        heading: "Buyer Responsibilities",
        blocks: [
          p("Buyers must:"),
          list([
            "Read the advertisement carefully before starting a trade.",
            "Make payment within the required time.",
            "Send the correct amount.",
            "Use the seller's approved payment method.",
            "Mark Payment Sent only after payment has actually been completed.",
            "Keep proof of payment.",
            "Cooperate during dispute investigations.",
          ]),
          p("False claims of payment are strictly prohibited."),
        ],
      },
      {
        heading: "Seller Responsibilities",
        blocks: [
          p("Sellers must:"),
          list([
            "Ensure sufficient USDT is available before creating advertisements.",
            "Verify receipt of payment independently.",
            "Release escrow promptly after confirming payment.",
            "Follow their own published trading terms.",
            "Cooperate during investigations.",
          ]),
          p("Sellers must never release cryptocurrency based solely on screenshots, SMS messages, email notifications, verbal confirmation, or messages from third parties. Always verify payment directly through your own bank or payment provider."),
        ],
      },
      {
        heading: "Communication Rules",
        blocks: [
          p("To protect both parties, all trade-related communication should remain within the official QuataTrade trade chat. Users should avoid moving active trade discussions to:"),
          list(["Personal messaging applications.", "Social media platforms.", "Unverified communication channels."]),
          p("Messages exchanged outside the Platform may not be considered during dispute investigations."),
        ],
      },
      {
        heading: "Payment Confirmation Rules",
        blocks: [
          p(
            "Buyers must only click Payment Sent after the payment has been successfully completed. Submitting false payment confirmations, altered receipts, or misleading payment evidence is considered fraud and may result in immediate account suspension or permanent termination.",
          ),
        ],
      },
      {
        heading: "Trade Cancellation",
        blocks: [
          p(
            "A trade may generally be cancelled before payment has been marked as completed, subject to Platform rules. Once payment has been marked as sent or a dispute has been opened, cancellation may no longer be available unless permitted by Platform policies or approved during dispute resolution.",
          ),
        ],
      },
      {
        heading: "Dispute Rules",
        blocks: [
          p("If a disagreement occurs during a trade, either party may open a dispute within the time allowed by the Platform. During a dispute, users should:"),
          list([
            "Remain respectful.",
            "Respond promptly to requests for information.",
            "Submit truthful and complete evidence.",
            "Avoid altering or deleting relevant information.",
          ]),
          p("QuataTrade administrators will review the available evidence and make a decision based on Platform policies and the information presented."),
        ],
      },
      {
        heading: "Fraud Prevention Rules",
        blocks: [
          p("The following actions are strictly prohibited:"),
          list([
            "Fake payment confirmations.",
            "Forged documents.",
            "Identity theft.",
            "Payment reversal fraud.",
            "Money laundering.",
            "Market manipulation.",
            "Multiple accounts used to evade restrictions.",
            "Attempts to bypass escrow.",
            "Attempts to deceive other users.",
            "Any other fraudulent or unlawful conduct.",
          ]),
          p("QuataTrade actively monitors trading activity and may investigate suspicious behaviour at any time."),
        ],
      },
      {
        heading: "Prohibited Trading Practices",
        blocks: [
          p("Users must not:"),
          list([
            "Advertise prices they do not intend to honour.",
            "Delay trades unnecessarily.",
            "Harass or threaten other users.",
            "Encourage off-platform trading.",
            "Use accounts belonging to another person without authorization.",
            "Interfere with Platform operations.",
            "Abuse the dispute system.",
            "Circumvent Platform security controls.",
          ]),
          p("Violations may result in disciplinary action."),
        ],
      },
      {
        heading: "Reputation & User Conduct",
        blocks: [
          p("QuataTrade encourages professional and respectful conduct. Users should:"),
          list([
            "Treat others respectfully.",
            "Honour agreed trading terms.",
            "Respond promptly during active trades.",
            "Maintain accurate advertisements.",
            "Conduct business honestly.",
          ]),
          p("Positive conduct contributes to a trusted marketplace for everyone."),
        ],
      },
      {
        heading: "Administrative Actions",
        blocks: [
          p("To protect users and the Platform, QuataTrade may:"),
          list([
            "Issue warnings.",
            "Remove advertisements.",
            "Restrict trading privileges.",
            "Suspend accounts.",
            "Require additional verification.",
            "Delay transactions for compliance reviews.",
            "Permanently terminate accounts for serious or repeated violations.",
          ]),
          p("Administrative decisions are made based on available evidence, Platform policies, and applicable legal obligations."),
        ],
      },
      {
        heading: "Violations & Penalties",
        blocks: [
          p("Failure to comply with these Trading Rules may result in:"),
          list([
            "Educational warnings.",
            "Temporary restrictions.",
            "Advertisement removal.",
            "Trading suspension.",
            "Permanent account closure.",
            "Reporting to competent authorities where required by law.",
          ]),
          p("The severity of the action taken will depend on the nature, frequency, and seriousness of the violation."),
        ],
      },
      {
        heading: "Changes to These Trading Rules",
        blocks: [
          p(
            "QuataTrade may update these Trading Rules from time to time to reflect changes in Platform functionality, security practices, legal requirements, or operational needs. The latest version will always be published on the Platform. Continued use of QuataTrade after updates become effective constitutes acceptance of the revised Trading Rules.",
          ),
        ],
      },
      {
        heading: "Contact Us",
        blocks: [
          p("If you have questions regarding these Trading Rules or require assistance with a trading matter, please contact:"),
          list(["Quata Digital Enterprise", "Operating Platform: QuataTrade", "Location: Bamenda, Cameroon", "Email: support@quatatrade.com"]),
        ],
      },
    ],
  },

  "prohibited-use": {
    slug: "prohibited-use",
    title: "Prohibited Use Policy",
    version: "1.0",
    lastUpdated: EFFECTIVE,
    status: "final",
    summary:
      "This Prohibited Use Policy forms part of the QuataTrade Terms of Service and applies to every user. To protect our users and the integrity of the Platform, certain activities are strictly prohibited. Any violation may result in warnings, account restrictions, suspension, permanent termination, cancellation of trades, and reporting to competent authorities where required by law.",
    sections: [
      {
        heading: "Purpose",
        blocks: [
          p("This Policy is designed to:"),
          list([
            "Protect users from fraud and abuse.",
            "Maintain a secure trading environment.",
            "Prevent financial crime.",
            "Promote fair and lawful use of the Platform.",
            "Support compliance with applicable laws and regulations.",
          ]),
        ],
      },
      {
        heading: "General Rule",
        blocks: [
          p("You may use QuataTrade only for lawful purposes and in accordance with all Platform policies."),
          p(
            "You must not use QuataTrade to facilitate, promote, or participate in any activity that is illegal, fraudulent, deceptive, harmful, or intended to undermine the security or integrity of the Platform.",
          ),
        ],
      },
      {
        heading: "Fraud and Deception",
        blocks: [
          p("You must not:"),
          list([
            "Submit fake payment confirmations.",
            "Upload altered or forged documents.",
            "Falsely claim that payment has been made.",
            "Misrepresent your identity.",
            "Impersonate another individual or organization.",
            "Provide false account information.",
            "Attempt to deceive other users or QuataTrade staff.",
          ]),
        ],
      },
      {
        heading: "Identity Abuse",
        blocks: [
          p("You must not:"),
          list([
            "Create accounts using false identities.",
            "Share your account with another person.",
            "Buy, sell, rent, or transfer QuataTrade accounts.",
            "Use another person's identity documents.",
            "Circumvent identity verification requirements.",
          ]),
          p("Each user is responsible for maintaining only the accounts permitted under Platform policies."),
        ],
      },
      {
        heading: "Multiple Account Abuse",
        blocks: [
          p("You must not create or use multiple accounts to:"),
          list([
            "Bypass restrictions.",
            "Evade suspensions.",
            "Manipulate promotions.",
            "Circumvent trading limits.",
            "Mislead other users.",
            "Interfere with Platform operations.",
          ]),
        ],
      },
      {
        heading: "Payment Abuse",
        blocks: [
          p("You must not:"),
          list([
            "Reverse or attempt to reverse legitimate payments through fraudulent means.",
            "Send payment from unauthorized accounts where prohibited.",
            "Use stolen financial accounts.",
            "Request payment outside the agreed trade without mutual consent.",
            "Ask another user to release escrow before payment has actually been received.",
          ]),
        ],
      },
      {
        heading: "Escrow Abuse",
        blocks: [
          p("You must not:"),
          list([
            "Attempt to bypass the escrow system.",
            "Encourage off-platform settlement to avoid Platform protections.",
            "Manipulate or interfere with escrow processes.",
            "Misuse disputes to gain an unfair advantage.",
          ]),
        ],
      },
      {
        heading: "Money Laundering & Financial Crime",
        blocks: [
          p("You must not use QuataTrade to:"),
          list([
            "Launder money.",
            "Finance terrorism.",
            "Evade sanctions.",
            "Conceal the origin of unlawful funds.",
            "Process proceeds of crime.",
            "Engage in tax fraud or other financial crimes.",
          ]),
          p(
            "QuataTrade reserves the right to conduct compliance reviews, request additional documentation, delay transactions, restrict accounts, or report suspicious activity where required by law.",
          ),
        ],
      },
      {
        heading: "Illegal Activities",
        blocks: [
          p("You must not use QuataTrade in connection with activities involving:"),
          list([
            "Stolen property.",
            "Human trafficking.",
            "Terrorism or terrorist organizations.",
            "Fraud schemes.",
            "Corruption or bribery.",
            "Organized crime.",
            "Child exploitation.",
            "Counterfeit goods.",
            "Intellectual property infringement.",
            "Any other unlawful activity.",
          ]),
        ],
      },
      {
        heading: "Market Manipulation",
        blocks: [
          p("Users must not engage in practices intended to manipulate the marketplace, including:"),
          list([
            "Creating misleading advertisements.",
            "Artificially influencing prices.",
            "Coordinating deceptive trading behaviour.",
            "Using multiple accounts to create false market activity.",
            "Any other conduct intended to mislead users.",
          ]),
        ],
      },
      {
        heading: "Platform Security",
        blocks: [
          p("You must not:"),
          list([
            "Attempt unauthorized access to the Platform.",
            "Circumvent security controls.",
            "Introduce malware, viruses, or malicious code.",
            "Probe, scan, or test Platform vulnerabilities without authorization.",
            "Reverse engineer, interfere with, or disrupt Platform systems.",
            "Launch denial-of-service or similar attacks.",
          ]),
        ],
      },
      {
        heading: "Abuse of Other Users",
        blocks: [
          p("You must not:"),
          list([
            "Harass, threaten, intimidate, or abuse other users.",
            "Use discriminatory or hateful language.",
            "Share another person's confidential information without authorization.",
            "Send spam or unsolicited promotional messages.",
            "Attempt to scam or manipulate other users.",
          ]),
          p("QuataTrade encourages respectful and professional communication at all times."),
        ],
      },
      {
        heading: "Abuse of Support Services",
        blocks: [
          p("You must not:"),
          list([
            "Submit knowingly false complaints.",
            "Repeatedly submit duplicate complaints without new information.",
            "Abuse, threaten, or harass QuataTrade personnel.",
            "Provide fraudulent evidence during investigations.",
          ]),
        ],
      },
      {
        heading: "Compliance Requests",
        blocks: [
          p(
            "Users must cooperate with reasonable compliance and security requests. Failure to provide requested information during identity verification, fraud investigations, or compliance reviews may result in delays, restrictions, or suspension of Platform access.",
          ),
        ],
      },
      {
        heading: "Monitoring & Enforcement",
        blocks: [
          p("To protect the Platform and its users, QuataTrade may:"),
          list([
            "Monitor Platform activity.",
            "Review trade records.",
            "Review communications conducted through the Platform.",
            "Investigate suspicious activity.",
            "Restrict or suspend accounts.",
            "Remove advertisements.",
            "Delay or reject transactions.",
            "Request additional verification.",
            "Cooperate with competent authorities where legally required.",
          ]),
        ],
      },
      {
        heading: "Consequences of Violations",
        blocks: [
          p("Depending on the seriousness of the violation, QuataTrade may take one or more of the following actions:"),
          list([
            "Educational warning.",
            "Temporary account restriction.",
            "Advertisement removal.",
            "Trading suspension.",
            "Withdrawal restriction where legally permitted.",
            "Permanent account termination.",
            "Preservation of relevant records.",
            "Reporting to law enforcement or regulatory authorities where required by law.",
          ]),
          p("The action taken will depend on the nature, severity, and frequency of the violation."),
        ],
      },
      {
        heading: "Changes to This Policy",
        blocks: [
          p(
            "QuataTrade may update this Prohibited Use Policy from time to time to reflect changes in applicable laws, regulatory requirements, Platform functionality, security practices, or operational needs. The latest version will always be published on the Platform. Continued use of QuataTrade after changes become effective constitutes acceptance of the revised Policy.",
          ),
        ],
      },
      {
        heading: "Contact Us",
        blocks: [
          p("If you have questions regarding this Prohibited Use Policy or wish to report suspected misuse of the Platform, please contact:"),
          list(["Quata Digital Enterprise", "Operating Platform: QuataTrade", "Location: Bamenda, Cameroon", "Email: support@quatatrade.com"]),
        ],
      },
    ],
  },

  cookies: {
    slug: "cookies",
    title: "Cookie Policy",
    version: "1.0",
    lastUpdated: EFFECTIVE,
    status: "final",
    summary:
      "This Cookie Policy explains how QuataTrade, a product of Quata Digital Enterprise, uses cookies and similar technologies when you visit or use the Platform. It should be read together with our Privacy Policy and Terms of Service.",
    sections: [
      {
        heading: "What Are Cookies?",
        blocks: [
          p("Cookies are small text files that are stored on your device when you visit a website or use an application."),
          p(
            "Cookies help websites remember information about your visit, improve functionality, enhance security, and provide a better user experience. In addition to cookies, QuataTrade may use similar technologies such as local storage, session storage, web beacons, and security tokens where appropriate.",
          ),
        ],
      },
      {
        heading: "Why We Use Cookies",
        blocks: [
          p("QuataTrade uses cookies and similar technologies to:"),
          list([
            "Keep the Platform secure.",
            "Authenticate users.",
            "Maintain login sessions.",
            "Protect against fraud and unauthorized access.",
            "Remember user preferences.",
            "Improve Platform performance.",
            "Analyze Platform usage.",
            "Troubleshoot technical issues.",
            "Enhance the overall user experience.",
          ]),
          p("We do not use cookies to sell your personal information."),
        ],
      },
      {
        heading: "Types of Cookies We Use",
        blocks: [
          sub("Essential Cookies"),
          p("Essential cookies are necessary for the operation of QuataTrade. These cookies help:"),
          list([
            "Maintain secure login sessions.",
            "Authenticate users.",
            "Enable Platform functionality.",
            "Protect against unauthorized access.",
            "Support account security.",
          ]),
          p("Without these cookies, certain Platform features may not function correctly."),
          sub("Security Cookies"),
          p("Security cookies help protect both users and the Platform. These cookies may be used to:"),
          list([
            "Detect suspicious activity.",
            "Prevent fraudulent login attempts.",
            "Support Multi-Factor Authentication (MFA).",
            "Identify unusual account behaviour.",
            "Protect against automated attacks.",
          ]),
          sub("Functional Cookies"),
          p("Functional cookies remember your preferences to improve your experience. Examples include:"),
          list(["Language preferences.", "Region settings.", "Display preferences.", "Notification settings.", "Accessibility preferences."]),
          sub("Performance Cookies"),
          p("Performance cookies help us understand how the Platform performs. They may collect information such as:"),
          list(["Page loading times.", "Error reports.", "Performance statistics.", "System responsiveness.", "General Platform stability."]),
          sub("Analytics Cookies"),
          p("Analytics cookies help us better understand how users interact with QuataTrade. They may collect information such as:"),
          list(["Pages visited.", "Features used.", "Navigation paths.", "Session duration.", "General usage trends."]),
        ],
      },
      {
        heading: "Third-Party Cookies",
        blocks: [
          p("Some trusted third-party service providers supporting QuataTrade may use cookies or similar technologies on our behalf. These providers may include:"),
          list([
            "Cloud infrastructure providers.",
            "Analytics providers.",
            "Security and fraud prevention services.",
            "Performance monitoring services.",
            "Customer support platforms.",
          ]),
          p("QuataTrade works only with service providers that are expected to implement appropriate security and privacy safeguards."),
        ],
      },
      {
        heading: "Cookies and Security",
        blocks: [
          p("Cookies play an important role in protecting your account. Security-related cookies may help:"),
          list([
            "Detect unauthorized access.",
            "Recognize trusted devices.",
            "Support login verification.",
            "Reduce account takeover risks.",
            "Protect against session hijacking.",
          ]),
          p("Disabling certain cookies may reduce the effectiveness of these security protections."),
        ],
      },
      {
        heading: "Managing Cookies",
        blocks: [
          p("Most web browsers allow you to:"),
          list(["View stored cookies.", "Delete cookies.", "Block cookies.", "Limit certain cookie categories.", "Configure cookie preferences."]),
          p(
            "You can manage cookies through your browser settings. Please note that disabling essential cookies may prevent certain features of QuataTrade from functioning correctly.",
          ),
        ],
      },
      {
        heading: "Mobile Applications",
        blocks: [
          p("QuataTrade mobile applications may use technologies similar to cookies, including secure local storage and device identifiers, to:"),
          list([
            "Authenticate users.",
            "Maintain secure sessions.",
            "Improve application performance.",
            "Support security features.",
            "Remember user preferences.",
          ]),
          p("These technologies operate similarly to website cookies but are adapted for mobile applications."),
        ],
      },
      {
        heading: "Updates to This Policy",
        blocks: [
          p(
            "QuataTrade may update this Cookie Policy from time to time to reflect changes in technology, legal requirements, Platform functionality, or operational practices. The latest version will always be published on the Platform. Continued use of QuataTrade after changes become effective constitutes acceptance of the updated Cookie Policy.",
          ),
        ],
      },
      {
        heading: "Contact Us",
        blocks: [
          p("If you have questions regarding this Cookie Policy or our use of cookies and similar technologies, please contact:"),
          list(["Quata Digital Enterprise", "Operating Platform: QuataTrade", "Location: Bamenda, Cameroon", "Email: support@quatatrade.com"]),
        ],
      },
    ],
  },

  imprint: {
    slug: "imprint",
    title: "Legal Notice / Imprint",
    version: "1.0",
    lastUpdated: EFFECTIVE,
    status: "final",
    summary: "Company identity and contact details for QuataTrade, a product of Quata Digital Enterprise.",
    sections: [
      {
        heading: "Operator",
        blocks: [
          p("QuataTrade is owned and operated by Quata Digital Enterprise."),
          list([
            "Legal name: Quata Digital Enterprise",
            "Registration (RCCM): RC/BDA/2025A/189",
            "Registered location: Bamenda, North West Region, Cameroon",
            "Operating platform: QuataTrade",
            "General enquiries: info@quatatrade.com",
            "Support: support@quatatrade.com",
          ]),
        ],
      },
      {
        heading: "Part of the Quata Digital ecosystem",
        blocks: [
          p(
            "QuataTrade is a product of Quata Digital Enterprise, the company behind Africa’s connected digital ecosystem (QuataPay and its sister products). QuataTrade™ and the QuataTrade logo are trademarks of Quata Digital Enterprise.",
          ),
          p("Company website: https://quatadigital.com"),
        ],
      },
    ],
  },

  refunds: {
    slug: "refunds",
    title: "Refund & Cancellation Policy",
    version: "1.0",
    lastUpdated: EFFECTIVE,
    status: "final",
    summary:
      "What happens to escrow and to platform fees when a trade is cancelled, expires, or is disputed, and when a fee refund may be considered.",
    sections: [
      {
        heading: "Cancellation & Expiry",
        blocks: [
          p(
            "A trade may generally be cancelled before payment has been marked as completed, subject to Platform rules. If a trade is cancelled before confirmation, or the payment timer expires without a submitted payment and no dispute has been opened, the escrowed cryptocurrency returns to the seller. No trading fee is charged on cancelled or expired trades.",
          ),
        ],
      },
      {
        heading: "Disputes",
        blocks: [
          p(
            "In a dispute, escrow is frozen and funds move only by an admin decision — either released to the buyer or refunded to the seller, based on the available evidence and applicable Platform policies. See the Trading Rules for the full dispute process.",
          ),
        ],
      },
      {
        heading: "Platform Fees",
        blocks: [
          p("Platform fees that have already been charged are generally non-refundable. However, QuataTrade may review refund requests in exceptional circumstances, including:"),
          list([
            "Duplicate platform charges caused by a verified technical error.",
            "Incorrect fee calculations resulting from a system malfunction.",
            "Other situations where QuataTrade determines that a refund is appropriate.",
          ]),
          p("Refund decisions are made on a case-by-case basis."),
        ],
      },
      {
        heading: "Network & Third-Party Fees",
        blocks: [
          p(
            "Blockchain (TRON) network fees paid to move crypto on-chain are non-refundable, as they are paid to the network and not to QuataTrade. Fees charged by banks, Mobile Money operators, or other third-party providers are likewise determined by those providers and are not refundable by QuataTrade.",
          ),
        ],
      },
      {
        heading: "Contact Us",
        blocks: [
          p("To request a fee review, contact our Support Team with your trade or transaction reference:"),
          list(["Quata Digital Enterprise", "Operating Platform: QuataTrade", "Location: Bamenda, Cameroon", "Email: support@quatatrade.com"]),
        ],
      },
    ],
  },

  complaints: {
    slug: "complaints",
    title: "Complaints Policy",
    version: "1.0",
    lastUpdated: EFFECTIVE,
    status: "final",
    summary:
      "At QuataTrade, we are committed to a secure, transparent, and fair trading environment. This Complaints Policy explains how complaints can be submitted, how they are investigated, and how we work to resolve them fairly, consistently, and efficiently.",
    sections: [
      {
        heading: "Purpose",
        blocks: [
          p("The purpose of this Policy is to:"),
          list([
            "Provide a clear process for submitting complaints.",
            "Ensure complaints are handled fairly and consistently.",
            "Improve the quality of our services through user feedback.",
            "Promote transparency and accountability.",
            "Resolve issues as quickly and effectively as possible.",
          ]),
        ],
      },
      {
        heading: "Who Can Submit a Complaint?",
        blocks: [
          p("A complaint may be submitted by:"),
          list([
            "Registered QuataTrade users.",
            "Individuals directly affected by a QuataTrade service.",
            "Authorized representatives acting on behalf of a user where permitted by applicable law.",
          ]),
          p(
            "Anonymous complaints may be reviewed where sufficient information is provided, although this may limit our ability to investigate or respond.",
          ),
        ],
      },
      {
        heading: "What Is a Complaint?",
        blocks: [
          p(
            "A complaint is any expression of dissatisfaction relating to QuataTrade’s products, services, staff, systems, or policies that requires investigation or a formal response.",
          ),
          p(
            "Submitting a complaint is different from opening a trade dispute. Trade disputes are handled through the Platform’s dispute resolution process, while broader concerns about our services are handled under this Complaints Policy.",
          ),
        ],
      },
      {
        heading: "Types of Complaints We Handle",
        blocks: [
          p("QuataTrade may investigate complaints relating to:"),
          list([
            "Account registration.",
            "Identity verification (KYC).",
            "Account restrictions or suspension.",
            "Platform errors.",
            "Wallet services.",
            "USDT deposits.",
            "USDT withdrawals.",
            "Escrow services.",
            "Peer-to-peer trading.",
            "Fraud or suspicious activity.",
            "Customer support.",
            "Security concerns.",
            "Privacy-related matters.",
            "Technical issues.",
            "Platform availability.",
            "Service quality.",
            "Employee or representative conduct.",
            "Any other matter relating to QuataTrade services.",
          ]),
        ],
      },
      {
        heading: "How to Submit a Complaint",
        blocks: [
          p("Complaints may be submitted by contacting our Support Team at support@quatatrade.com."),
          p("When submitting a complaint, please include as much information as possible to help us investigate efficiently."),
        ],
      },
      {
        heading: "Information to Include",
        blocks: [
          p("Where applicable, please provide:"),
          list([
            "Your full name.",
            "Registered email address.",
            "Trade ID.",
            "Transaction ID or blockchain transaction hash.",
            "Date and time of the incident.",
            "Description of the issue.",
            "Screenshots or supporting evidence.",
            "Copies of relevant communications.",
            "Any other information that may assist our investigation.",
          ]),
          p("Incomplete information may delay the review process."),
        ],
      },
      {
        heading: "Complaint Handling Process",
        blocks: [
          p("Every complaint follows a structured review process."),
          sub("Step 1 – Complaint Received"),
          p("We receive and record your complaint."),
          sub("Step 2 – Acknowledgement"),
          p("We aim to acknowledge receipt of your complaint within 24 hours."),
          sub("Step 3 – Initial Review"),
          p("Our team conducts an initial assessment to determine:"),
          list(["The nature of the complaint.", "Information required.", "Appropriate department.", "Investigation priority."]),
          p("This review is normally completed within 2 business days."),
          sub("Step 4 – Investigation"),
          p("Depending on the complaint, we may review:"),
          list([
            "Account activity.",
            "Trade records.",
            "Chat history.",
            "Blockchain transactions.",
            "Payment evidence.",
            "Security logs.",
            "Audit records.",
            "Internal system logs.",
            "Communications with Support.",
          ]),
          p("Additional information may be requested where necessary."),
          sub("Step 5 – Resolution"),
          p("Following the investigation, we will communicate our findings and explain any actions taken. Possible outcomes include:"),
          list([
            "Complaint upheld.",
            "Complaint partially upheld.",
            "Complaint not upheld.",
            "Additional investigation required.",
            "Referral to another department where appropriate.",
          ]),
        ],
      },
      {
        heading: "Resolution Time",
        blocks: [
          p("QuataTrade aims to resolve most complaints within 7 business days."),
          p(
            "More complex matters involving fraud investigations, compliance reviews, legal issues, or external third parties may require additional time.",
          ),
          p(
            "Where an investigation cannot be completed within the expected timeframe, we will provide progress updates whenever reasonably possible.",
          ),
        ],
      },
      {
        heading: "Escalation",
        blocks: [
          p(
            "If you believe your complaint has not been resolved appropriately, you may request that it be reviewed by a senior member of the relevant team.",
          ),
          p(
            "Escalated complaints will receive an independent review based on the available information and applicable Platform policies.",
          ),
        ],
      },
      {
        heading: "Fair and Impartial Review",
        blocks: [
          p("Every complaint is reviewed on its own merits. QuataTrade aims to:"),
          list([
            "Consider all relevant evidence.",
            "Apply Platform policies consistently.",
            "Treat all users fairly and respectfully.",
            "Avoid conflicts of interest during investigations.",
          ]),
        ],
      },
      {
        heading: "Abuse of the Complaints Process",
        blocks: [
          p("Users must not misuse the complaints process. Examples of abuse include:"),
          list([
            "Knowingly submitting false information.",
            "Repeatedly filing the same complaint without new evidence.",
            "Harassing employees or other users.",
            "Attempting to manipulate investigations.",
            "Submitting fraudulent documentation.",
          ]),
          p("Abuse of the complaints process may result in restrictions or other action under the Terms of Service."),
        ],
      },
      {
        heading: "Record Keeping",
        blocks: [
          p("QuataTrade maintains records of complaints to:"),
          list([
            "Improve customer service.",
            "Monitor recurring issues.",
            "Support internal quality assurance.",
            "Meet legal and regulatory obligations.",
            "Assist with future investigations where appropriate.",
          ]),
          p("Complaint records are handled in accordance with our Privacy Policy and applicable laws."),
        ],
      },
      {
        heading: "Changes to This Policy",
        blocks: [
          p(
            "QuataTrade may update this Complaints Policy from time to time to reflect changes in our services, legal requirements, or operational practices.",
          ),
          p(
            "The latest version will always be published on the Platform, and continued use of QuataTrade after changes take effect constitutes acceptance of the updated Policy.",
          ),
        ],
      },
      {
        heading: "Contact Us",
        blocks: [
          p(
            "If you have a complaint or wish to provide feedback, please contact our Support Team at support@quatatrade.com. We value your feedback and are committed to handling every complaint fairly and promptly.",
          ),
        ],
      },
    ],
  },
};

export const LEGAL_SLUGS = Object.keys(LEGAL_DOCS);
