import { test, expect, type Page } from "@playwright/test";
import { clientKpiTruth, meaningfulConsoleErrors } from "./helpers/qa";

const EMAIL = process.env["DEMO_CLIENT_EMAIL"];
const PASSWORD = process.env["DEMO_CLIENT_PASSWORD"];
const WORKSPACE = process.env["DEMO_CLIENT_WORKSPACE"] ?? "Northwind Talent (Demo)";
const NORTHWIND_ORG_ID = "0c86fa1b-94ee-46b8-9a11-a42cee39bfed";

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

async function signOut(page: Page) {
  await page.goto("/client/account", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /sign out/i }).first().click().catch(() => undefined);
  await expect
    .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
    .toMatch(/^\/(login)?$/);
}

test.describe("demo client walkthrough", () => {
  test.skip(!EMAIL || !PASSWORD, "DEMO_CLIENT_EMAIL/PASSWORD not set");

  test("full demo path: login, workspace, shortlist, and sign out", async ({ page }) => {
    const errors = meaningfulConsoleErrors(page);

    // 1. Sign in and land on the Northwind client overview.
    await loginDemoClient(page);
    await page.goto("/client", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /overview/i }).first()).toBeVisible();
    await expect(page.getByText(/Northwind/i).first()).toBeVisible();

    // 2. Positions render with data.
    await page.goto("/client/positions", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /roles|positions/i }).first()).toBeVisible();
    await expect(page.getByRole("link").first()).toBeVisible({ timeout: 30_000 });

    // 3. Candidates list renders with at least one row.
    await page.goto("/client/candidates?review=all", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /candidates/i }).first()).toBeVisible();
    const rows = page.locator("main table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });
    expect(await rows.count()).toBeGreaterThan(0);

    // 4. Open the first candidate detail.
    const firstCandidate = page.locator("main table tbody tr a").first();
    await firstCandidate.waitFor({ state: "visible", timeout: 30_000 });
    await firstCandidate.click();
    await expect.poll(() => new URL(page.url()).pathname).toMatch(/\/client\/candidates\/.+/);
    await expect(page.getByText(/score|fit|shortlist/i).first()).toBeVisible();

    // 5. Shortlist the candidate and confirm the backend recorded it.
    const before = await clientKpiTruth(NORTHWIND_ORG_ID);
    const shortlistBtn = page.getByRole("button", { name: /Advance to shortlist/i }).first();
    await expect(shortlistBtn).toBeVisible({ timeout: 15_000 });
    await shortlistBtn.click();
    await page.waitForTimeout(1500);
    const after = await clientKpiTruth(NORTHWIND_ORG_ID);
    expect(after.shortlisted).toBe(before.shortlisted + 1);

    // 6. Undo the shortlist so the demo workspace stays clean.
    const undoBtn = page.getByRole("button", { name: "Undo" }).first();
    if (await undoBtn.isVisible().catch(() => false)) {
      await undoBtn.click();
      await page.waitForTimeout(1500);
    }

    // 7. Messages render.
    await page.goto("/client/messages", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /messages/i }).first()).toBeVisible();

    // 8. Settings / account render.
    await page.goto("/client/account", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /settings|account/i }).first()).toBeVisible();

    // 9. Sign out cleanly.
    await signOut(page);

    expect(errors, errors.join("\n")).toEqual([]);
  });
});
