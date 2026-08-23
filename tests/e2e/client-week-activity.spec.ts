/**
 * "This week" consistency gate for /client.
 *
 * The overview shows the weekly interview and decision counts twice: as tiles in
 * the "This week" card, and as a summary line above the Recent activity feed.
 * Both must come from the same selector, so this spec reloads the page and
 * asserts:
 *
 *   1. Card tile count === summary-line count, for interviews and decisions.
 *   2. The numbers survive a reload unchanged (no per-render recomputation).
 *   3. The rendered supporting rows never exceed the count they belong to:
 *      the roles listed under a tile, and the decision rows in the feed.
 *
 * Credentials come from the environment; the spec skips loudly when absent.
 */
import { test, expect, type Page } from "@playwright/test";

const EMAIL = process.env["DEMO_CLIENT_EMAIL"];
const PASSWORD = process.env["DEMO_CLIENT_PASSWORD"];
const WORKSPACE = process.env["DEMO_CLIENT_WORKSPACE"] ?? "Northwind Talent (Demo)";

/** Decision events the feed renders, in the client-facing wording it uses. */
const DECISION_ROW_TEXT = [
  "You shortlisted a candidate",
  "You requested an interview",
  "An offer was made",
  "A hire was confirmed",
  "A candidate was declined",
  "Interview feedback was captured",
];

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

type WeekCounts = {
  /** Counts read from the "This week" card tiles (null when the card says no movement). */
  card: { interviews: number | null; decisions: number | null };
  /** Counts read from the summary line above the Recent activity feed. */
  summary: { interviews: number | null; decisions: number | null };
  /** Roles listed under each tile — supporting rows, never more than the count. */
  roleChips: { interviews: number; decisions: number };
  /** Decision-shaped rows rendered in the Recent activity feed. */
  decisionRows: number;
  noMovement: boolean;
};

/** Reads a tile's number by its label inside the "This week" card. */
async function readTile(page: Page, label: RegExp) {
  const card = page.locator('section[aria-label="This week"]');
  const tile = card.locator("div", { has: card.locator("dt", { hasText: label }) });
  const dt = card.getByRole("term").filter({ hasText: label }).first();
  if (!(await dt.count())) return { count: null as number | null, roles: 0 };
  const block = dt.locator("xpath=..");
  const countText = (await block.locator("dd").first().innerText()).trim();
  const roleLine = block.locator("p");
  const rolesText = (await roleLine.count()) ? (await roleLine.first().innerText()).trim() : "";
  void tile;
  return {
    count: Number.parseInt(countText.replace(/[^\d-]/g, ""), 10),
    roles: rolesText ? rolesText.split(",").filter((s) => s.trim().length > 0).length : 0,
  };
}

async function readWeekCounts(page: Page): Promise<WeekCounts> {
  const card = page.locator('section[aria-label="This week"]');
  await expect(card).toBeVisible({ timeout: 45_000 });
  const noMovement = await card.getByText(/no movement this week/i).isVisible().catch(() => false);

  const interviews = noMovement
    ? { count: 0, roles: 0 }
    : await readTile(page, /interviews? held/i);
  const decisions = noMovement
    ? { count: 0, roles: 0 }
    : await readTile(page, /decisions? made/i);

  // Summary line above the Recent activity feed.
  const summaryLine = page.getByText(/^This week: \d+ interviews? held · \d+ decisions? recorded$/);
  await expect(summaryLine).toBeVisible({ timeout: 45_000 });
  const summaryText = (await summaryLine.innerText()).trim();
  const match = summaryText.match(/This week: (\d+) interviews? held · (\d+) decisions? recorded/);
  expect(match, `unparseable summary line: ${summaryText}`).not.toBeNull();

  // Decision rows in the feed — the list is capped, so this is a lower bound.
  const feed = page
    .locator("div", { has: page.getByText(/since your last visit|recent activity/i) })
    .last();
  let decisionRows = 0;
  for (const text of DECISION_ROW_TEXT) {
    decisionRows += await feed.getByText(text, { exact: false }).count();
  }

  return {
    card: { interviews: interviews.count, decisions: decisions.count },
    summary: { interviews: Number(match![1]), decisions: Number(match![2]) },
    roleChips: { interviews: interviews.roles, decisions: decisions.roles },
    decisionRows,
    noMovement,
  };
}

test.describe("client overview — weekly counts", () => {
  test.skip(!EMAIL || !PASSWORD, "DEMO_CLIENT_EMAIL/PASSWORD not set");

  test("weekly interview and decision counts agree with the rendered lists", async ({ page }) => {
    await loginDemoClient(page);
    await page.goto("/client", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /overview/i }).first()).toBeVisible({
      timeout: 45_000,
    });

    const first = await readWeekCounts(page);

    // 1. The card and the activity summary read the same numbers.
    if (!first.noMovement) {
      expect(first.card.interviews).toBe(first.summary.interviews);
      expect(first.card.decisions).toBe(first.summary.decisions);
    } else {
      expect(first.summary.interviews).toBe(0);
      expect(first.summary.decisions).toBe(0);
    }

    // 3. Supporting rows never exceed the count they belong to.
    expect(first.roleChips.interviews).toBeLessThanOrEqual(first.summary.interviews);
    expect(first.roleChips.decisions).toBeLessThanOrEqual(first.summary.decisions);
    expect(first.decisionRows).toBeLessThanOrEqual(first.summary.decisions);
    if (first.summary.decisions > 0) {
      // A non-zero decision count must be visible as at least one feed row.
      expect(first.decisionRows).toBeGreaterThan(0);
    }

    // 2. A reload recomputes both surfaces and must land on the same numbers.
    await page.reload({ waitUntil: "domcontentloaded" });
    const second = await readWeekCounts(page);

    expect(second.summary.interviews).toBe(first.summary.interviews);
    expect(second.summary.decisions).toBe(first.summary.decisions);
    if (!second.noMovement) {
      expect(second.card.interviews).toBe(second.summary.interviews);
      expect(second.card.decisions).toBe(second.summary.decisions);
    }
  });
});
