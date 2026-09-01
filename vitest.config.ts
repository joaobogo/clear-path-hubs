import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Shared helpers for guard tests, importable from src/**/__tests__ too.
      "@tests": fileURLToPath(new URL("./tests", import.meta.url)),
    },
  },
  test: {
    // Playwright specs under tests/e2e are run by playwright.config.ts, not vitest.
    include: ["tests/**/*.{test,spec}.{ts,tsx}", "src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**", ".output/**"],
    setupFiles: ["tests/setup-workspace-timezone.ts"],
    // Some guards spawn a Node process and compete with the rest of the suite,
    // taking longer than the 5s default. They passed alone and failed in the
    // full run, which made the suite report failures unrelated to the change
    // under test and taught everyone to ignore it.
    //
    // Guards that scan SOURCE no longer shell out at all — see
    // tests/helpers/scan-source.ts. Three of them could not run on Windows
    // (`spawnSync /bin/bash ENOENT`) and had been filed as environmental for
    // long enough to stop being read.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
