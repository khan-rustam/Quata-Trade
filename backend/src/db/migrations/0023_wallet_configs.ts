import { sql, type Kysely } from "kysely";

/**
 * Admin-configurable production wallet — key-ceremony support (Documents/10 D29).
 *
 * Stores the ACCOUNT-LEVEL extended PUBLIC key (xpub, m/44'/195'/0') only. The
 * backend NEVER stores or accepts a seed / master / private key — the service
 * that writes here validates the value through the watch-only derivation, which
 * rejects any xprv. The `xpub NOT LIKE 'xprv%'` CHECK is a defence-in-depth
 * backstop; the real guarantee is the isNeutered() check in derivation.ts.
 *
 * At most one row per network is active (partial unique index). WalletService
 * derives deposit addresses from the active row, falling back to the env
 * WALLET_XPUB when no row is active (dev). The one-time launch "replace the dev
 * wallet" step activates the Trezor Safe 3 production xpub here.
 *
 * NOTE: new tables need an explicit app-role grant (0006 granted only the
 * tables existing then; there is no ALTER DEFAULT PRIVILEGES for quatatrade_app).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE wallet_configs (
      id uuid PRIMARY KEY,
      network text NOT NULL,
      xpub text NOT NULL CHECK (xpub NOT LIKE 'xprv%' AND xpub NOT LIKE 'tprv%'),
      derivation_path text NOT NULL,
      label text,
      source text NOT NULL DEFAULT 'ceremony',
      active boolean NOT NULL DEFAULT true,
      activated_by uuid REFERENCES admins(id),
      created_at timestamptz NOT NULL DEFAULT now()
    )`.execute(db);
  // At most one ACTIVE config per network — the last-line backstop for rotation.
  await sql`CREATE UNIQUE INDEX wallet_configs_active_idx ON wallet_configs (network) WHERE active`.execute(db);
  await sql`GRANT SELECT, INSERT, UPDATE ON wallet_configs TO quatatrade_app`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS wallet_configs`.execute(db);
}
