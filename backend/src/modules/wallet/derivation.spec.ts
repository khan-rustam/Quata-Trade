import { describe, expect, it } from "vitest";
import * as bip39 from "bip39";
import * as ecc from "@bitcoinerlab/secp256k1";
import { BIP32Factory } from "bip32";
import { TronWeb } from "tronweb";
import { deriveTronAddress, DerivationError, TRON_ACCOUNT_PATH } from "./derivation";

const bip32 = BIP32Factory(ecc);

/** Simulate the offline ceremony: mnemonic → account node → export xpub only. */
function accountFromMnemonic(mnemonic: string) {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  return bip32.fromSeed(seed).derivePath(TRON_ACCOUNT_PATH);
}

describe("deriveTronAddress (watch-only xpub derivation)", () => {
  // Known vector, generated in-test: the SAME mnemonic run through tronweb's own
  // independent BIP44 implementation (ethers HDNode under the hood) must yield
  // the SAME address as our xpub-only derivation for every index checked.
  it("matches tronweb's full-mnemonic derivation at m/44'/195'/0'/0/N", () => {
    const mnemonic = bip39.generateMnemonic();
    const xpub = accountFromMnemonic(mnemonic).neutered().toBase58();

    for (const index of [0, 1, 2, 19]) {
      const expected = TronWeb.fromMnemonic(mnemonic, `${TRON_ACCOUNT_PATH}/0/${index}`);
      const derived = deriveTronAddress(xpub, index);
      expect(derived.address).toBe(expected.address);
      expect(derived.derivationPath).toBe(`${TRON_ACCOUNT_PATH}/0/${index}`);
      expect(derived.derivationIndex).toBe(index);
    }
  });

  it("produces valid TRON base58check addresses", () => {
    const xpub = accountFromMnemonic(bip39.generateMnemonic()).neutered().toBase58();
    const { address } = deriveTronAddress(xpub, 0);
    expect(TronWeb.isAddress(address)).toBe(true);
    expect(address.startsWith("T")).toBe(true);
    expect(address).toHaveLength(34);
  });

  it("is deterministic: same xpub + index → same address", () => {
    const xpub = accountFromMnemonic(bip39.generateMnemonic()).neutered().toBase58();
    expect(deriveTronAddress(xpub, 7).address).toBe(deriveTronAddress(xpub, 7).address);
  });

  it("different indexes → different addresses (no collisions across 25 indexes)", () => {
    const xpub = accountFromMnemonic(bip39.generateMnemonic()).neutered().toBase58();
    const addresses = new Set<string>();
    for (let i = 0; i < 25; i += 1) {
      addresses.add(deriveTronAddress(xpub, i).address);
    }
    expect(addresses.size).toBe(25);
  });

  it("REFUSES an extended private key (watch-only invariant)", () => {
    const xprv = accountFromMnemonic(bip39.generateMnemonic()).toBase58(); // private!
    expect(() => deriveTronAddress(xprv, 0)).toThrow(DerivationError);
    expect(() => deriveTronAddress(xprv, 0)).toThrow(/watch-only/);
  });

  it("rejects malformed xpub without echoing it", () => {
    try {
      deriveTronAddress("xpub-not-really", 0);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(DerivationError);
      expect((err as Error).message).not.toContain("xpub-not-really");
    }
  });

  it("rejects empty xpub and invalid indexes", () => {
    const xpub = accountFromMnemonic(bip39.generateMnemonic()).neutered().toBase58();
    expect(() => deriveTronAddress("", 0)).toThrow(DerivationError);
    expect(() => deriveTronAddress(xpub, -1)).toThrow(DerivationError);
    expect(() => deriveTronAddress(xpub, 1.5)).toThrow(DerivationError);
    expect(() => deriveTronAddress(xpub, 0x80000000)).toThrow(DerivationError);
  });
});
