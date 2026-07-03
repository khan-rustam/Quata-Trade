/**
 * A destination/source address matched the AML blocklist. Callers on the
 * outbound path convert this to a generic HTTP error — the specific match
 * reason (sanctions list name, etc.) is NEVER leaked to the user, only logged
 * and routed to compliance via the aml.hit alert.
 */
export class BlockedAddressError extends Error {
  constructor(
    /** Compliance-facing detail — never returned in an HTTP body. */
    public readonly reason: string,
    public readonly category: string,
  ) {
    super("address is blocked");
    this.name = "BlockedAddressError";
  }
}
