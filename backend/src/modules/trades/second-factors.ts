import type { ConfirmTradeRequest } from "@quatatrade/shared";

/**
 * Which mandatory second factor (if any) is MISSING from a trade-confirm request.
 *
 * Confirming a trade releases escrow — a money-moving action. A user who has
 * enrolled a factor (TOTP and/or PIN) must ALWAYS supply it here; it can never be
 * bypassed by simply omitting the field (Documents/08 §E). Returns the first
 * missing required factor, or null when every enrolled factor is present.
 */
export function missingSecondFactor(
  enrolled: { totpEnabled: boolean; hasPin: boolean },
  dto: Pick<ConfirmTradeRequest, "totpCode" | "pin">,
): "totp" | "pin" | null {
  if (enrolled.totpEnabled && !dto.totpCode) return "totp";
  if (enrolled.hasPin && !dto.pin) return "pin";
  return null;
}
