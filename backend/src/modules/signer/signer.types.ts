/**
 * Client-side contract for the ISOLATED signer service (Documents/03,
 * backend/SIGNER.md). The real signer runs on Host B and is HUMAN-AUTHORED —
 * this repo only carries the interface, a dev/testnet mock, and a remote stub.
 */

export const SIGNER_CLIENT = Symbol("SIGNER_CLIENT");

export interface SignerClient {
  /** "mock" confirms instantly in the pipeline; "remote" is the real Host B signer. */
  readonly mode: "mock" | "remote";
  /**
   * Ask the signer to sign+broadcast one withdrawal. The signer independently
   * re-reads the row and re-verifies policy (status, caps, dual approval) —
   * a compromised API must not be able to make it sign arbitrary transactions.
   */
  signWithdrawal(withdrawalId: string): Promise<{ txHash: string }>;
  health(): Promise<boolean>;
}

/** The signer refused to sign (policy check failed). Never contains secrets. */
export class SignerRefusalError extends Error {
  constructor(message: string) {
    super(`signer refused: ${message}`);
    this.name = new.target.name;
  }
}
