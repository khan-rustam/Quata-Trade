---
name: quatatrade-i18n
description: Localization rules for QuataTrade (English + French, both first-class). Use when adding or changing ANY user-facing string, message key, date/number/currency formatting, or when reviewing a UI change for translation. Triggers on i18n, next-intl, translation, locale, French, fr, en, messages.json, formatting, pluralization.
---

# QuataTrade i18n Rules

Authority: `Documents/11-brand-design-system.md` §11.9 + `Documents/07-frontend-spec.md`.
Library is **next-intl**; catalogues are `frontend/messages/en.json` and
`frontend/messages/fr.json`; config in `frontend/i18n/request.ts`.

## Current state — keep it this way

2,140 keys, **exact parity between en and fr, zero missing keys**. That is unusually
healthy; the job is to not regress it. Every PR that adds an `en` key adds the `fr`
value in the same commit. A missing FR string is a bug, not a follow-up.

## Rules

- **No hardcoded user-facing strings.** Every label, button, error, empty state, toast,
  `aria-label`, `alt` text, page title and meta description is a message key. This
  includes admin screens — admins are French speakers too.
- French is written as French, not translated from English. Formal **vous** in product
  UI; informal *tu/ton* is allowed **only** in youth marketing campaigns.
- Pluralization and interpolation go through ICU message syntax
  (`{count, plural, one {# confirmation} other {# confirmations}}`), never string
  concatenation — concatenated fragments cannot be translated correctly.
- Dates, numbers and currency use next-intl formatters or `frontend/lib/format.ts`.
  Never `toLocaleString()` with a hardcoded locale.
- **XAF and USDT are never ambiguous.** Every figure is unit-labelled in both languages.
  Amounts stay in IBM Plex Mono with `tabular-nums` regardless of locale.

## French runs ~20% longer — this is a layout rule, not a copy rule

Every UI change gets checked in FR at 380px. The recurring breakages:

- buttons and CTAs wrapping to two lines or truncating mid-word;
- bottom-nav labels (Home/Markets/Trade/Wallet/Account → Accueil/Marchés/Échange/
  Portefeuille/Compte) overflowing their tab;
- table headers in admin forcing horizontal scroll;
- chips and badges growing past their container;
- money-button labels ("Release 150.00 USDT" → "Libérer 150,00 USDT") clipping the amount.

If FR does not fit, change the layout or shorten **both** languages — never ship a
truncated FR string, and never let a truncation remove digits from an amount.

## Legitimately identical strings

64 keys have the same value in both catalogues. Most are correct and should be left
alone: proper nouns (`MTN Mobile Money`, `Orange Money`, `QuataPay`), email addresses,
and true French cognates (`Notifications`, `Confirmations`). Do not "fix" these by
inventing a French variant. Do check any *new* identical pair is one of those cases and
not an untranslated string.

## NEVER do

- NEVER add an `en` key without its `fr` counterpart in the same commit.
- NEVER concatenate translated fragments to build a sentence.
- NEVER put a number, date or currency into a translated string as pre-formatted text —
  pass it as an ICU argument so each locale formats it correctly.
- NEVER use `fr` copy that reads as machine translation on money or security screens.
  Security messaging must stay calm and specific in both languages ("Confirmez que vous
  avez reçu 98 500 XAF sur VOTRE compte MoMo avant de libérer").
- NEVER use the banned marketing register in either language: "get rich", "moon",
  "guaranteed profit", "invest" / "devenez riche", "gain garanti", "investir".
- NEVER hardcode a locale in a formatter or a route; the language toggle must work
  on every page.
