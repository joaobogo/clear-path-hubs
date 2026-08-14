import { expect, test } from "@playwright/test";
import { QA_PASSWORD, loginAs, seedFixtures, type SeedResult } from "./helpers/qa";
let fixtures: SeedResult;
test.beforeAll(async () => { fixtures = await seedFixtures(); });
test("localize", async ({ page }) => {
  page.on("console", async (m) => {
    if (m.type() !== "error") return;
    const txt = m.text();
    if (!txt.includes("hasn't mounted")) return;
    console.log("LOCATION", JSON.stringify(m.location()));
    for (const a of m.args()) {
      try { console.log("ARG", String(await a.jsonValue()).slice(0, 1200)); } catch {}
    }
  });
  await loginAs(page, "admin", fixtures.users["platform_admin"]!.email, QA_PASSWORD);
  await page.goto("/admin/health", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  await page.locator('a[aria-label^="Open candidates in state"]').first().click();
  await page.waitForTimeout(4000);
  await page.goto("/admin/health", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  expect(true).toBe(true);
});
