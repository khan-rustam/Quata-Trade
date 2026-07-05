# Phase 3H — Launch Readiness Audit (the final gate)

**Date:** 2026-07-05 · **Method:** synthesis of the seven Phase-3 technical audits (3A–3G, ~350 verified findings, money-path findings adversarially cross-verified), the Phase 1 live-site audit, and the Phase 2 market report. This gate does not introduce new code findings; it answers the go/no-go, scale, failure-survival, and fund-safety questions directly from the verified evidence.

---

## 1. The headline verdict

**Overall real-money launch readiness: NO-GO today. Testnet/pilot-demo readiness: GO (which is what the platform is correctly doing right now).**

The single most important finding of the entire Phase-3 program is reassuring and was established by *independent, adversarial verification from two directions* (3B from the code, 3E from the schema/concurrency): **the money core is correct by construction. No path was found by which customer funds can be lost, the ledger can imbalance, a deposit can double-credit, or escrow can release while DISPUTED.** The conservation invariants hold.

The blockers are **not in the money core.** They are, in order of severity, (1) **operational** — backups that have never been restored, no monitoring, disabled alerting, a single-point-of-failure worker; (2) **the production perimeter and admin authentication** — no HSTS/CSP on the web origin, `trustProxy` IP-spoofing, admin login that doesn't enforce 2FA; (3) **the unbuilt production signer** — real withdrawals cannot execute at all yet; and (4) **scale** — the architecture is sound for one node and a capped pilot, but will not hold past ~10k active users without work already itemized in 3A. This exactly matches the project's own launch-readiness assessment: ~85% built, high-quality, blocked by legal + signer + ops rather than by the ledger.

### Composite readiness scorecard

| Dimension | Score | Source | Gate |
|---|---|---|---|
| Money-path integrity (code) | **74** | 3B | Conditional pass |
| Ledger/DB integrity & concurrency | **~82** | 3E (concur 83 / integ 80) | Qualified pass |
| Architecture | **70** | 3A | Conditional pass |
| Security (worst sub-score infra) | **55–70** | 3D | Hold |
| Code quality | **~64** | 3G | Not passed (coverage gate dead) |
| Frontend | **~51** | 3C | Not passed |
| **Observability** | **49** | 3B | Fail |
| **DevOps resilience** | **27** | 3F | Fail |
| **DevOps monitoring/DR** | **17** | 3F | Fail |
| Public site (Phase 1) | 58 | Phase 1 | Not launch-ready |
| **Real-money-at-scale readiness (composite)** | **≈ 48%** | — | **NO-GO** |
| **Capped-pilot software readiness (composite)** | **≈ 70%** | — | Conditional |

The spread between the money-core scores (70s–80s) and the ops scores (17–49) *is the whole story*: **a well-engineered ledger wearing a stub operational layer.**

---

## 2. Can this project safely launch?

Tiered answer:

