---
name: quatatrade-kyc-risk
description: KYC verification and fraud/risk-engine rules for QuataTrade. Use BEFORE touching backend/src/modules/kyc, risk, screening, or any verification tier, document review, sanctions check or fraud decision. Triggers on KYC, verification, tier, identity, document, OCR, face match, liveness, sanctions, OFAC, AML, risk score, velocity, fraud, blacklist.
---

# QuataTrade KYC & Risk Rules

Authority: `Documents/01-overview.md` (decisions) + `Documents/08-security-checklist.md`
§E/§I. Implementation: `backend/src/modules/kyc/`, `risk/`, `screening/`.

## The two rules that cannot be bent

1. **No code path may auto-approve KYC.** Not a threshold, not a confidence score, not
   "provider said yes". Every approval is a human decision recorded against an admin
   identity in the audit log. This is a legal position (Cameroon Law No. 2024/017) and a
   fraud position, and it is written into `CLAUDE.md` — a PR that introduces an
   auto-approve path gets rejected, not reviewed.
2. **No LLM in a fraud, risk or verification decision path.** The risk engine is
   deterministic TypeScript rules plus Redis velocity counters, with thresholds
   config-driven in the DB. There is no labelled data pre-launch; an LLM here is the
   wrong tool and an unauditable one. LLM output may never gate money movement.

## What the assist pipeline may do

OCR (PaddleOCR/Tesseract, PassportEye MRZ) and any face-match exist **only** to
pre-fill fields and surface signals for a human reviewer. They:

- write into a review draft, never into an approved state;
- must show the reviewer the raw document alongside any extracted value;
- must never produce a numeric score that a code path then compares to a threshold to
  decide the outcome. Signals inform a person; they do not decide.

Smile ID is the recommended provider. Even with a provider, **the decision still lands
in the admin queue** — the provider result is one input on the reviewer's screen.

## Risk engine

- Deterministic rules only: velocity, device fingerprint, IP/geo (MaxMind GeoLite2),
  duplicate detection. FingerprintJS is a signal, never a sole factor.
- Sanctions/wallet screening against OFAC SDN + OpenSanctions, refreshed weekly, on both
  names and withdrawal addresses. A screening hit **holds** — it does not silently pass
  or silently block; it creates a reviewable item.
- Thresholds live in DB config, not literals in code, so changing one is an audited
  admin action rather than a deploy.
- Every risk decision writes why it fired — the rule id and the values that tripped it.
  "Flagged" with no reason is useless to a reviewer and indefensible to a regulator.

## KYC data handling (§08 §F/§I)

- Documents encrypted **at rest per file** (sodium; per-file keys wrapped by a master key
  from the secrets manager), in private MinIO buckets, served only via short-TTL
  presigned URLs. See `quatatrade-uploads`.
- Every access to a KYC document is audit-logged with the admin identity — reads
  included, not just decisions.
- Retention schedule enforced by a purge job. Consent captured at submission.
- **No KYC-as-training-data pipeline exists in v1.** The client asked for one; it is
  explicitly out of scope and recorded in the Deviations Log. Do not build one, do not
  add a hook that would enable one.
- Data-subject export/delete path must keep working within legal limits.

## NEVER do

- NEVER add an auto-approve, auto-escalate-to-approved, or "approve if score > X" path.
- NEVER let a KYC tier change without an admin identity and an audit row.
- NEVER call an LLM from `risk/`, `kyc/` decisioning, or `screening/`.
- NEVER log, echo, or put into a Claude context: document images, MRZ strings, ID
  numbers, dates of birth, or face-match vectors.
- NEVER return raw KYC fields to a non-admin endpoint, and never widen a mapper to
  include them "for convenience".
- NEVER let a screening failure fail *open* — if the sanctions dataset is unavailable,
  hold the action; do not proceed unscreened.
- NEVER weaken a rule to clear a test fixture; fix the fixture.
