# users

Self-service profile and session management: `GET/PATCH /users/me`,
`GET /users/me/sessions`, `DELETE /users/me/sessions/:id`.

Invariants: every query is scoped by the AUTHENTICATED user id from the JWT —
path ids are matched inside the WHERE clause, never trusted for ownership
(IDOR-proof; foreign/unknown ids get the same 404). Profile mapping never
exposes hashes (`pinSet` is a boolean derived from `pin_hash`). Session
revocations are audit-logged.

Callers: HTTP via UsersController; other modules (trades/withdrawals/offers)
inject `UsersService.assertActive(userId)` to block frozen/suspended/closed
users from money operations.
