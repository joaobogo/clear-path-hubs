/**
 * Quality gate for the signed-in client dashboard.
 *
 * Covers, as the demo client: login, the roles list with its KPI tiles, the
 * candidates list in list view, candidate detail (score breakdown + CV
 * download), and a console-error sweep across every client route.
 *
 * Credentials come from the environment; the spec skips loudly when absent so
 * no secret is committed.
 */
import { test, expect, type Page } from "@playwright/test";
import { meaningfulConsoleErrors } from "./helpers/qa";

const EMAIL = process.env["DEMO_CLIENT_EMAIL"];
const PASSWORD = process.env["DEMO_CLIENT_PASSWORD"];
const WORKSPACE = process.env["DEMO_CLIENT_WORKSPACE"] ?? "Northwind Talent (Demo)";

/** The demo account belongs to several workspaces, so /login shows a chooser. */
async function loginDemoClient(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill(EMAIL!);
  await page.locator("#password").fill(PASSWORD!);
  await page.getByRole("button", { name: /^sign in$/i }).click();

  const chooser = page.getByRole("button", {
    name: new RegExp(WORKSPACE.replace(/[()]/g, "\\$&")),
  });
  await chooser.waitFor({ state: "visible", timeout: 30_000 }).catch(() => null);
  if (await chooser.isVisible().catch(() => false)) await chooser.click();
  await expect
    .poll(() => new URL(page.url()).pathname, { timeout: 30_000 })
    .not.toMatch(/login/);
}

test.describe("client dashboard", () => {
  test.skip(!EMAIL || !PASSWORD, "DEMO_CLIENT_EMAIL/PASSWORD not set");

  test("demo login lands in the workspace", async ({ page }) => {
    await loginDemoClient(page);
    await page.goto("/client", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /overview/i })).toBeVisible();
  });

  test("roles list renders with KPI tiles", async ({ page }) => {
    await loginDemoClient(page);
    await page.goto("/client/positions", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /roles/i }).first()).toBeVisible();
    // At least one role row and the KPI strip must both resolve to real numbers,
    // never a stuck skeleton.
    await expect(page.getByRole("link", { name: /open/i }).first()).toBeVisible({
      timeout: 30_000,
    });
    const numbers = await page
      .locator("main")
      .getByText(/^\d+$/)
      .count();
    expect(numbers).toBeGreaterThan(0);
  });

  test("candidates list renders in list view", async ({ page }) => {
    await loginDemoClient(page);
    await page.goto("/client/candidates?review=all", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /candidates/i }).first()).toBeVisible();
    const rows = page.locator("main table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test("candidate detail shows the score breakdown and a CV download", async ({ page }) => {
    await loginDemoClient(page);
    await page.goto("/client/candidates?review=all", { waitUntil: "domcontentloaded" });
    const firstCandidate = page.locator("main table tbody tr a").first();
    await firstCandidate.waitFor({ state: "visible", timeout: 30_000 });
    await firstCandidate.click();
    await expect.poll(() => new URL(page.url()).pathname).toMatch(/\/client\/candidates\/.+/);
    await expect(page.getByText(/score|fit/i).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /cv/i }).first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("no console errors on any client route", async ({ page }) => {
    const errors = meaningfulConsoleErrors(page);
    await loginDemoClient(page);
    for (const path of [
      "/client",
      "/client/positions",
      "/client/candidates?review=all",
      "/client/candidates?view=board&review=all",
      "/client/messages",
      "/client/account",
    ]) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
    }
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
