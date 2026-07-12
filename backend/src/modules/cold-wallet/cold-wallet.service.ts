import { Inject, Injectable } from "@nestjs/common";
import { COLD_WALLET_PROVIDER, type ColdWalletProvider, type ColdWalletStatus } from "./cold-wallet.provider";

/**
 * Thin service over the configured Cold Wallet Provider. Wallet ops that will
 * one day move funds to cold storage go through here; today it only reports
 * status (the provider is disabled at launch).
 */
@Injectable()
export class ColdWalletService {
  constructor(@Inject(COLD_WALLET_PROVIDER) private readonly provider: ColdWalletProvider) {}

  status(): ColdWalletStatus {
    return this.provider.status();
  }

  get enabled(): boolean {
    return this.provider.status().enabled;
  }
}
