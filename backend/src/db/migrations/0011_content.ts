import { sql, type Kysely } from "kysely";

/**
 * Admin-managed site content (Documents/10 D26): company/contact details (a
 * `company` settings row reflected site-wide), FAQ, testimonials/reviews, and
 * contact-form enquiries (a lightweight inbox — replies happen off-platform by
 * email). FAQs are seeded with sensible defaults; reviews start empty (no
 * fabricated testimonials). App-role grants are explicit because the blanket
 * GRANT in 0006 only covered tables existing at that time.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE faqs (
      id uuid PRIMARY KEY,
      category text NOT NULL DEFAULT 'general',
      question text NOT NULL,
      answer text NOT NULL,
      sort_order int NOT NULL DEFAULT 0,
      published boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz
    )`.execute(db);
  await sql`CREATE INDEX faqs_public_idx ON faqs (published, sort_order)`.execute(db);

  await sql`
    CREATE TABLE reviews (
      id uuid PRIMARY KEY,
      author_name text NOT NULL,
      location text,
      rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
      body text NOT NULL,
      sort_order int NOT NULL DEFAULT 0,
      published boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    )`.execute(db);
  await sql`CREATE INDEX reviews_public_idx ON reviews (published, sort_order)`.execute(db);

  await sql`
    CREATE TABLE enquiries (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      email citext NOT NULL,
      subject text,
      message text NOT NULL,
      status text NOT NULL DEFAULT 'new'
        CHECK (status IN ('new','read','replied','archived')),
      created_at timestamptz NOT NULL DEFAULT now()
    )`.execute(db);
  await sql`CREATE INDEX enquiries_inbox_idx ON enquiries (status, created_at DESC)`.execute(db);

  // App role needs DML on the new tables (0006's blanket grant predates them).
  await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON faqs, reviews, enquiries TO quatatrade_app`
    .execute(db)
    .catch(() => {
      /* role may not exist under some test harnesses — owner access still works */
    });
  await sql`GRANT SELECT ON faqs, reviews, enquiries TO quatatrade_readonly`.execute(db).catch(() => {});

  // Company / contact details — one JSON settings row the admin edits; the whole
  // site (footer, contact, legal) reads it. Placeholder values to be filled in admin.
  await sql`
    INSERT INTO settings (key, value) VALUES
      ('company', ${sql.lit(
        JSON.stringify({
          name: "QuataTrade",
          legalName: "",
          tagline: "Crypto to cash. Protected.",
          email: "support@quatatrade.com",
          phone: "",
          whatsapp: "",
          addressLine: "",
          city: "Douala",
          country: "Cameroon",
          registrationNo: "",
          social: { facebook: "", x: "", instagram: "", linkedin: "", telegram: "" },
        }),
      )}::jsonb)
    ON CONFLICT (key) DO NOTHING`.execute(db);

  // Seed default FAQs (mirrors the help page; admin can edit/extend).
  const faqs: { category: string; q: string; a: string }[] = [
    {
      category: "getting-started",
      q: "What is escrow and why is it safe?",
      a: "Escrow locks the seller's crypto until they confirm your payment. Neither side can move the funds until the trade completes or a dispute is resolved — so a buyer can't take crypto without paying, and a seller can't take payment without releasing crypto.",
    },
    {
      category: "getting-started",
      q: "Which crypto and network does QuataTrade support?",
      a: "At launch, USDT on the TRON network (TRC20). Always send and withdraw using this network — other networks can cause permanent loss.",
    },
    {
      category: "trading",
      q: "How long do I have to pay for a trade?",
      a: "When you open a trade a payment timer starts. Pay the seller and submit proof before it runs out, or the trade auto-cancels and the crypto returns to the seller.",
    },
    {
      category: "trading",
      q: "The seller isn't releasing my crypto. What do I do?",
      a: "First, make sure you submitted your payment reference and details. If the seller still hasn't confirmed, open a dispute from the trade room — escrow freezes and a person reviews the evidence.",
    },
    {
      category: "payments",
      q: "How do I pay for a trade?",
      a: "Payments happen off-platform: you pay the seller directly with MTN MoMo, Orange Money, or QuataPay using the details shown in the trade room, then upload your proof of payment. QuataTrade never holds your fiat money.",
    },
    {
      category: "fees",
      q: "Are there any hidden fees?",
      a: "No. Trading fees are published on the Fees page (0.3%–0.5% per method) and shown before you open a trade. Withdrawals pay only the blockchain network fee, shown before you confirm.",
    },
    {
      category: "security",
      q: "How do I keep my account secure?",
      a: "Turn on two-factor authentication (2FA) and set a transaction PIN in your security center. Only pay from an account in your own name, and confirm money is in YOUR account before releasing a trade.",
    },
    {
      category: "verification",
      q: "Why do I need to verify my identity (KYC)?",
      a: "Verification keeps fraudsters out and unlocks higher limits. Every verification is reviewed by a person — we never auto-approve. Your documents are encrypted and access-audited.",
    },
  ];
  let order = 0;
  for (const f of faqs) {
    order += 1;
    await sql`
      INSERT INTO faqs (id, category, question, answer, sort_order)
      VALUES (${sql.raw("gen_random_uuid()")}, ${f.category}, ${f.q}, ${f.a}, ${order})`.execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DELETE FROM settings WHERE key = 'company'`.execute(db);
  await sql`DROP TABLE IF EXISTS enquiries, reviews, faqs CASCADE`.execute(db);
}
