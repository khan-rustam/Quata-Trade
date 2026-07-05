import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Admin money-config surfaces (fee/cap editor, ledger adjustment) handle
    // smallest-unit BIGINT amounts as strings — never route them through Number()
    // (precision loss past 2^53). Use fromDisplay/BigInt. Plain numbers like
    // window minutes, confirmations, or fee bps are unaffected.
    files: ["app/admin/settings/**/*.{ts,tsx}", "app/admin/ledger-adjustment/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          // Both camelCase and snake_case money fields — the caps editor holds state
          // as snake_case (caps.per_tx_max, …), so those spellings must be covered too.
          selector:
            "CallExpression[callee.name='Number'] > MemberExpression[property.name=/^(amount|balance|available|price|units|fee|feeAmount|fee_amount|minAmount|min_amount|minTrade|maxTrade|dailyWithdrawal|totalAmount|buyerCredit|remaining|perTxMax|dailyMax|dualApprovalThreshold|autoApproveBelow|per_tx_max|daily_max|dual_approval_threshold|auto_approve_below)$/]",
          message: "Never convert money (smallest units) to Number — use fromDisplay/BigInt.",
        },
        {
          selector: "CallExpression[callee.name='Number'] > Identifier[name=/amount|balance/i]",
          message: "Never convert money to Number — use fromDisplay/BigInt.",
        },
      ],
    },
  },
]);

export default eslintConfig;
