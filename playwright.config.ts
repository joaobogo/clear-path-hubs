import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config for the two highest-value public entry flows (/intake, /book).
 * Uses the dev server already listening on :8080 — never starts a second one.
 */

/**
 * The sandbox ships a preinstalled Chromium whose build number can differ from
 * the one this Playwright release expects, so we point at it explicitly instead
 * of downloading a second browser.
 */
const SANDBOX_CHROMIUM = "/opt/ms-playwright/chromium-1194/chrome-linux/chrome";
const executablePath =
  process.env["E2E_CHROMIUM_PATH"] ??
  (existsSync(SANDBOX_CHROMIUM) ? SANDBOX_CHROMIUM : undefined);

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:8080",
    trace: "off",
    screenshot: "only-on-failure",
    // Without these, Playwright actions wait forever, so a single missing
    // control burns the whole test timeout with no useful failure message.
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
    ...devices["Desktop Chrome"],
    launchOptions: { executablePath },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } },
    },
  ],
});

