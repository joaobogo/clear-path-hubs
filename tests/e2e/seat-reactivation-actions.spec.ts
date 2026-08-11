/**
 * Blocked-reactivation dialog — do its buttons actually take the admin somewhere?
 *
 * The remedies are only useful if the jumps work: the invite jump has to close
 * the dialog and flash the pending invitation row, the team jump has to flash
 * the roster, and the upgrade button has to land on the plan tab where seats
 * are bought. Each case drives the real team tab against the QA workspace.
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import {
  QA_PASSWORD,
  loginAs,
  resetSeatScenario,
  seedFixtures,
  seedSeatScenario,
} from "./helpers/qa";

const CLIENT_ADMIN = "qa.clientadmin@qa.taasflow.test";
const SUSPENDED_ROW = 'li[data-member-status="suspended"]';
const PENDING_ROW = 'li[data-member-status="invited"]';

test.beforeAll(async () => {
  await seedFixtures();
});

test.afterAll(async () => {
  await resetSeatScenario();
});

/** Opens the team tab and returns the suspended member's row. */
async function openTeamTab(page: Page): Promise<Locator> {
  await page.goto("/client/account?tab=team", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#team-members")).toBeVisible({ timeout: 30_000 });
  const row = page.locator(SUSPENDED_ROW).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  return row;
}

/** Triggers the refusal and returns the dialog. */
async function openBlockedDialog(page: Page, row: Locator): Promise<Locator> {
  await row.getByRole("button", { name: /member actions/i }).click();
  await page.getByRole("menuitem", { name: /reactivate/i }).click();
  const dialog = page.getByTestId("reactivate-blocked-dialog");
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  return dialog;
}

test.describe("reactivation blocked dialog actions", () => {
  test("the invite jump closes the dialog and flashes the pending invitation", async ({ page }) => {
    await seedSeatScenario({ pendingInvites: 1, extraActive: true });
    await loginAs(page, "client", CLIENT_ADMIN, QA_PASSWORD);
    const dialog = await openBlockedDialog(page, await openTeamTab(page));

    const pending = page.locator(PENDING_ROW).first();
    await page.getByTestId("reactivate-blocked-cancel-invite").click();

    await expect(dialog).toBeHidden();
    // The flash is a transient attribute on the exact row to change.
    await expect(pending).toHaveAttribute("data-highlight", "true");
    await expect(pending).toBeInViewport();
    // ...and it clears itself, so the roster does not stay lit up.
    await expect(pending).not.toHaveAttribute("data-highlight", "true", { timeout: 10_000 });
    // The invitation is still there: the jump points at it, it does not cancel it.
    await expect(pending).toBeVisible();
    await expect(pending.getByRole("button", { name: /member actions/i })).toBeVisible();
  });

  test("the team jump closes the dialog and flashes the roster", async ({ page }) => {
    // No pending invitations, so the first actionable remedy is the team jump.
    await seedSeatScenario({ pendingInvites: 0, extraActive: true });
    await loginAs(page, "client", CLIENT_ADMIN, QA_PASSWORD);
    const dialog = await openBlockedDialog(page, await openTeamTab(page));

    await expect(page.getByTestId("reactivate-blocked-cancel-invite")).toHaveCount(0);
    await page.getByTestId("reactivate-blocked-open-team").click();

    await expect(dialog).toBeHidden();
    const roster = page.locator("#team-members");
    await expect(roster).toHaveAttribute("data-highlight", "true");
    await expect(roster).toBeInViewport();
    await expect(roster).not.toHaveAttribute("data-highlight", "true", { timeout: 10_000 });
  });

  test("the upgrade button opens the plan tab", async ({ page }) => {
    await seedSeatScenario({ pendingInvites: 1, extraActive: true });
    await loginAs(page, "client", CLIENT_ADMIN, QA_PASSWORD);
    const dialog = await openBlockedDialog(page, await openTeamTab(page));

    const upgrade = page.getByTestId("reactivate-blocked-upgrade").getByRole("link");
    await expect(upgrade).toBeVisible();
    await upgrade.click();

    await expect(page).toHaveURL(/tab=plan/, { timeout: 15_000 });
    await expect(dialog).toHaveCount(0);
    // The plan surface, not a blank tab: seat capacity has to be readable here.
    await expect(page.getByRole("main")).toContainText(/plan/i, { timeout: 30_000 });
  });

  test("the seats conversation button points at the call booking page", async ({ page }) => {
    await seedSeatScenario({ pendingInvites: 1, extraActive: true });
    await loginAs(page, "client", CLIENT_ADMIN, QA_PASSWORD);
    const dialog = await openBlockedDialog(page, await openTeamTab(page));

    const talk = dialog.getByRole("link", { name: /talk to us about seats/i });
    await expect(talk).toHaveAttribute("href", /\/book-call/);
    await talk.click();
    await expect(page).toHaveURL(/\/book-call/, { timeout: 15_000 });
  });

  test("closing the dialog leaves the member suspended", async ({ page }) => {
    await seedSeatScenario({ pendingInvites: 1, extraActive: true });
    await loginAs(page, "client", CLIENT_ADMIN, QA_PASSWORD);
    const row = await openTeamTab(page);
    const dialog = await openBlockedDialog(page, row);

    await dialog.getByRole("button", { name: /^close$/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator(SUSPENDED_ROW).first()).toBeVisible();
  });
});
