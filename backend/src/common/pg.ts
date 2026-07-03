/**
 * The `pg` driver returns Postgres arrays of **custom enum types** (e.g. the
 * `payment_method[]` column on `offers`) as the raw array literal string
 * `"{MTN_MOMO,ORANGE_MONEY}"` rather than a JS array — no element parser is
 * registered for user-defined types, so node-postgres falls back to identity.
 *
 * This normalizes either form to a real array. It is defensive on purpose:
 * environments that DO parse the array (or code passing an already-parsed
 * array) pass through unchanged, while the raw runtime driver output is parsed.
 * Enum tokens are simple identifiers (no quotes, commas, or spaces), so a plain
 * split is safe and lossless.
 */
export function parsePgEnumArray<T extends string>(
  value: readonly T[] | T[] | string | null | undefined,
): T[] {
  if (value == null) return [];
  if (Array.isArray(value)) return [...value];
  const inner = String(value).replace(/^\{/, "").replace(/\}$/, "").trim();
  if (inner === "") return [];
  return inner.split(",").map((token) => token.trim()) as T[];
}
