import { sql, type Kysely } from "kysely";

/**
 * Country-based market segmentation + phased rollout.
 *
 * A `countries` reference table holds every launch/expansion market; each row
 * carries its dial code, currency, per-country payment rails, and an `enabled`
 * flag. The backend ships all of them but switches markets on ONE AT A TIME
 * (only Cameroon enabled at launch) to phase customer-support load. `users`,
 * `offers`, and `trades` are FK-bound to a country so a user only ever sees /
 * trades their own market. Currency + rails are metadata now (consumed once a
 * non-XAF market is switched on) — nothing here touches the USDT ledger.
 *
 * The seed is the realistic African rollout set; more countries can be appended
 * by a later migration (or an admin data task) without a schema change. Only
 * `CM` is enabled and only `CM` carries live payment rails.
 */
const COUNTRIES: Array<{
  code: string;
  nameEn: string;
  nameFr: string;
  dial: string;
  currency: string;
  decimals: number;
}> = [
  { code: "CM", nameEn: "Cameroon", nameFr: "Cameroun", dial: "+237", currency: "XAF", decimals: 0 },
  { code: "NG", nameEn: "Nigeria", nameFr: "Nigéria", dial: "+234", currency: "NGN", decimals: 2 },
  { code: "GH", nameEn: "Ghana", nameFr: "Ghana", dial: "+233", currency: "GHS", decimals: 2 },
  { code: "CI", nameEn: "Côte d'Ivoire", nameFr: "Côte d'Ivoire", dial: "+225", currency: "XOF", decimals: 0 },
  { code: "SN", nameEn: "Senegal", nameFr: "Sénégal", dial: "+221", currency: "XOF", decimals: 0 },
  { code: "BJ", nameEn: "Benin", nameFr: "Bénin", dial: "+229", currency: "XOF", decimals: 0 },
  { code: "TG", nameEn: "Togo", nameFr: "Togo", dial: "+228", currency: "XOF", decimals: 0 },
  { code: "BF", nameEn: "Burkina Faso", nameFr: "Burkina Faso", dial: "+226", currency: "XOF", decimals: 0 },
  { code: "ML", nameEn: "Mali", nameFr: "Mali", dial: "+223", currency: "XOF", decimals: 0 },
  { code: "NE", nameEn: "Niger", nameFr: "Niger", dial: "+227", currency: "XOF", decimals: 0 },
  { code: "GN", nameEn: "Guinea", nameFr: "Guinée", dial: "+224", currency: "GNF", decimals: 0 },
  { code: "GA", nameEn: "Gabon", nameFr: "Gabon", dial: "+241", currency: "XAF", decimals: 0 },
  { code: "CG", nameEn: "Congo", nameFr: "Congo", dial: "+242", currency: "XAF", decimals: 0 },
  { code: "CD", nameEn: "DR Congo", nameFr: "RD Congo", dial: "+243", currency: "CDF", decimals: 2 },
  { code: "TD", nameEn: "Chad", nameFr: "Tchad", dial: "+235", currency: "XAF", decimals: 0 },
  { code: "CF", nameEn: "Central African Republic", nameFr: "République centrafricaine", dial: "+236", currency: "XAF", decimals: 0 },
  { code: "GQ", nameEn: "Equatorial Guinea", nameFr: "Guinée équatoriale", dial: "+240", currency: "XAF", decimals: 0 },
  { code: "KE", nameEn: "Kenya", nameFr: "Kenya", dial: "+254", currency: "KES", decimals: 2 },
  { code: "TZ", nameEn: "Tanzania", nameFr: "Tanzanie", dial: "+255", currency: "TZS", decimals: 2 },
  { code: "UG", nameEn: "Uganda", nameFr: "Ouganda", dial: "+256", currency: "UGX", decimals: 0 },
  { code: "RW", nameEn: "Rwanda", nameFr: "Rwanda", dial: "+250", currency: "RWF", decimals: 0 },
  { code: "ZA", nameEn: "South Africa", nameFr: "Afrique du Sud", dial: "+27", currency: "ZAR", decimals: 2 },
  { code: "ZM", nameEn: "Zambia", nameFr: "Zambie", dial: "+260", currency: "ZMW", decimals: 2 },
  { code: "ET", nameEn: "Ethiopia", nameFr: "Éthiopie", dial: "+251", currency: "ETB", decimals: 2 },
  { code: "MA", nameEn: "Morocco", nameFr: "Maroc", dial: "+212", currency: "MAD", decimals: 2 },
  { code: "EG", nameEn: "Egypt", nameFr: "Égypte", dial: "+20", currency: "EGP", decimals: 2 },
];

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE countries (
      code            char(2) PRIMARY KEY,
      name_en         text NOT NULL,
      name_fr         text NOT NULL,
      dial_code       text NOT NULL,
      currency_code   char(3) NOT NULL,
      fiat_decimals   smallint NOT NULL DEFAULT 0,
      payment_methods payment_method[] NOT NULL DEFAULT ARRAY[]::payment_method[],
      enabled         boolean NOT NULL DEFAULT false,
      sort_order      int NOT NULL DEFAULT 0,
      created_at      timestamptz NOT NULL DEFAULT now(),
      updated_at      timestamptz NOT NULL DEFAULT now()
    )`.execute(db);
  await sql`CREATE INDEX countries_enabled_idx ON countries (enabled, sort_order)`.execute(db);

  // Seed all markets disabled with no rails; parameterized so accents/apostrophes are safe.
  for (const [i, c] of COUNTRIES.entries()) {
    await sql`
      INSERT INTO countries (code, name_en, name_fr, dial_code, currency_code, fiat_decimals, enabled, sort_order)
      VALUES (${c.code}, ${c.nameEn}, ${c.nameFr}, ${c.dial}, ${c.currency}, ${c.decimals}, false, ${i})
    `.execute(db);
  }
  // Cameroon is the only live market at launch; give it its real rails.
  await sql`
    UPDATE countries
    SET enabled = true,
        payment_methods = ARRAY['QUATAPAY','MTN_MOMO','ORANGE_MONEY']::payment_method[]
    WHERE code = 'CM'`.execute(db);

  // users.country already exists (0001, DEFAULT 'CM'). The OLD sign-up schema accepted any
  // 2-letter code (only the frontend defaulted to CM), so a direct API caller could have created
  // a user with a non-seeded code. Normalize any such stray to the launch market BEFORE binding
  // the FK — otherwise one offending row aborts the whole migration and the feature can't deploy.
  // Offers/trades inherit from users below, so this single normalization keeps all three FKs valid.
  // (Deviations Log 2026-07-04; on the current empty DB this touches zero rows.)
  await sql`UPDATE users SET country = 'CM' WHERE country NOT IN (SELECT code FROM countries)`.execute(db);
  await sql`ALTER TABLE users
    ADD CONSTRAINT users_country_fk FOREIGN KEY (country) REFERENCES countries(code)`.execute(db);

  // Denormalize the market onto offers (stamped from the maker at creation). Snapshotting
  // matches how offers already carry asset/price; keeps the browse query index-served.
  await sql`ALTER TABLE offers ADD COLUMN country char(2)`.execute(db);
  await sql`UPDATE offers o SET country = u.country FROM users u WHERE u.id = o.user_id`.execute(db);
  await sql`ALTER TABLE offers ALTER COLUMN country SET NOT NULL`.execute(db);
  await sql`ALTER TABLE offers
    ADD CONSTRAINT offers_country_fk FOREIGN KEY (country) REFERENCES countries(code)`.execute(db);

  // Re-lead the browse index with country — the mandatory first filter for every market view.
  await sql`DROP INDEX IF EXISTS offers_browse_idx`.execute(db);
  await sql`CREATE INDEX offers_browse_idx ON offers (country, status, side, asset)`.execute(db);

  // Denormalize onto trades too — records the same-country invariant and partitions
  // admin metrics / disputes by market without a join through a (fixed) user.
  await sql`ALTER TABLE trades ADD COLUMN country char(2)`.execute(db);
  await sql`UPDATE trades t SET country = o.country FROM offers o WHERE o.id = t.offer_id`.execute(db);
  await sql`ALTER TABLE trades ALTER COLUMN country SET NOT NULL`.execute(db);
  await sql`ALTER TABLE trades
    ADD CONSTRAINT trades_country_fk FOREIGN KEY (country) REFERENCES countries(code)`.execute(db);

  // App role: read countries everywhere; UPDATE only for the admin enable/disable toggle.
  // (0006's blanket grant predates this table; 0007's ALTER DEFAULT only covers readonly.)
  await sql`GRANT SELECT, UPDATE ON countries TO quatatrade_app`.execute(db).catch(() => {
    /* role may not exist under some test harnesses — owner access still works */
  });
  await sql`GRANT SELECT ON countries TO quatatrade_readonly`.execute(db).catch(() => {});
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE trades DROP CONSTRAINT trades_country_fk`.execute(db);
  await sql`ALTER TABLE trades DROP COLUMN country`.execute(db);
  await sql`DROP INDEX IF EXISTS offers_browse_idx`.execute(db);
  await sql`CREATE INDEX offers_browse_idx ON offers (status, side, asset)`.execute(db);
  await sql`ALTER TABLE offers DROP CONSTRAINT offers_country_fk`.execute(db);
  await sql`ALTER TABLE offers DROP COLUMN country`.execute(db);
  await sql`ALTER TABLE users DROP CONSTRAINT users_country_fk`.execute(db);
  await sql`DROP TABLE countries`.execute(db);
}
