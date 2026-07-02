/**
 * DI tokens local to the wallet module.
 *
 * PIN_SERVICE: the auth module (built in parallel) owns PIN hashing/lockout.
 * Wallet only needs "verify or throw" — this narrow interface decouples the
 * two modules. app.module (or wallet.module later) must bind the token to
 * auth's PinService: { provide: PIN_SERVICE, useExisting: PinService }.
 * Until bound, POST /wallet/transfer answers 503 (fail closed, never open).
 */
export const PIN_SERVICE = "PIN_SERVICE";

export interface PinVerifier {
  /** Resolves when the PIN is correct; throws on mismatch/lockout. */
  verifyPin(userId: string, pin: string): Promise<void>;
}

/** Account-level extended PUBLIC key (m/44'/195'/0') from the WALLET_XPUB env. */
export const WALLET_XPUB = "WALLET_XPUB";
