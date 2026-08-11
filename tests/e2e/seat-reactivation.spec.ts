/**
 * Blocked-reactivation dialog — does it list the remedies that actually apply?
 *
 * Reactivating a suspended teammate spends a seat, so a full workspace refuses
 * it. The refusal has to explain what to change, and only offer changes this
 * workspace can make: no "cancel a pending invitation" when there is none, no
 * "suspend a teammate" when the admin is alone on the plan.
 *
 * Each case fills the QA workspace differently through the seed route, then
 * drives the real team tab.
 */
import { test, expect, type Page } from "@playwright/test";
import {
  QA_PASSWORD,
  loginAs,
  resetSeatScenario,
  seedFixtures,
  seedSeatScenario,
} from "./helpers/qa";

const CLIENT_ADMIN = "qa.clientadmin@qa.taasflow.test";
// Target the suspended row by its status attribute: the roster's profile join
// is not guaranteed for fixture users, so the visible name is not stable.
const SUSPENDED_ROW = 'li[data-member-status="suspended"]';

test.beforeAll(async () => {
  await seedFixtures();
});

test.afterAll(async () => {
  await resetSeatScenario();
});

/** Opens the team tab and returns the suspended member's row. */
async function openTeamTab(page: Page) {
  await page.goto("/client/account?tab=team", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#team-members")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("seat-limit-prompt")).toBeVisible({ timeout: 30_000 });
  const row = page.locator(SUSPENDED_ROW).first();
  await expect(row).toBeVisible();
  return row;
}

/** Triggers the refusal and returns the dialog. */
async function openBlockedDialog(page: Page, row: ReturnType<Page["locator"]>) {
  await row.getByRole("button", { name: /member actions/i }).click();
  await page.getByRole("menuitem", { name: /reactivate/i }).click();
  const dialog = page.getByTestId("reactivate-blocked-dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

const remedyIds = async (dialog: ReturnType<Page["locator"]>) =>
  dialog.locator("[data-remedy]").evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-remedy")),
  );

test.describe("reactivation blocked dialog remedies", () => {
  test("seats held by an invitation and a teammate: offers both jumps", async ({ page }) => {
    await seedSeatScenario({ pendingInvites: 1, extraActive: true });
    await loginAs(page, "client", CLIENT_ADMIN, QA_PASSWORD);
    const row = await openTeamTab(page);
    const dialog = await openBlockedDialog(page, row);

    expect(await remedyIds(dialog)).toEqual([
      "cancel_invite",
      "suspend_active",
      "remove_member",
      "add_seats",
    ]);
    await expect(dialog).toContainText("1 pending invitation");
    await expect(page.getByTestId("reactivate-blocked-cancel-invite")).toBeVisible();
    await expect(page.getByTestId("reactivate-blocked-open-team")).toBeVisible();
    await expect(page.getByTestId("reactivate-blocked-upgrade")).toBeVisible();

    // The invite jump closes the dialog and flashes the pending row to cancel.
    await page.getByTestId("reactivate-blocked-cancel-invite").click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('li[data-member-status="invited"]').first()).toBeVisible();
  });

  test("seats held only by active teammates: no invite remedy", async ({ page }) => {
    await seedSeatScenario({ pendingInvites: 0, extraActive: true });
    await loginAs(page, "client", CLIENT_ADMIN, QA_PASSWORD);
    const row = await openTeamTab(page);
    const dialog = await openBlockedDialog(page, row);

    expect(await remedyIds(dialog)).toEqual(["suspend_active", "remove_member", "add_seats"]);
    await expect(dialog).not.toContainText(/pending invitation/i);
    await expect(page.getByTestId("reactivate-blocked-cancel-invite")).toHaveCount(0);
    await expect(page.getByTestId("reactivate-blocked-open-team")).toBeVisible();
  });

  test("the dialog quotes the workspace's real seat numbers", async ({ page }) => {
    const scenario = await seedSeatScenario({ pendingInvites: 1, extraActive: false });
    await loginAs(page, "client", CLIENT_ADMIN, QA_PASSWORD);
    const row = await openTeamTab(page);
    const dialog = await openBlockedDialog(page, row);

    await expect(dialog).toContainText(
      `${scenario.seats_used} of ${scenario.seat_limit} seats are in use`,
    );
    // No Postgres trigger text ever reaches a client.
    await expect(dialog).not.toContainText(/seat_limit_exceeded/i);
  });

  test("reactivation succeeds once a seat is free", async ({ page }) => {
    // Same suspended teammate, but the workspace has room: no dialog, and the
    // reactivation goes through.
    await seedSeatScenario({ pendingInvites: 0, extraActive: false, freeSeats: true });

    await loginAs(page, "client", CLIENT_ADMIN, QA_PASSWORD);
    await page.goto("/client/account?tab=team", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#team-members")).toBeVisible({ timeout: 30_000 });
    const row = page.locator(SUSPENDED_ROW).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.getByRole("button", { name: /member actions/i }).click();
    const item = page.getByRole("menuitem", { name: /^reactivate$/i });
    await expect(item).toBeVisible();
    await item.click();
    await expect(page.getByTestId("reactivate-blocked-dialog")).toHaveCount(0);
    await expect(row).toContainText(/active/i);
  });
});
