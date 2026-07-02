# Signer Service Contract (apps/signer — NOT in this repo)

> Documents/03-architecture.md: **"Claude Code never generates signer code unattended.
> Human writes/reviews this app line-by-line; it should stay under ~600 lines total."**
> This repo therefore contains only the CLIENT interface (`src/modules/signer/`) and
> a dev-only mock. The production signer is a separate, human-authored deployable.

## Isolation contract (must all hold before mainnet)

- Runs on **Host B**: separate VPS, ufw default-deny, **no inbound internet**.
- Reachable only via WireGuard tunnel from Host A; outbound only to RPC providers.
- Holds the encrypted hot-wallet key material. Master key entered at process start
  by a human (or fetched from Infisical over the tunnel). Never on disk in plaintext,
  never in this repo, never in any AI context.
- The API/worker hold **xpub only** (watch-only derivation).

## Endpoints (mTLS over the tunnel, exactly three)

| Endpoint | Behavior |
|---|---|
| `POST /sign/withdrawal` | Input: `{ withdrawalId }`. The signer **independently** re-reads the withdrawal row from PG (read-only credentials), then verifies ALL of: `status = 'APPROVED'`, `amount + fee ≤ per-tx cap`, daily aggregate ≤ daily cap, destination not blacklisted, dual-approval satisfied for large amounts (`second_approver IS NOT NULL AND second_approver <> approved_by`). Only then: build TRC20 transfer, sign, broadcast, write `tx_hash`. Any check fails → refuse + alert. |
| `POST /sign/escrow-release` | Reserved. Phase-1 escrow is ledger-level — no on-chain movement, no signing. |
| `GET /health` | Liveness + config-cap echo (no secrets). |

## Hard caps (signer-side config, independent of API/DB)

- max per transaction, max per hour, max per day. Exceeding = refuse + alert,
  **regardless of what the API says**. A fully compromised API must not be able to
  drain more than the hot float within one cap window.

## Dev/testnet behavior in this repo

- `SIGNER_MODE=mock` wires `MockSignerService` into the withdrawal pipeline. It
  simulates the signer's re-verification policy and returns a fake tx hash.
- `validateEnv` **refuses to boot production with `SIGNER_MODE=mock`**.
- `RemoteSignerService` is a stub that validates mTLS config and throws — replacing
  its body is a human task, done against the real Host B deployment.

## Key ceremony (human-only checklist)

1. Generate BIP39 seed **offline** on an air-gapped machine — never typed into
   any AI tool, never on Host A.
2. Derive account xpub (m/44'/195'/0') → goes into API env (`WALLET_XPUB`).
3. Hot key encrypted (sodium sealed box) → Host B only. Cold wallet = hardware
   device held by the **client** (Documents/01 legal guardrail #1).
4. Sweep policy: hot float small (e.g. 1,000 USDT at launch); everything above
   auto-sweeps to cold.
