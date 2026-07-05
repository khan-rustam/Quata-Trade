// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Documents/02-tech-stack.md: `any` and unchecked casts are BANNED in money
 * folders (hard CI failure). Elsewhere they are still errors, but money paths
 * additionally ban `as unknown as` double-casts and non-null assertions.
 */
const MONEY_PATHS = [
  "src/modules/ledger/**/*.ts",
  "src/modules/escrow/**/*.ts",
  "src/modules/fees/**/*.ts",
  "src/modules/wallet/**/*.ts",
  "src/modules/withdrawals/**/*.ts",
  "src/modules/deposits/**/*.ts",
  "src/modules/trades/**/*.ts",
];

// settings/ and admin/ now validate + convert money config (fee_bps, caps,
// ledger adjustments), so the "never turn money into a JS number" ban applies
// there too — but NOT the stricter cast/non-null rules (those would flood these
// large, non-core-money modules with unrelated churn).
const MONEY_NUMBER_PATHS = ["src/modules/settings/**/*.ts", "src/modules/admin/**/*.ts"];

// Property names that are smallest-unit BIGINT money — `Number(x.<name>)` loses
// precision past 2^53. Anchored ^…$ so count/aggregate fields (n, total, signups,
// active, …) and legit numbers (feeBps, confirmations, minutes) are NOT caught.
const MONEY_MEMBER_NAMES =
  "amount|balance|available|price|units|fee|feeAmount|fee_amount|buyerCredit|" +
  "minAmount|min_amount|minTrade|maxTrade|dailyWithdrawal|totalAmount|remaining|" +
  "perTxMax|dailyMax|dualApprovalThreshold|autoApproveBelow|" +
  "per_tx_max|daily_max|dual_approval_threshold|auto_approve_below";

const MONEY_NUMBER_BAN = [
  {
    selector: "CallExpression[callee.name='parseFloat']",
    message: "No floats in money paths.",
  },
  {
    selector: "CallExpression[callee.name='Number'] > Identifier[name=/amount|fee|balance|price/i]",
    message: "Never convert money to number — keep bigint.",
  },
  {
    // Member-expression money (e.g. Number(caps.perTxMax), Number(row.amount)).
    selector: `CallExpression[callee.name='Number'] > MemberExpression[property.name=/^(${MONEY_MEMBER_NAMES})$/]`,
    message: "Never convert money (smallest units) to number — keep bigint / use fromDisplay.",
  },
];

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ],
      "no-restricted-globals": ["error", { name: "eval", message: "eval is banned." }]
    },
  },
  {
    files: MONEY_PATHS,
    rules: {
      // Documents/02: `any` and `as unknown as` double-casts are BANNED on money
      // paths (a single narrowing `x as T` is allowed — e.g. caught-error codes).
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "as", objectLiteralTypeAssertions: "never" }
      ],
      "no-restricted-syntax": [
        "error",
        {
          // `x as unknown as T` parses as (x as unknown) as T — ban the escape hatch.
          selector: "TSAsExpression[expression.type='TSAsExpression']",
          message: "No `as unknown as` double-casts on money paths (Documents/02).",
        },
        {
          selector: "TSAsExpression > TSUnknownKeyword",
          message: "No `as unknown` widening on money paths — narrow with a type guard.",
        },
        ...MONEY_NUMBER_BAN,
      ],
    },
  },
  {
    // Money-number ban only (no cast/non-null rules) for settings + admin.
    files: MONEY_NUMBER_PATHS,
    rules: {
      "no-restricted-syntax": ["error", ...MONEY_NUMBER_BAN],
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "vitest.config.ts", "eslint.config.mjs"],
  },
);
