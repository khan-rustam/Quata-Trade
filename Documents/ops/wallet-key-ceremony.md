# QuataTrade — Wallet Key Ceremony (Offline)

**For:** the key custodian (owner) · **Method:** Option 1 — offline air-gapped generation
**Outcome:** a 24-word recovery phrase you keep, and one public `WALLET_XPUB` line you send back.

---

## 1. Read this first — the one rule that matters

The wallet has two halves:

| Half | What it is | Where it may go |
|---|---|---|
| **24-word recovery phrase** (mnemonic) | **This is the money.** Anyone with it controls all funds. | **Offline only** — written on paper/metal, kept by you. **Never** typed into a website, email, chat, phone, cloud, or the server. |
| **Public key (`xpub`)** | **Watch-only.** Can only generate deposit addresses. Cannot move a single cent. | Safe to send to the developer and put on the live server. |

> ⚠️ **You will only ever send back the line that starts with `WALLET_XPUB=xpub...`**
> Never send, photograph, or type the 24 words anywhere digital. If the words ever touch an
> online device, treat that wallet as compromised and start over.

---

## 2. What standard this uses (so it's compatible now and with a Trezor later)

- **BIP39** recovery phrase — **24 words** (256-bit).
- **BIP32 / BIP44** hierarchical derivation on the **secp256k1** curve.
- **TRON**, coin type **195′**, account path **`m/44'/195'/0'`**.
- Export = the **neutered account-level `xpub`** (standard Base58, `xpub` prefix).

This is the same standard a **Trezor Safe 3** uses, so migrating to hardware later needs **no
change** to any user wallet or address.

---

## 3. Prepare the laptop (5 minutes)

