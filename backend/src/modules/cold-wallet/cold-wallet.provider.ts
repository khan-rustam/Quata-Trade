/**
 * Cold Wallet Provider abstraction (Documents/10 D30-cold).
 *
 * A provider layer through which future cold-storage operations route. It is
 * DISABLED at launch. When a Trezor Safe 3 (or other custody) is adopted, only
 * COLD_WALLET_PROVIDER config changes and a human completes the matching stub —
 * no other code changes. Mirrors the signer model: the API/worker never hold
 * spending keys; a cold provider only exposes a receive address + status.
 */

export type ColdWalletProviderId = "disabled" | "trezor_safe_3" | "future_hardware" | "institutional_custody";

export interface ColdWalletStatus {
  provider: ColdWalletProviderId;
  /** Whether the provider is active and can accept hot→cold sweeps today. */
  enabled: boolean;
  /** Whether a real cold-storage receive address is available. */
  canReceive: boolean;
  label: string;
  note: string;
}

export interface ColdWalletProvider {
  readonly id: ColdWalletProviderId;
  status(): ColdWalletStatus;
  /**
   * Cold-storage receive address for a future hot→cold sweep. Throws while the
   * provider is disabled/not initialized — callers must check status().enabled.
   */
  getReceiveAddress(): Promise<string>;
}

export class ColdWalletDisabledError extends Error {
  constructor(message = "cold wallet provider is disabled") {
    super(message);
    this.name = new.target.name;
  }
}

/** Default provider: no cold storage yet. Every cold operation is refused. */
export class DisabledColdWalletProvider implements ColdWalletProvider {
  readonly id = "disabled" as const;
  status(): ColdWalletStatus {
    return {
      provider: this.id,
      enabled: false,
      canReceive: false,
      label: "Disabled",
      note: "No cold wallet is configured. Funds are held in the hot wallet; enable a cold provider after the hardware key ceremony.",
    };
  }
  getReceiveAddress(): Promise<string> {
    return Promise.reject(new ColdWalletDisabledError());
  }
}

/**
 * Trezor Safe 3 provider — a DISABLED stub until the hardware arrives. Selected
 * via COLD_WALLET_PROVIDER=trezor_safe_3; a human then completes the key-ceremony
 * wiring (receive address / sweep policy). Reports "coming soon" and refuses
 * operations, exactly like the human-authored remote signer stub.
 */
export class TrezorSafe3Provider implements ColdWalletProvider {
  readonly id = "trezor_safe_3" as const;
  status(): ColdWalletStatus {
    return {
      provider: this.id,
      enabled: false,
      canReceive: false,
      label: "Trezor Safe 3",
      note: "Selected but not yet initialized — complete the offline key ceremony and provide the cold receive address before enabling sweeps.",
    };
  }
  getReceiveAddress(): Promise<string> {
    return Promise.reject(
      new ColdWalletDisabledError("Trezor Safe 3 cold wallet is not initialized — human key ceremony required"),
    );
  }
}

/** Institutional custody placeholder (future). Disabled. */
export class InstitutionalCustodyProvider implements ColdWalletProvider {
  readonly id = "institutional_custody" as const;
  status(): ColdWalletStatus {
    return {
      provider: this.id,
      enabled: false,
      canReceive: false,
      label: "Institutional custody",
      note: "Institutional custody provider is a future option and is not configured.",
    };
  }
  getReceiveAddress(): Promise<string> {
    return Promise.reject(new ColdWalletDisabledError("institutional custody provider not configured"));
  }
}

/** Generic future-hardware placeholder. Disabled. */
export class FutureHardwareProvider implements ColdWalletProvider {
  readonly id = "future_hardware" as const;
  status(): ColdWalletStatus {
    return {
      provider: this.id,
      enabled: false,
      canReceive: false,
      label: "Future hardware wallet",
      note: "A future hardware wallet provider slot; not configured.",
    };
  }
  getReceiveAddress(): Promise<string> {
    return Promise.reject(new ColdWalletDisabledError("future hardware provider not configured"));
  }
}

/** Build the configured provider. Unknown/absent → DisabledColdWalletProvider. */
export function createColdWalletProvider(id: ColdWalletProviderId): ColdWalletProvider {
  switch (id) {
    case "trezor_safe_3":
      return new TrezorSafe3Provider();
    case "institutional_custody":
      return new InstitutionalCustodyProvider();
    case "future_hardware":
      return new FutureHardwareProvider();
    case "disabled":
    default:
      return new DisabledColdWalletProvider();
  }
}

export const COLD_WALLET_PROVIDER = Symbol("COLD_WALLET_PROVIDER");
