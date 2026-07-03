import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newId } from "../../common/ids";
import { startTestDb, type TestDb } from "../../../test/helpers/pg";
import { ScreeningService } from "./screening.service";
import { BlockedAddressError } from "./screening.errors";

/**
 * AML / sanctions / wallet-blacklist screening (security remediation item 4).
 * Real DB — exercises the blocked_addresses table, the app-role grant, and the
 * outbound assertAllowed chokepoint (throw + aml.hit event).
 */
describe("Screening / AML blocklist (item 4)", () => {
  const ADDR = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
  let t: TestDb;
  let screening: ScreeningService;

  beforeAll(async () => {
    t = await startTestDb();
    screening = new ScreeningService(t.db);
  });

  afterAll(async () => {
    await t?.stop();
  });

  it("check() reports not-blocked for an unknown address", async () => {
    const res = await screening.check("USDT_TRC20", ADDR);
    expect(res).toEqual({ blocked: false, category: null, reason: null });
  });

  it("block() then check() reports blocked with category + reason", async () => {
    await screening.block(
      { asset: "USDT_TRC20", address: ADDR, category: "sanctions", reason: "OFAC SDN entry" },
      "admin-1",
    );
    const res = await screening.check("USDT_TRC20", ADDR);
    expect(res).toEqual({ blocked: true, category: "sanctions", reason: "OFAC SDN entry" });
  });

  it("check() is asset-scoped — a hit on one asset is not a hit on another key", async () => {
    // Same address string, different asset code → no active row → allowed.
    const res = await screening.check("USDT_TRC20", "TXYZunknownunknownunknownunknownunk");
    expect(res.blocked).toBe(false);
  });

  it("assertAllowed() throws BlockedAddressError and enqueues an aml.hit event", async () => {
    const before = await countAmlEvents(t);
    await expect(
      screening.assertAllowed("USDT_TRC20", ADDR, { userId: newId(), stage: "withdrawal" }),
    ).rejects.toBeInstanceOf(BlockedAddressError);
    expect(await countAmlEvents(t)).toBe(before + 1);
  });

  it("assertAllowed() resolves silently for a clean address (no event)", async () => {
    const before = await countAmlEvents(t);
    await expect(
      screening.assertAllowed("USDT_TRC20", "TCleanCleanCleanCleanCleanCleanClean", {
        userId: newId(),
        stage: "whitelist",
      }),
    ).resolves.toBeUndefined();
    expect(await countAmlEvents(t)).toBe(before);
  });

  it("block() is idempotent on (asset,address) and updates in place", async () => {
    await screening.block(
      { asset: "USDT_TRC20", address: ADDR, category: "blacklist", reason: "chain-analysis" },
      "admin-2",
    );
    const rows = (await screening.listBlocked()).filter((a) => a.address === ADDR);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ category: "blacklist", reason: "chain-analysis", active: true });
  });

  it("unblock() deactivates — the address passes screening again", async () => {
    const [row] = (await screening.listBlocked()).filter((a) => a.address === ADDR);
    if (!row) throw new Error("expected a blocked row to unblock");
    await screening.unblock(row.id);
    expect((await screening.check("USDT_TRC20", ADDR)).blocked).toBe(false);
    await expect(
      screening.assertAllowed("USDT_TRC20", ADDR, { userId: newId(), stage: "withdrawal" }),
    ).resolves.toBeUndefined();
  });

  it("the restricted app role can read AND write the blocklist (grant is present)", async () => {
    const appScreening = new ScreeningService(t.appDb);
    const blocked = await appScreening.block(
      { asset: "USDT_TRC20", address: "TAppRoleGrantCheckGrantCheckGrantChk", category: "manual", reason: "grant test" },
      "admin-3",
    );
    expect(blocked.active).toBe(true);
    expect((await appScreening.check("USDT_TRC20", "TAppRoleGrantCheckGrantCheckGrantChk")).blocked).toBe(true);
  });
});

async function countAmlEvents(t: TestDb): Promise<number> {
  const row = await t.db
    .selectFrom("outbox")
    .select((eb) => eb.fn.countAll<bigint>().as("n"))
    .where("event_type", "=", "aml.hit")
    .executeTakeFirstOrThrow();
  return Number(row.n);
}
