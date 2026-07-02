import { Injectable } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env";
import type { SignerClient } from "./signer.types";

const HUMAN_AUTHORED = "remote signer integration is human-authored — see backend/SIGNER.md";

/**
 * Stub client for the REAL Host B signer (mTLS over WireGuard).
 * CLAUDE.md: "Never generate or modify signer code unattended" — the transport
 * body of this class is a human task against the deployed Host B service.
 * The constructor only validates that the mTLS configuration is present so a
 * misconfigured production boot fails fast instead of failing at first payout.
 */
@Injectable()
export class RemoteSignerService implements SignerClient {
  readonly mode = "remote" as const;

  constructor(config: ConfigService<Env, true>) {
    const url = config.get("SIGNER_URL", { infer: true });
    const caCert = config.get("SIGNER_CA_CERT_PATH", { infer: true });
    const clientCert = config.get("SIGNER_CLIENT_CERT_PATH", { infer: true });
    const clientKey = config.get("SIGNER_CLIENT_KEY_PATH", { infer: true });
    if (!url || !caCert || !clientCert || !clientKey) {
      throw new Error(
        "RemoteSignerService requires SIGNER_URL, SIGNER_CA_CERT_PATH, SIGNER_CLIENT_CERT_PATH and SIGNER_CLIENT_KEY_PATH",
      );
    }
  }

  signWithdrawal(_withdrawalId: string): Promise<{ txHash: string }> {
    return Promise.reject(new Error(HUMAN_AUTHORED));
  }

  health(): Promise<boolean> {
    return Promise.reject(new Error(HUMAN_AUTHORED));
  }
}