- **Testnet / capped demo (today's posture: `SIGNER_MODE=mock`, `NODE_ENV=staging`, Shasta): YES** — safe and appropriate. It is an excellent demonstration of the full trade lifecycle.
- **Capped mainnet pilot (e.g. ≤200 USDT/trade, small hot float): NO — not until the Tier-1 gate items in §7 land** (production signer built + key ceremony; backups made real + one restore drill; alerting + monitoring stood up; admin 2FA enforced; web-origin HSTS/CSP; `trustProxy` fix; `openTrade` idempotency). None require redesign; they are a focused hardening cycle plus the (external) signer build.
- **General availability at scale: NO — requires the Tier-2/3 work in §7** (horizontal-scale rework, partitioning, worker HA) plus the non-code launch blockers the project already tracks (legal entity, crypto licensing, lawyer-reviewed EN+FR legal pages, pen-test).

---

## 3. Can it handle 100 / 1,000 / 10,000 / 100,000 users?

| Tier | Verdict | What holds / what breaks |
|---|---|---|
| **100 users** | ✅ **Comfortable** | Single node is over-provisioned for this. The only real risk is *invisibility*: an incident produces no page (alerting disabled, F-H6) and the status page lies (F-H10). Fine for a controlled pilot with a human watching. |
| **1,000 users** | 🟡 **Workable, blind** | Compute/DB fine. But the operational blind spots bite: no metrics/dashboards, `/health/ready` false-green (F-H8), reconciliation the only integrity signal and it's un-paged. Perf is mediocre (704 KB JS, no-store SSR — Phase 1/3C) but tolerable. |
| **10,000 users** | 🟠 **Strains — remediation required first** | The **deposit scanner fans one TronGrid RPC per active address every 30s** (3B/3E) → ~10k calls/30s hits provider rate limits and stalls crediting. `verifyChain()` OOM risk grows (3E-P1/3D-M8). Unbounded tables with no partitioning (3E) degrade queries; worker full-scans (`notifications`, `auth_tokens`, `kyc_submissions`) with missing indexes. In-memory throttler + XFF bypass make abuse control ineffective. Frontend perf fails CWV on the target market's devices (Phase 1). |
| **100,000 users** | 🔴 **Will not hold — architectural rework** | Every 3A scale ceiling binds: single Postgres primary (no replica/failover), **single-worker SPOF** for the whole money pipeline, in-memory Socket.IO/throttler/settings-cache (no horizontal scale), pervasive shared-DB coupling, per-address RPC fan-out infeasible, no partitioning/archival. This tier needs the ledger/trade-lifecycle extraction, a durable queue with worker HA, a Socket.IO Redis adapter, block-range deposit scanning, and table partitioning — all named in 3A/3E/3F, none started. |

**Bottom line:** built for a capped single-node pilot (its stated design goal), sound up to ~low-thousands, needs the itemized scale work before ~10k, and a scale-out program before 100k.

---

## 4. Can it survive failure? (per-mode survival matrix)

Legend: **Data-safe** = no ledger corruption/fund loss. **Available** = service continues or degrades gracefully. **Recovery** = automatic vs manual.

| Failure mode | Data-safe? | Available? | Assessment (evidence) |
|---|---|---|---|
| **Server crash / restart** | ✅ Yes (Postgres durable) | 🟡 Brief outage | PM2 restarts; but **no graceful drain** (~1.6s SIGKILL can kill the worker mid-job — F, idempotency *should* prevent double-spend but the design assumes drain). A crash-loop → permanent silent "errored" state, un-paged (F). |
| **Redis failure** | ✅ Yes | 🟡 Degraded | Sessions live in Postgres (survive); rate limits/velocity counters lost (they're per-process in-memory anyway); `/health/ready` still reports green (false — F-H8). Not catastrophic. |
| **Postgres failure** | ⚠️ **RPO ~24h** | 🔴 Total outage | **Single primary, no replica/failover.** Recovery = restore from a **local-only, never-restored** nightly dump (F-C2/F-C3). **This is the platform's single biggest data-loss exposure** — a host loss destroys the ledger *and* its only backups together. |
| **Worker failure** | ✅ Yes | 🔴 Money pipeline stalls | **Unmitigated SPOF** (3A-H4/3F): escrow-expiry refunds, deposit credit, withdrawal pipeline, 10-min reconciliation, email all stop. No HA. **Un-paged** (alerting disabled). Settlement stops silently. |
| **Signer failure** | ✅ Yes | 🟡 Withdrawals pause; deposits/trades continue | **This is the intended, correct degradation** — signer isolation means a signer/WireGuard outage pauses only withdrawals. (Moot today: the production signer isn't built.) |
| **Network partition (app↔signer)** | ✅ Yes | 🟡 Withdrawals pause | Same as above — designed for. Deposits/trades unaffected. |
| **Power loss** | ✅ Yes (WAL + Redis AOF) | 🟡 Restart window | In-flight jobs retry idempotently; durable. Recovery bounded only by the backup-gap above. |
| **Duplicate deposits** | 🟡 **Mostly** | ✅ | Exactly-once via `UNIQUE(tx_hash,log_index)` + row-lock + status guard + idempotency key (3B/3E). **Real edge:** `log_index` derived from RPC array position can re-record under a different index → phantom `SEEN` / defeated uniqueness (3B-M2). Fix before real deposits. |
| **Double withdrawals** | ✅ No path found | — | Dual-approval (distinct approvers) + idempotency + 3-layer caps + the signer's *independent* re-verification (3B). **Caveat:** that last defense is the unbuilt signer; the DB backstop hardcodes 500 USDT vs the editable threshold (3B-M3/3E-E3). No double-payout path exists in current code. |
| **Race conditions** | ✅ Yes | — | 3E found **no data-integrity race** — sorted `FOR UPDATE`, per-user advisory locks, guarded `WHERE status` transitions, confirm-vs-expiry → one terminal state. Two *recoverable* races: `openTrade` double-lock (3B-M1) and the PIN-counter lockout bypass (3D-M6). |
| **Spam / bots / abuse** | ✅ Data-safe | 🔴 Weakly resisted | In-memory throttler **defeated by `X-Forwarded-For` rotation** (3D-M1); `openTrade` has no concurrent cap (3D-M7); uploads have no rate limit; offer spam possible. Abuse control is the weak axis. |
| **DDoS** | ✅ Data-safe | 🔴 Exposed | No CDN/edge shielding (no-store SSR → every hit reaches origin); **`verifyChain` OOM reachable by a low-priv AUDITOR** (3D-M8); API binds `0.0.0.0` (3F-H4); unbounded queries. |
| **Fraud** | 🟡 Partial | — | Escrow + human dispute + deterministic risk is the right design, but the containment controls have holes: **risk errors are swallowed (fail-open)** (3B/3D/3G), **frozen users keep a live session** (3B-H1), **admin 2FA not enforced at login** (3D-H1), and **KYC photos leak EXIF/GPS** (3D-M9). |

**Reading:** the platform is **data-safe under essentially every failure mode** (the money core's durability and idempotency hold), but it is **weak on availability and on incident *visibility*** — most failures degrade correctly for the ledger yet page nobody and, for Postgres loss, have no proven recovery.

---

## 5. The four fund-safety questions — answered directly

These are the questions that decide whether a custodial platform may hold money. Each was adversarially verified in 3B and/or 3E.

**Can customer funds be lost?**
**Not through the code, at pilot scale — but yes through two operational gaps.** 3B found no fund-loss/imbalance path; 3E confirmed concurrency-safety by construction. Real withdrawals can't even execute yet (the signer is an unbuilt stub). The genuine loss vectors are **operational, not algorithmic**: (a) **Postgres host loss with local-only, never-restored backups → total irrecoverable ledger loss** (F-C2/F-C3) — the top risk; (b) **undefined cold-wallet key redundancy → a lost hardware device = ~95% of custody gone** (F-H11). Plus one code edge: the deposit reorg/`log_index` weakness can mis-credit against on-chain reality (3B-M2). **Close the backup/DR and cold-key gaps and harden deposits, and the "funds lost" answer becomes a defensible no.**

**Can escrow break?**
**No, under normal and concurrent operation.** 3B verified: single-writer FSM, DISPUTED truly freezes, no release-while-DISPUTED except admin resolution, oversell impossible, idempotent confirm, confirm-vs-expiry → exactly one terminal state, DB-trigger backstop. The only theoretical gaps are **not reachable by shipped code**: a direct `INSERT` into a terminal status bypasses the `UPDATE`-only FSM trigger (3E-E2 — requires a compromised app role), and `openTrade` double-locking (3B-M1 — recoverable griefing, not a break). Escrow is sound.

**Can balances desync?**
**Yes, transiently — but desync is *detected and contained*, not silent.** `account_balances` is a cache that can drift from `SUM(ledger_entries)`; the reconciliation cron re-sums every 10 minutes and, on any mismatch, **auto-pauses withdrawals** (verified end-to-end in 3E, honored on both the entry path and the broadcaster). **The weaknesses are in the detector, not the invariant:** up to 10-minute detection lag, the reconciliation job has no try/catch and flips the kill-switch non-atomically (3B — the detector can crash mid-flip), and a detected mismatch **pages nobody** because alerting is disabled (3F-H6). So: desync cannot go *undetected* for long, but the detection is fragile and un-alerted — fix the reconciliation job's resilience and wire alerting.

**Can journals become inconsistent?**
**No, for the current single-asset (USDT-TRC20) deployment.** Zero-sum is enforced by a deferred constraint trigger, append-only by RULEs + role REVOKE, and `postJournal` is atomic with a per-journal idempotency key (3E, grep-verified single-writer). **One dormant landmine:** the balanced-journal trigger sums `amount` ignoring per-row `asset` (3E-E1), so it would pass a falsely-balanced cross-asset journal **the instant a second asset ships** — this must be fixed before any BTC/ETH addition, but is a non-issue for USDT-only.

---

## 6. Consolidated cross-audit picture

**What multiple independent audits confirmed (high-confidence, real):**
- `openTrade` ignores its idempotency key → duplicate trade / double escrow-lock (3B, 3D, 3G).
- AES-256-GCM crypto triplicated with 2 copies dropping the key-length check and carrying false "does not exist yet" comments (3A, 3D, 3G).
- XAF-hardcoded money display/naming now mislabels live NGN/GHS/XOF markets, one path through a JS float (3C, 3E, 3G).
- The five highest-privilege admin mutations are untyped (`zAnyRecord`/`Promise<unknown>`) (3A, 3C, 3G).
- `verifyChain()` OOM reachable by a low-privilege role (3B, 3E, 3D).
- Worker is a single point of failure with no HA (3A, 3F).
- Web origin lacks HSTS/CSP; `trustProxy` enables IP spoofing (Phase 1, 3D, 3F).
- Session revocation gap — freeze/logout don't cut live sessions (3B, 3D).

**The Critical that undermines the recorded Gate-1 PASS:** 3G proved the **100%-branch money-path coverage gate is dead config — never actually run** despite comments claiming it passes. The recorded Gate-1 PASS (and the whole "money-path is 100%-covered" story) rests on a check CI does not execute. **Re-run coverage and re-verify Gate 1 before relying on it.**

**Documentation-vs-reality drift found:** the spec's claimed "sharp EXIF strip" upload pipeline doesn't exist (sharp isn't a dependency — 3D); BullMQ queues are documented but the code uses cron+outbox (3A, 3G); SERIALIZABLE is mandated but READ COMMITTED is used (intentional per D14 — 3E). These belong in the Deviations Log.

---

## 7. The launch-blocker critical path (tiered)

**Tier 1 — before any capped mainnet pilot (fund-holding):**
1. Build the production signer (Host B) + key ceremony with **defined cold-key redundancy** (SLIP-39/multisig) — *external, the long pole.*
2. Backups: enable encrypted offsite (DB **and** MinIO), key off-host, **run and record one restore drill** (F-C2/C3/H9).
3. Stand up monitoring + error tracking + external uptime probe; **add `ALERT_WEBHOOK_URL` to the prod boot hard-stops** and verify a synthetic reconciliation mismatch pages someone (F-H6/H7); fix `/health/ready` (F-H8).
4. **Enforce admin 2FA at login** + admin session revocation (D-H1).
5. Web-origin **HSTS + CSP + X-Frame-Options**; pin `trustProxy`; `Secure` cookie unconditionally on HTTPS; Redis-backed rate limiting (D-M1–4, F-C4).
6. `openTrade` idempotency (3B-M1); deposit exactly-once hardening — stable `log_index` + on-chain re-verify at credit (3B-M2); dual-approval backstop divergence (3B-M3/3E-E3).
7. **Wire `--coverage` into CI; re-verify Gate 1** (3G-C1). Make reconciliation resilient + atomic (3B).
8. Non-code (project already tracks): legal entity, crypto licensing, lawyer-reviewed EN+FR legal pages, external pen-test.

**Tier 2 — before scaling past ~10k users:**
Block-range deposit scanning; table partitioning + retention; pool `statement_timeout`/`lock_timeout`; DB pool + index gaps (3E); frontend perf (static marketing, code-split, cut JS — 3C/Phase 1); EXIF stripping + PII retention purge + AV scanning (3D); TOTP single-use + atomic PIN counter (3D).

**Tier 3 — before GA / 100k:**
Worker HA (durable queue + advisory locks/leader lease); Socket.IO Redis adapter; ledger/trade-lifecycle extraction + per-context data access; Postgres replica/failover; the god-service decompositions (3A/3G); per-asset balanced-journal trigger *before* multi-asset (3E-E1).

---

## 8. Final recommendation

**Do not custody real customer money yet.** The reason is *not* that the ledger is unsafe — it is genuinely, verifiably well-built, and that is the hard part most platforms get wrong. The reason is that a fund-holding platform also needs **provable recovery, incident visibility, a hardened perimeter, enforced admin 2FA, and the actual signing service** — and those are currently stubs, config gaps, or unbuilt. Every one of these is a **known, scoped, non-architectural fix** (except the signer, which is a deliberate external build already on the roadmap).

**The right path forward:** keep running on testnet (correct today), execute the Tier-1 gate as a focused hardening cycle in parallel with the signer build and the legal/licensing track, re-audit the specific hardened surfaces in the real staging/production configuration, then launch a **capped** mainnet pilot with a human watching the (newly built) dashboards. Scale work (Tiers 2–3) follows demand.

**One-line gate result:** *Money core — PASS by verified construction. Operations, perimeter, and the signer — FAIL, remediation-gated. Overall — NO-GO for real funds, GO for continued testnet, with a clear and achievable path to a capped pilot.*

---

*Sources: Phase 3A–3G audit documents in this directory; Phase 1 site audit (`website-launch-audit-2026-07-04.md`); Phase 2 market report (`../research/phase2-market-intelligence-2026-07-05.md`); the project's own `launch-readiness/` handoff. Money-path conclusions rest on the adversarially-verified findings of 3B and 3E.*
