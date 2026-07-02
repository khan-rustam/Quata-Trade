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
      include: ["src/modules/ledger/**", "src/modules/fees/**", "src/modules/escrow/**"],
      thresholds: {
        // Documents/09: 100% branch on ledger/escrow/fees
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});
