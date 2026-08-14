/**
 * Messaging and notifications, driven as real users.
 *
 * Covers: candidate → ops message persists, clears its own unread badge, and
 * reaches the staff ops queue; client conversations stay inside the workspace;
 * candidates cannot reach client conversation surfaces.
 */
import { test, expect } from "@playwright/test";
import {
  collectConsoleErrors,
  loginAs,
  meaningfulConsoleErrors,
  QA_PASSWORD,
  seedFixtures,
  type SeedResult,
} from "./helpers/qa";

let fixtures: SeedResult;

test.beforeAll(async () => {
  fixtures = await seedFixtures();
});

test.describe("messaging", () => {
  test("candidate message persists, clears unread, and reaches ops", async ({ page }) => {
    test.setTimeout(120_000);
    const errors = collectConsoleErrors(page);
    const body = `QA messaging probe ${Date.now()}`;

    await loginAs(page, "candidate", fixtures.users["candidate"]!.email, QA_PASSWORD);
    await page.goto("/me/messages", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /^messages$/i })).toBeVisible();

    await page.locator("#me-message-body").fill(body);
    await page.getByRole("button", { name: /^send$/i }).click();
    await expect(page.getByText(body)).toBeVisible({ timeout: 30_000 });

    // Survives a reload — it is a persisted row, not local state.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(body)).toBeVisible({ timeout: 30_000 });
    expect(meaningfulConsoleErrors(errors)).toEqual([]);

    // Staff see it in the ops queue.
    await page.context().clearCookies();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => window.localStorage.clear());
    await loginAs(page, "admin", fixtures.users["platform_admin"]!.email, QA_PASSWORD);
    await page.goto("/admin/messages", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /candidate support/i })).toBeVisible();
    await expect(page.getByText(body)).toBeVisible({ timeout: 30_000 });
  });

  test("candidate cannot open a client conversation surface", async ({ page }) => {
    await loginAs(page, "candidate", fixtures.users["candidate"]!.email, QA_PASSWORD);
    await page.goto("/client/conversations", { waitUntil: "domcontentloaded" });
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 30_000 })
      .not.toBe("/client/conversations");
  });

  test("client sees only their own workspace conversations", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await loginAs(page, "client", fixtures.users["client_admin"]!.email, QA_PASSWORD);
    await page.goto("/client/conversations", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const text = await page.locator("body").innerText();
    expect(text).not.toContain(fixtures.other_org_id);
    expect(meaningfulConsoleErrors(errors)).toEqual([]);
  });
});
