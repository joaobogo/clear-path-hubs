import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Playwright specs under tests/e2e are run by playwright.config.ts, not vitest.
    include: ["tests/**/*.{test,spec}.{ts,tsx}", "src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**", ".output/**"],
    setupFiles: ["tests/setup-workspace-timezone.ts"],
    // Several guards shell out — the vocabulary checks, the export masking
    // check, the stored-figures check — and a spawned Node process competing
    // with the rest of the suite regularly takes longer than the 5s default.
    // They passed alone in seconds and failed in the full run, which made the
    // suite report failures that had nothing to do with the change under test
    // and taught everyone to ignore it. This is a slow test, not a broken one.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
