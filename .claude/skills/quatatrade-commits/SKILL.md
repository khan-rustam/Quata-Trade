---
name: quatatrade-commits
description: Commit message and PR discipline for QuataTrade. Use before creating ANY commit or PR, when writing a commit message, or when asked to commit, push, squash or open a pull request. Triggers on commit, message, PR, changelog, squash, amend, conventional commits.
---

# QuataTrade Commit Rules

Authority: this skill (the docs do not specify a commit format) +
`Documents/05-build-phases.md` for gate commits. Use `/commit` from the
`commit-commands` plugin; it respects these rules.

## Format

```
type(scope): subject line, max 72 characters

Body: what changed and WHY. Wrap at 72. This is where the reasoning goes —
the repo already does this well (~17 body lines per commit); keep it.

Refs: Documents/audits/gate-N.md   (only when a gate is involved)
```

**The subject is capped at 72 characters.** Measured on this repo: 60 of the last 100
subjects exceeded it. `git log --oneline` and GitHub both truncate, and the
distinguishing clause is always at the end — so the meaning is exactly what gets lost.
When a subject wants two clauses, the second one belongs in the body:

- ✗ `fix(deposits,admin): tell the user their deposit was refused; stop counting refused as pending`
- ✓ `fix(deposits,admin): surface refused deposits to the user`
  with the "stop counting refused as pending" half as the first body line.

## Declared types

`feat` · `fix` · `docs` · `refactor` · `test` · `perf` · `chore` · `build` · `ci`
plus two project-specific types that are **intentional, keep them**:

- **`security`** — remediation of an audit finding or hardening work. Distinguishing
  these from `fix` is worth the non-standard type in a money repo; it makes
  `git log --grep='^security'` a real security changelog.
- **`i18n`** — translation and locale work, which is a first-class concern here
  (en + fr from day one), not a `chore`.

## Declared scopes

Money paths: `ledger` · `escrow` · `fees` · `wallet` · `withdrawals` · `deposits` ·
`trades` · `offers` · `treasury` · `signer`
Platform: `auth` · `admin` · `kyc` · `risk` · `screening` · `disputes` · `chat` ·
`notify` · `markets` · `countries` · `settings` · `content` · `promo` · `db` · `config`
Surfaces: `public` · `app` · `ui` · `pwa` · `seo`
Meta: `ops` · `deploy` · `deviations` · `docs`

Rules for scopes:
- Use the backend module name where one exists (`backend/src/modules/*`).
- Multiple scopes are comma-separated with no spaces: `fix(deposits,admin):`.
- ✗ Never use a phase or ticket label as a scope — `(item7)`, `(item2)`, `P5:`, `P6b:`
  are all in this history and none of them mean anything to a reader later.
- ✗ Don't split one surface across synonyms: `admin` (not `admin-ui`), `ui` for shared
  components, `app`/`public` for route groups. `frontend` is not a scope.

## Money-path commits

A commit touching `ledger/ escrow/ fees/ wallet/ withdrawals/ deposits/ trades/`:

- must be **reviewable line-by-line** — no drive-by reformatting, no "while I'm here"
  refactors mixed in (CLAUDE.md behavioural rule 3);
- must have its tests in the same commit as the implementation, tests written first;
- must state in the body which §08 checklist boxes it affects, and reference the gate
  doc if it closes one.

## Before every commit

1. `pnpm lint` and `pnpm -r typecheck` green.
2. Relevant test project green — paste the output, don't assert it.
3. `git diff --staged` reviewed for secrets, keys, mnemonics, `.env` content, and for
   files you didn't mean to stage.
4. On the default branch? Branch first.

## NEVER do

- NEVER write a bare subject like `Updates`, `lint fix`, `fixes`, or `wip`. Every one
  of those is an unbisectable commit in a codebase that moves real money.
- NEVER exceed 72 characters in the subject.
- NEVER commit a private key, mnemonic, seed, `.env` file, or a real credential —
  including as a "demo" value in config or a permissions allowlist.
- NEVER mix a money-path change with unrelated changes in one commit.
- NEVER use `--no-verify` to skip hooks.
- NEVER commit or push unless the user asked for it.
- NEVER claim in a commit body that tests pass or coverage holds without having run it.