1. Use a laptop you can take **fully offline**. Ideal: boot a fresh **Ubuntu Live USB** ("Try
   Ubuntu" — nothing installed to disk). A normal laptop is acceptable if you disconnect the
   internet for the whole ceremony.
2. Install **Node.js 20 or 22** *before going offline* (from <https://nodejs.org>), then:
3. **Turn off Wi‑Fi and unplug the network cable. Stay offline until step 7.**

Check Node is present (offline is fine):

```bash
node --version      # should print v20.x or v22.x
```

---

## 4. Install the wallet libraries

These are the **exact libraries the QuataTrade backend uses**, so the result is guaranteed
compatible. Run in an empty folder:

```bash
mkdir qt-ceremony && cd qt-ceremony
npm init -y
npm install tronweb@^6 bip32@^5 bip39@^3 @bitcoinerlab/secp256k1@^1
```

> If you booted from a Live USB (no prior npm cache), do the `npm install` **while still
> online**, then disconnect the network **before** step 6. The install downloads code only —
> no key is created until you run the script offline.

---

## 5. Create the ceremony script

Save this as **`generate.mjs`** inside the `qt-ceremony` folder (copy exactly):

```js
// QuataTrade offline key ceremony — run OFFLINE only.
// Prints your 24-word phrase (write on paper) and the watch-only xpub (send back).
import * as ecc from "@bitcoinerlab/secp256k1";
import { BIP32Factory } from "bip32";
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "bip39";
import { TronWeb, utils as tronUtils } from "tronweb";

const bip32 = BIP32Factory(ecc);
const ACCOUNT_PATH = "m/44'/195'/0'"; // TRON account level — must match QuataTrade

// 24-word (256-bit) BIP39 phrase. THIS IS THE MONEY. Write it on paper.
const mnemonic = generateMnemonic(256);
if (!validateMnemonic(mnemonic)) throw new Error("bad mnemonic");

const account = bip32.fromSeed(mnemonicToSeedSync(mnemonic)).derivePath(ACCOUNT_PATH);
const xpub = account.neutered().toBase58(); // watch-only — safe to send

// Self-check: derive index 0 exactly like the backend and confirm a valid TRON address.
const child = account.derive(0).derive(0);
const uncompressed = ecc.pointCompress(child.publicKey, false);
const addr = tronUtils.crypto.getBase58CheckAddress(
  tronUtils.crypto.computeAddress(uncompressed),
);
if (!TronWeb.isAddress(addr)) throw new Error("derived address invalid");
if (!xpub.startsWith("xpub")) throw new Error("unexpected xpub format");

console.log("\n================ WRITE THESE 24 WORDS ON PAPER (keep offline) ================\n");
console.log(mnemonic);
console.log("\n================ SEND BACK ONLY THIS LINE (safe, watch-only) =================\n");
console.log("WALLET_XPUB=" + xpub);
console.log("\nFirst deposit address (index 0), for verification: " + addr);
console.log("\n==============================================================================\n");
```

---

## 6. Run the ceremony (offline)

```bash
node generate.mjs
```

You will see three things:

1. **The 24 words** → **write them on paper/metal now.** Double-check every word and its order.
2. **`WALLET_XPUB=xpub...`** → this is the only line you send back.
3. **First deposit address** (`T...`) → note it; used to verify in the next step.

---

## 7. Verify before sending (independent check)

This proves the `xpub` you're about to send really derives the addresses the platform will use —
**using only the public key, no phrase involved.**

Save this as **`verify.mjs`**:

```js
// Independent xpub verification — watch-only, safe. Usage: node verify.mjs "xpub..."
import * as ecc from "@bitcoinerlab/secp256k1";
import { BIP32Factory } from "bip32";
import { TronWeb, utils as tronUtils } from "tronweb";

const bip32 = BIP32Factory(ecc);
const xpub = process.argv[2];
if (!xpub || !xpub.startsWith("xpub")) throw new Error("pass an xpub: node verify.mjs \"xpub...\"");

const account = bip32.fromBase58(xpub);
if (!account.isNeutered()) throw new Error("this is a PRIVATE key (xprv) — do NOT use or send it");

for (let i = 0; i < 3; i++) {
  const child = account.derive(0).derive(i);
  const uncompressed = ecc.pointCompress(child.publicKey, false);
  const addr = tronUtils.crypto.getBase58CheckAddress(tronUtils.crypto.computeAddress(uncompressed));
  if (!TronWeb.isAddress(addr)) throw new Error(`index ${i} invalid`);
  console.log(`index ${i}:  m/44'/195'/0'/0/${i}  ->  ${addr}`);
}
console.log("\nOK: valid watch-only TRON xpub. Index 0 must match the address from generate.mjs.");
```

Run it with the xpub you generated:

```bash
node verify.mjs "xpub6..."     # paste your WALLET_XPUB value (without the WALLET_XPUB= part)
```

**Pass condition:** it prints three `T...` addresses **and index 0 matches** the "First deposit
address" from step 6. If it says "this is a PRIVATE key (xprv)" — stop; you copied the wrong value.

---

## 8. Send back & wipe

1. Send the developer **only** the `WALLET_XPUB=xpub...` line (chat/email is fine — it's public).
2. Confirm the 24 words are safely recorded in **two** physical locations (see backup below).
3. If you used a Live USB: just power off — nothing was saved. If you used a normal laptop:
   delete the `qt-ceremony` folder and empty the trash.

The developer will run the **same verification** against the live backend before it goes into
production.

---

## 9. Backup the 24 words (do not skip)

- Write them **twice**, stored in **two separate secure locations** (e.g. home safe + bank box).
- A steel/metal backup plate is strongly recommended (fire/water resistant).
- Optional but recommended: split with **SLIP‑39** or use a multi-location scheme so one lost
  copy is not a total loss.
- **Never** store the words as a photo, screenshot, note app, password manager, email, or cloud file.

---

## 10. Quick reference — do / don't

| ✅ Do | ❌ Don't |
|---|---|
| Generate offline | Generate on an online/work computer |
| Write 24 words on paper/metal | Photograph, type, or cloud-store the 24 words |
| Send only `WALLET_XPUB=xpub...` | Send anything starting with `xprv` |
| Verify with `verify.mjs` first | Skip verification |
| Keep two physical backups | Keep only one copy |

---

## 11. FAQ

**Is it safe to send the `xpub` over WhatsApp/email?**
Yes. It is watch-only — it can generate receiving addresses but cannot move funds. The private
half (the 24 words) never leaves your paper.

**Will this work with a Trezor Safe 3 later?**
Yes. It's the same BIP39/BIP44/TRON standard. Cold storage can be added later with **no change**
to existing user wallets or addresses.

**Does this let the platform send withdrawals?**
No. This key only lets the platform *receive* deposits. Sending/withdrawals use a separate
secured signing setup that is added later — so real balances stay small and capped until then.

**What if I make a mistake?**
Nothing is live until the developer installs and verifies the `xpub`. Just re-run `generate.mjs`
to produce a fresh wallet and use the new one.

---

*Keep this document. The 24-word phrase it helps you create is the master key to the platform's
crypto — treat it like the deed to a vault.*
