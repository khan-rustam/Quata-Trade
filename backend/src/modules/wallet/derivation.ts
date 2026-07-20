import { createHash } from "node:crypto";
import * as ecc from "@bitcoinerlab/secp256k1";
import { BIP32Factory, type BIP32Interface } from "bip32";
import { TronWeb, utils as tronUtils } from "tronweb";

/**
 * Watch-only TRON address derivation (Documents/06 "wallet", 08 §D).
 *
 * WALLET_XPUB is an ACCOUNT-LEVEL extended PUBLIC key (already at
 * m/44'/195'/0'). We derive the non-hardened relative path 0/N below it, so
 * the full path of index N is m/44'/195'/0'/0/N. No private key material can
 * exist here — an xprv is rejected outright.
 *
 * Address construction (TRON convention): keccak256(uncompressed pubkey minus
 * the 0x04 prefix byte) → last 20 bytes → prefix 0x41 → base58check.
 * tronweb's own utils perform those steps; the result is re-validated with
 * TronWeb.isAddress before it is ever handed out.
 */

const bip32 = BIP32Factory(ecc);

/** BIP44 account-level path the configured xpub must correspond to. */
export const TRON_ACCOUNT_PATH = "m/44'/195'/0'";

/**
 * Short, non-reversible identifier for an extended public key: the first 8
 * bytes of SHA-256, hex. Lets logs, audit rows and ops output say WHICH key is
 * in use, and prove two keys match, without reproducing the key itself (an
 * xpub cannot spend, but it derives every user's deposit address).
 *
 * Reproduce out-of-band with: printf '%s' "$XPUB" | sha256sum | cut -c1-16
 */
export function xpubFingerprint(xpub: string): string {
  return createHash("sha256").update(xpub).digest("hex").slice(0, 16);
}

/** Non-hardened derivation limit (BIP32: indexes >= 2^31 are hardened). */
const MAX_NON_HARDENED_INDEX = 0x80000000;

export class DerivationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export interface DerivedAddress {
  address: string;
  derivationIndex: number;
  /** Full absolute path, e.g. m/44'/195'/0'/0/7 */
  derivationPath: string;
}

/** Derive the TRON deposit address for derivation index N from the account xpub. */
export function deriveTronAddress(xpub: string, index: number): DerivedAddress {
  if (xpub.length === 0) {
    throw new DerivationError("wallet xpub is not configured");
  }
  if (!Number.isInteger(index) || index < 0 || index >= MAX_NON_HARDENED_INDEX) {
    throw new DerivationError(`invalid derivation index: ${index}`);
  }

  let account: BIP32Interface;
  try {
    account = bip32.fromBase58(xpub);
  } catch {
    // deliberately no detail — never echo key material into logs/errors
    throw new DerivationError("malformed extended public key");
  }
  if (!account.isNeutered()) {
    // Golden invariant (08 §D): the API/worker never hold spending keys.
    throw new DerivationError("extended PRIVATE key detected — refusing (watch-only wallet)");
  }

  const child = account.derive(0).derive(index);
  const uncompressed = ecc.pointCompress(child.publicKey, false); // 65 bytes, 0x04-prefixed
  const addressBytes = tronUtils.crypto.computeAddress(uncompressed);
  const address = tronUtils.crypto.getBase58CheckAddress(addressBytes);

  if (!TronWeb.isAddress(address)) {
    throw new DerivationError("derived address failed TRON validation");
  }
  return { address, derivationIndex: index, derivationPath: `${TRON_ACCOUNT_PATH}/0/${index}` };
}
