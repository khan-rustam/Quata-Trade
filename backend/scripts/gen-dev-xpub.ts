/**
 * DEV / TESTNET ONLY — generate a throwaway watch-only TRON account xpub so the
 * local deposit flow works without the production key ceremony.
 *
 * Prints ONLY the extended PUBLIC key (xpub) — which is watch-only and safe. The
 * BIP39 mnemonic is created in memory and DISCARDED: it is never printed, saved,
 * or logged (CLAUDE.md: no mnemonics in env/logs/any context).
 *
 * ⚠️ NOT FOR PRODUCTION. Production `WALLET_XPUB` comes from the offline,
 * client-held key ceremony in backend/SIGNER.md. This script is key-adjacent —
 * flag for human review before committing.
 *
 * Usage:  npx tsx backend/scripts/gen-dev-xpub.ts
 */
import * as ecc from "@bitcoinerlab/secp256k1";
import { BIP32Factory } from "bip32";
import { generateMnemonic, mnemonicToSeedSync } from "bip39";
import { deriveTronAddress, TRON_ACCOUNT_PATH } from "../src/modules/wallet/derivation";

const bip32 = BIP32Factory(ecc);

// 12-word throwaway mnemonic — ephemeral, never leaves this process.
const seed = mnemonicToSeedSync(generateMnemonic(128));
const xpub = bip32.fromSeed(seed).derivePath(TRON_ACCOUNT_PATH).neutered().toBase58();

// Sanity: the app's own watch-only derivation must accept it and yield a valid T-address.
const sample = deriveTronAddress(xpub, 0);

// eslint-disable-next-line no-console
console.log(xpub);
// eslint-disable-next-line no-console
console.log(`# sample deposit address (index 0): ${sample.address}`);
