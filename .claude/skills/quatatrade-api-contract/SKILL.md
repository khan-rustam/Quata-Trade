---
name: quatatrade-api-contract
description: FE/BE contract discipline for QuataTrade. Use when adding or changing ANY API endpoint, request/response shape, zod schema, the typed client, or when frontend code needs data from the backend. Triggers on shared schemas, DTO, endpoint, API client, contract test.
---

# QuataTrade API Contract Rules

Authority: `Documents/07-frontend-spec.md` (contract section) + `Documents/09-testing-and-integration.md`.
The contract lives in ONE place: `shared/src/schemas/*` (+ `shared/src/client/index.ts`).

## The loop for any endpoint change

1. Change/add the **zod schema in `shared/`** first (strict object, unknown fields rejected).
2. `pnpm build:shared` — backend and frontend both import the same schema.
3. Backend controller validates with `new ZodPipe(schema)`; response mapped so
   `schema.parse(response)` passes (mappers do this in dev).
4. Frontend calls ONLY through `QuataApiClient` (`shared/src/client`) — it parses responses
   with the same schema. Components never call `fetch` directly.
5. Contract test: supertest request through the real endpoint, `schema.parse(res.body)` must not throw.
6. `pnpm -r typecheck` — a breaking change must fail compilation at every stale call site.
   That failure IS the integration test working; fix call sites, don't loosen the schema.

## Wire rules

- Money: BIGINT amounts travel as decimal **strings** (`zAmount`); parse with `parseAmount()`,
  serialize with `.toString()`. `Money` helpers in `shared/src/money.ts` for display only.
- Dates: ISO strings. IDs: UUID strings. Enums come from `shared/src/constants.ts`
  (mirrors PG enums 1:1 — changing one requires a migration + Deviations entry).
- Errors: Nest exception envelope `{statusCode, error, message}` (`zApiError`).
- Auth: access token in memory via `Authorization: Bearer`; refresh token ONLY in the
  httpOnly cookie (`credentials: "include"`). NEVER tokens in localStorage.

## NEVER do

- NEVER define request/response types in backend or frontend files — shared package only.
- NEVER use non-strict zod objects on inputs, or `z.any()` anywhere in the contract.
- NEVER do arithmetic on wire amount strings in the frontend; convert via Money helpers.
- NEVER "temporarily" duplicate a schema — that is how contracts drift.
- NEVER return more fields than the schema declares (leak risk); mappers whitelist.
