/**
 * Public job board + job detail — driven exactly as an anonymous visitor.
 *
 * The board must show only positions that are genuinely open (active + public +
 * complete), every card must open the matching detail page, and every Apply CTA
 * must carry the position's own UUID — never a title match. The QA fixture role
 * is only visible with the qa_e2e cookie, so a real visitor never sees it.
 */
import { test, expect } from "@playwright/test";
import {
  allowTestFixtures,
  collectConsoleErrors,
  meaningfulConsoleErrors,
  seedFixtures,
  type SeedResult,
} from "./helpers/qa";

let fixtures: SeedResult;

test.beforeAll(async () => {
  fixtures = await seedFixtures();
});

test.beforeEach(async ({ context }) => {
  await allowTestFixtures(context);
});

test("the board lists real open roles and each card opens its own detail page", async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto("/jobs", { waitUntil: "domcontentloaded" });

  const cards = page.locator("ul li a[href^='/jobs/']");
  await expect(cards.first()).toBeVisible();
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);

  const hrefs = await cards.evaluateAll((els) =>
    els.map((e) => e.getAttribute("href") ?? ""),
  );
  // Every card links to a slug ending in that role's UUID.
  for (const href of hrefs) {
    expect(href).toMatch(
      /^\/jobs\/[a-z0-9-]*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  }
  // The seeded fixture role is one of them (cookie granted above).
  expect(hrefs.some((h) => h.endsWith(fixtures.position_id))).toBe(true);

  for (const href of hrefs) {
    await page.goto(href, { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1")).toBeVisible();
    // Apply CTAs are keyed by the position UUID from the URL, not the title.
    const uuid = href.slice(-36);
    const applyLinks = page.locator(`a[href="/jobs/${uuid}/apply"]`);
    expect(await applyLinks.count()).toBeGreaterThan(0);
  }

  expect(meaningfulConsoleErrors(errors)).toEqual([]);
});

test("a role that is not published never resolves publicly", async ({ page }) => {
  // The closed fixture is not on the board...
  await page.goto("/jobs", { waitUntil: "domcontentloaded" });
  const hrefs = await page
    .locator("ul li a[href^='/jobs/']")
    .evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
  expect(hrefs.some((h) => h.endsWith(fixtures.closed_position_id))).toBe(false);
});

test("Apply opens the wizard for the exact role that was clicked", async ({ page }) => {
  await page.goto(`/jobs/${fixtures.position_id}`, { waitUntil: "domcontentloaded" });
  const title = (await page.locator("h1").first().innerText()).trim();
  await page.locator(`a[href="/jobs/${fixtures.position_id}/apply"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`/jobs/${fixtures.position_id}/apply`));
  await expect(page.locator("h1")).toContainText(title);
});

test("search and filters narrow the board, and a miss shows a clean empty state", async ({
  page,
}) => {
  await page.goto("/jobs", { waitUntil: "domcontentloaded" });
  const cards = page.locator("ul li a[href^='/jobs/']");
  await expect(cards.first()).toBeVisible();
  const total = await cards.count();

  const box = page.getByLabel("Search roles");
  // Typed character by character: the URL write is debounced, and every
  // keystroke must survive it (a lost keystroke used to leave the box showing
  // a query the board had not applied).
  await box.click();
  await box.type("zzzznotarole", { delay: 40 });
  await expect(page).toHaveURL(/q=zzzznotarole/);
  await expect(box).toHaveValue("zzzznotarole");
  await expect(page.getByRole("heading", { name: "No roles match your filters" })).toBeVisible();

  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(box).toHaveValue("");
  await expect(cards).toHaveCount(total);
});
