import { expect, test } from "@playwright/test";
import { QA_PASSWORD, collectConsoleErrors, loginAs, meaningfulConsoleErrors, seedFixtures, type SeedResult } from "./helpers/qa";
let fixtures: SeedResult;
test.beforeAll(async () => { fixtures = await seedFixtures(); });
test("localize", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const mark = (s: string) => console.log("STEP", s, JSON.stringify(meaningfulConsoleErrors(errors)));
  await loginAs(page, "admin", fixtures.users["platform_admin"]!.email, QA_PASSWORD);
  mark("login");
  await page.goto("/admin/health", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000); mark("health");
  const tiles = page.locator('a[aria-label^="Open candidates in state"]');
  console.log("tiles", await tiles.count());
  await tiles.first().click(); await page.waitForTimeout(5000); mark("tileclick " + page.url());
  await page.goto("/admin/health", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(5000); mark("back");
  for (const l of ["Bounces","Complaints","Unsubscribes","Everything"]) {
    const b = page.getByRole("button", { name: l, exact: true });
    if (await b.count()) { await b.first().click(); await page.waitForTimeout(800); mark("btn " + l); }
  }
  expect(true).toBe(true);
});
