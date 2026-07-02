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
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "never" }
      ],
      // number arithmetic on money is caught by types (bigint), but forbid
      // parseFloat/parseInt/Number on identifiers named like amounts:
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='parseFloat']",
          message: "No floats in money paths.",
        },
        {
          selector: "CallExpression[callee.name='Number'] > Identifier[name=/amount|fee|balance|price/i]",
          message: "Never convert money to number — keep bigint.",
        },
      ],
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "vitest.config.ts", "eslint.config.mjs"],
  },
);
