import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as bip39 from "bip39";
import * as ecc from "@bitcoinerlab/secp256k1";
import { BIP32Factory } from "bip32";
import { startTestDb, type TestDb } from "../../../test/helpers/pg";
import { createUser, createAdmin } from "../../../test/helpers/fixtures";
import { LedgerService } from "../ledger/ledger.service";
import { AuditService } from "../../common/audit/audit.service";
import { AlertsService } from "../../common/alerts/alerts.service";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env";
import { TRON_ACCOUNT_PATH } from "./derivation";
import { WalletConfigService } from "./wallet-config.service";
import { WalletService } from "./wallet.service";
import { WalletConfigInvalidXpubError, WalletConfigRotationBlockedError } from "./wallet.errors";
import type { ActivateWalletConfigRequest } from "@quatatrade/shared";

const bip32 = BIP32Factory(ecc);

/** Offline key ceremony → account-level neutered xpub (the ONLY thing we store). */
function newXpub(): string {
  const seed = bip39.mnemonicToSeedSync(bip39.generateMnemonic());
  return bip32.fromSeed(seed).derivePath(TRON_ACCOUNT_PATH).neutered().toBase58();
}

/** The matching xprv — must be REFUSED (private material). */
function newXprv(): string {
  const seed = bip39.mnemonicToSeedSync(bip39.generateMnemonic());
  return bip32.fromSeed(seed).derivePath(TRON_ACCOUNT_PATH).toBase58();
}

const ENV_XPUB = newXpub();

const activateDto = (xpub: string, extra: Partial<ActivateWalletConfigRequest> = {}): ActivateWalletConfigRequest => ({
  network: "tron",
  xpub,
  reason: "key ceremony test",
  ...extra,
});

describe("WalletConfigService (Documents/10 D29 — admin wallet config / key ceremony)", () => {
  let t: TestDb;
  let audit: AuditService;
  let svc: WalletConfigService;
  let adminId: string;

  beforeAll(async () => {
    t = await startTestDb();
    audit = new AuditService(t.db);
    // No webhook/email/telegram configured: alerts are inert here, so the
    // rotation alert cannot make these DB assertions depend on the network.
    const alerts = new AlertsService(
      new ConfigService<Env, true>({
        ALERT_WEBHOOK_URL: "",
        ALERT_EMAIL_TO: "",
        TELEGRAM_BOT_TOKEN: "",
        TELEGRAM_CHAT_ID: "",
      }),
    );
    svc = new WalletConfigService(t.db, ENV_XPUB, audit, alerts);
    adminId = await createAdmin(t.db, "SUPER_ADMIN");
  });

  afterAll(async () => {
    await t.stop();
  });

  beforeEach(async () => {
    // Clean slate per test (no active config, no derived addresses).
    await t.db.deleteFrom("wallet_configs").execute();
    await t.db.deleteFrom("deposit_addresses").execute();
  });

  it("falls back to the env xpub when no config is active", async () => {
    expect(await svc.getActiveXpub()).toBe(ENV_XPUB);
    const view = await svc.view();
    expect(view.usingEnvFallback).toBe(true);
    expect(view.activeXpub).toBeNull();
    expect(view.configs).toHaveLength(0);
  });

  it("activates a production xpub (public only) and derivation switches to it", async () => {
    const prod = newXpub();
    const view = await svc.activate(adminId, activateDto(prod, { label: "Trezor Safe 3" }));

    expect(view.usingEnvFallback).toBe(false);
    expect(view.activeXpub).toBe(prod);
    expect(view.configs).toHaveLength(1);
    expect(view.configs[0]?.active).toBe(true);
    expect(view.configs[0]?.derivationPath).toBe(TRON_ACCOUNT_PATH);
    expect(view.configs[0]?.sampleAddress).toMatch(/^T/); // valid TRON base58
    expect(view.configs[0]?.activatedBy).toBe(adminId);

    expect(await svc.getActiveXpub()).toBe(prod);
  });

  it("REFUSES an extended private key (xprv) — never stores private material", async () => {
    await expect(svc.activate(adminId, activateDto(newXprv()))).rejects.toBeInstanceOf(WalletConfigInvalidXpubError);
    await expect(svc.activate(adminId, activateDto("not-a-key"))).rejects.toBeInstanceOf(WalletConfigInvalidXpubError);
    expect(await t.db.selectFrom("wallet_configs").selectAll().execute()).toHaveLength(0);
  });

  it("writes an audit entry for every activation", async () => {
    const prod = newXpub();
    await svc.activate(adminId, activateDto(prod, { reason: "launch swap" }));
    const rows = await t.db
      .selectFrom("audit_logs")
      .selectAll()
      .where("action", "=", "wallet.config_activate")
      .execute();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.actor_id).toBe(adminId);
  });

  it("is idempotent: re-activating the SAME xpub does not create a second row", async () => {
    const prod = newXpub();
    await svc.activate(adminId, activateDto(prod));
    const view = await svc.activate(adminId, activateDto(prod, { reason: "again" }));
    expect(view.configs).toHaveLength(1);
  });

  it("keeps exactly one active row across a rotation (old deactivated)", async () => {
    const a = newXpub();
    const b = newXpub();
    await svc.activate(adminId, activateDto(a));
    const view = await svc.activate(adminId, activateDto(b, { reason: "rotate" }));

    expect(view.activeXpub).toBe(b);
    expect(view.configs).toHaveLength(2);
    expect(view.configs.filter((c) => c.active)).toHaveLength(1);
    expect(view.configs.find((c) => c.active)?.xpub).toBe(b);
  });

  describe("rotation guard (custody continuity)", () => {
    it("BLOCKS rotation once deposit addresses were derived, without acknowledgeReset", async () => {
      const a = newXpub();
      await svc.activate(adminId, activateDto(a));

      // Derive an address from the active key.
      const wallet = new WalletService(t.db, new LedgerService(t.db), ENV_XPUB, undefined, svc);
      const userId = await createUser(t.db);
      await wallet.getOrCreateDepositAddress(userId, "USDT_TRC20");

      await expect(svc.activate(adminId, activateDto(newXpub(), { reason: "rotate" }))).rejects.toBeInstanceOf(
        WalletConfigRotationBlockedError,
      );
      expect(await svc.getActiveXpub()).toBe(a); // unchanged
    });

    it("ALLOWS rotation with an explicit acknowledgeReset (audited)", async () => {
      const a = newXpub();
      const b = newXpub();
      await svc.activate(adminId, activateDto(a));

      const wallet = new WalletService(t.db, new LedgerService(t.db), ENV_XPUB, undefined, svc);
      await wallet.getOrCreateDepositAddress(await createUser(t.db), "USDT_TRC20");

      const view = await svc.activate(adminId, activateDto(b, { reason: "rotate", acknowledgeReset: true }));
      expect(view.activeXpub).toBe(b);
    });
  });

  it("WalletService derives new addresses from the DB-active xpub", async () => {
    const prod = newXpub();
    await svc.activate(adminId, activateDto(prod));

    const wallet = new WalletService(t.db, new LedgerService(t.db), ENV_XPUB, undefined, svc);
    const addr = await wallet.getOrCreateDepositAddress(await createUser(t.db), "USDT_TRC20");

    // The address must equal what the PROD xpub derives at index 0 (env would differ).
    const { deriveTronAddress } = await import("./derivation");
    expect(addr.address).toBe(deriveTronAddress(prod, 0).address);
    expect(addr.address).not.toBe(deriveTronAddress(ENV_XPUB, 0).address);
  });
});
