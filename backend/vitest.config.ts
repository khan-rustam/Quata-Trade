import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    // SWC keeps decorator metadata working when a test boots Nest modules.
    // ES module output — vitest cannot be require()d from CJS.
    swc.vite({ module: { type: "es6" } }),
  ],
  test: {
    globals: false,
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.spec.ts"],
          exclude: ["src/**/*.integration.spec.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/**/*.integration.spec.ts", "test/**/*.integration.spec.ts"],
          testTimeout: 180_000,
          hookTimeout: 180_000,
          // Testcontainers suites share one PG container per file; keep files serial.
          pool: "forks",
          poolOptions: { forks: { singleFork: true } },
        },
      },
    ],
    coverage: {
      provider: "v8",
      // Documents/09: 100% branch on the ledger/escrow/fees LOGIC. DI module
      // decorators (*.module.ts) and error-class files carry no branches; specs
      // are not production code.
      include: [
        "src/modules/ledger/ledger.service.ts",
        "src/modules/fees/fees.ts",
        "src/modules/escrow/escrow.service.ts",
      ],
      // Ratchet at the achieved floor so CI blocks regressions. The Documents/09
      // launch gate (100% branch on ledger/escrow/fees) still requires fault-
      // injection tests for the serialization-retry and unique-violation race
      // recovery paths — tracked in Documents/audits/gate-1.md before mainnet.
      thresholds: {
        branches: 84,
        functions: 100,
        lines: 93,
        statements: 93,
      },
    },
  },
});
