---
name: quatatrade-code-style
description: TypeScript, comment and code-clarity discipline for QuataTrade. Use when writing or reviewing any code, adding comments or JSDoc, naming things, or when tempted to cast, disable a lint rule, or leave a TODO. Triggers on any, as unknown as, eslint-disable, ts-ignore, TODO, comment, JSDoc, naming, readability.
---

# QuataTrade Code Style Rules

Authority: `Documents/02-tech-stack.md` (banned list) + `Documents/08-security-checklist.md` §H.
`strict: true` and `noUncheckedIndexedAccess: true` everywhere.

## Types

- **`any` and `as unknown as` are ESLint hard-fails** in `ledger/ escrow/ wallet/
  withdrawals/ fees/ signer/`. Elsewhere they are still a code smell requiring a comment
  explaining why no honest type exists.
- Prefer `unknown` + a zod parse over a cast. If data crosses a boundary, parse it;
  a cast is a claim you have not verified.
- No non-null assertion (`!`) on anything derived from user input, a DB row, or a
  network response. `noUncheckedIndexedAccess` is on — handle the `undefined`.
- Types for API shapes live in `shared/src/schemas` only, inferred with `z.infer`.
  Never hand-write a duplicate interface in backend or frontend.
- Money is `bigint` in TS and decimal **strings** on the wire. `number` for an amount
  past the display layer is banned repo-wide.

## Comments — what to write and what not to

The rule: **comment the "why", never the "what".** The code says what it does; a
comment exists to record the reasoning a reader cannot recover from the code.

Write a comment when:
- a value is non-obvious and load-bearing — the WCAG note in `frontend/app/globals.css`
  explaining why light-mode accent is `#0c7a62` rather than the brand mint is the model
  to follow: it stops a future session "fixing" it back and breaking contrast;
- an ordering or isolation level matters (lock order, SERIALIZABLE, same-transaction
  requirements) — say what breaks if it changes;
- you are working around an upstream bug or platform quirk — name it and link it;
- an invariant is enforced elsewhere — point at the trigger, CHECK or property test;
- a rule comes from a doc — cite it as `Documents/08 §A` so the authority is findable.

Do not write:
- restatements (`// increment i`), section banners, or commented-out code (delete it —
  git remembers);
- a JSDoc block that only repeats the signature and adds no constraint or unit;
- `TODO`/`FIXME` without an owner and a tracking reference. On a money path, an
  untracked TODO is a silent known-defect — either fix it or log it in the Deviations Log.

Money-path functions get a short doc comment stating the invariant they maintain, the
units they take, and the transaction context they must be called in.

## Naming

- Amounts carry their unit: `amountMinor`, `feeMinor`, `priceXaf` — never bare `amount`
  where minor/major units could be confused. This is the failure mode that loses money.
- Booleans read as assertions: `isApproved`, `hasPassedKyc`, `canRelease`.
- Say what a thing is, not how it is built: a user manages *notifications*, not
  *webhook config*. Same rule applies to UI copy (`quatatrade-brand`).

## Structure

Match the surrounding code — its comment density, naming and idioms. Consistency beats
personal preference. Implement exactly what the task needs: no speculative abstraction,
no "while I'm here" refactor, and never reformat a file you are only fixing one line in
(CLAUDE.md behavioural rules 2 and 3 — diffs on money paths must be reviewable line-by-line).

## NEVER do

- NEVER add `// eslint-disable`, `@ts-ignore` or `@ts-expect-error` on a money path.
  Anywhere else it needs a comment justifying it and a narrow scope.
- NEVER widen a type, loosen a zod schema, or add a cast to make a compile error go
  away. The error is usually the contract working (`quatatrade-api-contract`).
- NEVER use `eval`, dynamic `require`, or add an unpinned dependency (§02 banned list).
- NEVER log a secret, private key, mnemonic, full token, or PII — pino redaction is not
  a substitute for not logging it.
- NEVER leave a commented-out money-path test or code block in a commit.
- NEVER write a comment that asserts a behaviour you have not verified ("safe because
  it's serializable") — cite the test or the constraint that makes it true.
