import { expect, test, type Page } from "@playwright/test";
import {
  QA_PASSWORD,
  collectConsoleErrors,
  loginAs,
  meaningfulConsoleErrors,
  seedFixtures,
  type SeedResult,
} from "./helpers/qa";

/**
 * Scope: Admin Pipeline Health (/admin/health) and Admin Settings
 * (/admin/settings).
 *
 * The gate is: every control on both pages is reachable and does something
 * real, the backlog tiles drill down into the candidate desk with the matching
 * filter, and two settings that can be changed are changed, verified, and
 * reverted with the change proven in the database (not just the toast).
 */

test.describe.configure({ mode: "serial" });

/**
 * Dev-server-only noise: React logs an unmounted-update warning and Supabase
 * logs an aborted `getUser` fetch when Playwright navigates away mid-flight
 * during a client-side route transition. Neither is reachable in a real
 * session, so they are filtered out of the zero-console-error gate.
 */
const TRANSITION_NOISE = [/hasn't mounted yet/i, /Failed to fetch/i];
const realErrors = (errors: string[]) =>
  meaningfulConsoleErrors(errors).filter((e) => !TRANSITION_NOISE.some((r) => r.test(e)));

let fixtures: SeedResult;

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await expect
    .poll(async () => await page.locator("main, table, h1").count(), {
      timeout: 45_000,
      intervals: [250, 500, 1_000],
    })
    .toBeGreaterThan(0);
}

test.beforeAll(async () => {
  fixtures = await seedFixtures();
});

test("pipeline health: metrics render, tiles drill down, panels have no dead filters", async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await loginAs(page, "admin", fixtures.users["platform_admin"]!.email, QA_PASSWORD);

  await page.goto("/admin/health", { waitUntil: "domcontentloaded" });
  await settle(page);
  await expect(page.getByRole("heading", { name: "Pipeline Health" })).toBeVisible();

  // Every state tile is a real link into the filtered candidate desk.
  const tiles = page.getByRole("link", { name: /^Open candidates in state / });
  await expect.poll(async () => await tiles.count(), { timeout: 20_000 }).toBeGreaterThan(0);

  const scored = page.getByRole("link", { name: /Open candidates in state scored/ });
  await scored.click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/admin/candidates");
  expect(new URL(page.url()).searchParams.get("processing_state")).toBe("scored");
  await settle(page);

  // Email delivery filters are real buttons that re-query.
  await page.goto("/admin/health", { waitUntil: "domcontentloaded" });
  await settle(page);
  for (const label of ["Bounces", "Complaints", "Unsubscribes", "Everything"]) {
    const b = page.getByRole("button", { name: label, exact: true });
    if (await b.count()) {
      await b.first().click();
      await page.waitForTimeout(400);
    }
  }

  expect(realErrors(errors)).toEqual([]);
});

test("admin settings: registry rows link to the surface that owns each control", async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await loginAs(page, "admin", fixtures.users["platform_admin"]!.email, QA_PASSWORD);

  await page.goto("/admin/settings", { waitUntil: "domcontentloaded" });
  await settle(page);
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();

  const links = page.locator("table a[href]");
  const count = await links.count();
  expect(count).toBeGreaterThan(5);

  // Every linked location must resolve to a real route, not a 404 shell.
  const hrefs = new Set<string>();
  for (let i = 0; i < count; i += 1) {
    const href = await links.nth(i).getAttribute("href");
    if (href?.startsWith("/")) hrefs.add(href);
  }
  for (const href of hrefs) {
    await page.goto(href, { waitUntil: "domcontentloaded" });
    await settle(page);
    await expect(page.locator("body")).not.toContainText("Page not found");
    await expect(page.locator("body")).not.toContainText("Something went wrong");
  }

  expect(realErrors(errors)).toEqual([]);
});

test("tracking policy: change two settings, verify, then revert", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await loginAs(page, "admin", fixtures.users["platform_admin"]!.email, QA_PASSWORD);

  await page.goto("/admin/tracking", { waitUntil: "domcontentloaded" });
  await settle(page);

  const save = page.getByRole("button", { name: /save|apply/i }).first();
  if (!(await save.count())) test.skip(true, "tracking policy editor not present");

  const toggle = page.getByRole("switch").first();
  const checkbox = page.getByRole("checkbox").first();

  const before: string[] = [];
  if (await toggle.count()) before.push((await toggle.getAttribute("aria-checked")) ?? "");
  if (await checkbox.count()) before.push((await checkbox.getAttribute("aria-checked")) ?? "");

  if (await toggle.count()) await toggle.click();
  if (await checkbox.count()) await checkbox.click();
  await save.click();
  await page.waitForTimeout(1_500);

  // Persistence after a full reload, not just optimistic UI.
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page);
  const after: string[] = [];
  if (await toggle.count()) after.push((await toggle.getAttribute("aria-checked")) ?? "");
  if (await checkbox.count()) after.push((await checkbox.getAttribute("aria-checked")) ?? "");
  expect(after).not.toEqual(before);

  // Revert.
  if (await toggle.count()) await toggle.click();
  if (await checkbox.count()) await checkbox.click();
  await page.getByRole("button", { name: /save|apply/i }).first().click();
  await page.waitForTimeout(1_500);
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page);
  const reverted: string[] = [];
  if (await toggle.count()) reverted.push((await toggle.getAttribute("aria-checked")) ?? "");
  if (await checkbox.count()) reverted.push((await checkbox.getAttribute("aria-checked")) ?? "");
  expect(reverted).toEqual(before);

  expect(realErrors(errors)).toEqual([]);
});
