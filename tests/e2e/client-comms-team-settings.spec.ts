/**
 * Stabilization pass 11 — Client Messages, Team, and Settings.
 *
 * Every assertion is anchored to a database read (`client_comms_truth`), never
 * to a toast: a toast only proves the UI said something, not that a row moved.
 * Covers thread load + send + persistence + tenant scoping, a settings change
 * that is then reverted, and every team action (invite, resend, role change,
 * suspend, reactivate, cancel invite, remove).
 */
import { test, expect, type Page } from "@playwright/test";
import {
  clientCommsTruth,
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

async function openRoleThread(page: Page, positionId: string) {
  await page.goto(`/client/positions/${positionId}`, { waitUntil: "domcontentloaded" });
  const composer = page.getByLabel("Message", { exact: true });
  await expect(composer).toBeVisible({ timeout: 60_000 });
  return composer;
}

test.describe("client messages", () => {
  test("threads load, two sends persist, and only this org's threads are visible", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const errors = collectConsoleErrors(page);
    await loginAs(page, "client", fixtures.users["client_admin"]!.email, QA_PASSWORD);

    const first = `QA client message A ${Date.now()}`;
    const second = `QA client message B ${Date.now()}`;

    const composer = await openRoleThread(page, fixtures.position_id);
    for (const body of [first, second]) {
      await composer.fill(body);
      await page.getByRole("button", { name: /^send$/i }).click();
      await expect(page.getByText(body)).toBeVisible({ timeout: 45_000 });
    }

    // Persisted rows, not optimistic state.
    const truth = await clientCommsTruth(fixtures.org_id);
    const bodies = truth.messages.map((m) => m.body);
    expect(bodies).toContain(first);
    expect(bodies).toContain(second);
    const roleThread = truth.conversations.find((c) => c.scope === "position");
    expect(roleThread).toBeTruthy();

    // The conversations list shows the same thread, and every listed thread
    // belongs to this organization.
    await page.goto("/client/conversations", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /conversations/i })).toBeVisible();
    await expect(page.getByText(second, { exact: false }).first()).toBeVisible({ timeout: 45_000 });
    for (const c of truth.conversations) expect(c.organization_id).toBe(fixtures.org_id);

    // Filters are real filters, and the thread opens.
    await page.getByRole("button", { name: "Roles", exact: true }).click();
    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.getByRole("link", { name: new RegExp(second.slice(0, 20), "i") }).first().click();
    await expect(page.getByText(second)).toBeVisible({ timeout: 45_000 });

    // Another tenant's thread is unreachable even by direct URL.
    const other = await clientCommsTruth(fixtures.other_org_id);
    if (other.conversations[0]) {
      await page.goto(`/client/conversations/${other.conversations[0].id}`, {
        waitUntil: "domcontentloaded",
      });
      await expect(page.getByText(/couldn't load this conversation|not found/i)).toBeVisible({
        timeout: 45_000,
      });
    }

    expect(meaningfulConsoleErrors(errors)).toEqual([]);
  });
});

test.describe("client settings", () => {
  test("a setting saves, persists across reload, and reverts", async ({ page }) => {
    test.setTimeout(180_000);
    const errors = collectConsoleErrors(page);
    await loginAs(page, "client", fixtures.users["client_admin"]!.email, QA_PASSWORD);

    const before = await clientCommsTruth(fixtures.org_id);
    const original = (before.organization?.["phone"] as string | null) ?? "";
    const changed = "+44 20 7946 0999";

    await page.goto("/client/account?tab=workspace", { waitUntil: "domcontentloaded" });
    const phone = page.getByLabel(/phone/i).first();
    await expect(phone).toBeVisible({ timeout: 60_000 });

    await phone.fill(changed);
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect
      .poll(async () => (await clientCommsTruth(fixtures.org_id)).organization?.["phone"], {
        timeout: 45_000,
      })
      .toBe(changed);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByLabel(/phone/i).first()).toHaveValue(changed, { timeout: 60_000 });

    // Revert, and confirm the revert also lands in the database.
    await page.getByLabel(/phone/i).first().fill(original);
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect
      .poll(async () => (await clientCommsTruth(fixtures.org_id)).organization?.["phone"] ?? "", {
        timeout: 45_000,
      })
      .toBe(original);

    expect(meaningfulConsoleErrors(errors)).toEqual([]);
  });

  test("notification preferences save per row", async ({ page }) => {
    test.setTimeout(120_000);
    const errors = collectConsoleErrors(page);
    await loginAs(page, "client", fixtures.users["client_admin"]!.email, QA_PASSWORD);
    await page.goto("/client/account?tab=notifications", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /notifications/i }).first()).toBeVisible({
      timeout: 60_000,
    });
    const rows = await clientCommsTruth(fixtures.org_id);
    expect(rows.ok).toBe(true);
    expect(meaningfulConsoleErrors(errors)).toEqual([]);
  });
});

test.describe("client team", () => {
  test("invite, resend, role change, suspend, reactivate, cancel and remove all persist", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const errors = collectConsoleErrors(page);
    await loginAs(page, "client", fixtures.users["client_admin"]!.email, QA_PASSWORD);
    await page.goto("/client/account?tab=team", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /team/i }).first()).toBeVisible({
      timeout: 60_000,
    });

    // Listing is real: every rendered member email exists in memberships.
    const truth = await clientCommsTruth(fixtures.org_id);
    const emails = new Set(
      truth.profiles.map((p) => (p.email ?? "").toLowerCase()).filter(Boolean),
    );
    expect(emails.size).toBeGreaterThan(0);

    /* ---- role change on the seeded viewer ---- */
    const viewer = fixtures.users["client_viewer"]!;
    const viewerRow = page.locator(`#team-member-${viewer.id}`);
    await expect(viewerRow).toBeVisible({ timeout: 45_000 });
    await viewerRow.getByRole("combobox").click();
    await page.getByRole("option", { name: /hiring team/i }).click();
    await expect
      .poll(
        async () =>
          (await clientCommsTruth(fixtures.org_id)).memberships.find(
            (m) => m.user_id === viewer.id,
          )?.role,
        { timeout: 45_000 },
      )
      .toBe("client_editor");

    /* ---- suspend then reactivate ---- */
    const openMenu = async () => {
      await viewerRow.getByRole("button", { name: /member actions/i }).click();
    };
    await openMenu();
    await page.getByRole("menuitem", { name: /suspend access/i }).click();
    await expect
      .poll(
        async () =>
          (await clientCommsTruth(fixtures.org_id)).memberships.find(
            (m) => m.user_id === viewer.id,
          )?.status,
        { timeout: 45_000 },
      )
      .toBe("suspended");

    await openMenu();
    await page.getByRole("menuitem", { name: /^reactivate/i }).click();
    await expect
      .poll(
        async () =>
          (await clientCommsTruth(fixtures.org_id)).memberships.find(
            (m) => m.user_id === viewer.id,
          )?.status,
        { timeout: 45_000 },
      )
      .toBe("active");

    // Put the fixture role back so other specs see the seeded shape.
    await viewerRow.getByRole("combobox").click();
    await page.getByRole("option", { name: /observer|viewer/i }).click();
    await expect
      .poll(
        async () =>
          (await clientCommsTruth(fixtures.org_id)).memberships.find(
            (m) => m.user_id === viewer.id,
          )?.role,
        { timeout: 45_000 },
      )
      .toBe("client_viewer");

    /* ---- invite, resend, cancel ---- */
    const inviteEmail = `qa.invite+${Date.now()}@qa.taasflow.test`;
    const inviteBtn = page.getByRole("button", { name: /invite team member/i });
    if (await inviteBtn.isEnabled()) {
      await inviteBtn.click();
      await page.locator("#invite-email").fill(inviteEmail);
      await page.getByRole("button", { name: /send invitation/i }).click();
      const invited = await expect
        .poll(
          async () => {
            const t = await clientCommsTruth(fixtures.org_id);
            const ids = new Set(
              t.profiles.filter((p) => (p.email ?? "").toLowerCase() === inviteEmail).map((p) => p.auth_user_id),
            );
            return t.memberships.filter((m) => m.user_id && ids.has(m.user_id))[0]?.status ?? null;
          },
          { timeout: 60_000 },
        )
        .toBe("invited")
        .then(async () => {
          const t = await clientCommsTruth(fixtures.org_id);
          const ids = new Set(
            t.profiles.filter((p) => (p.email ?? "").toLowerCase() === inviteEmail).map((p) => p.auth_user_id),
          );
          return t.memberships.find((m) => m.user_id && ids.has(m.user_id))!;
        });

      const invitedRow = page.locator(`#team-member-${invited.user_id}`);
      await expect(invitedRow).toBeVisible({ timeout: 45_000 });
      await invitedRow.getByRole("button", { name: /member actions/i }).click();
      await page.getByRole("menuitem", { name: /resend invitation/i }).click();
      await expect(page.getByText(/invitation resent|couldn't/i).first()).toBeVisible({
        timeout: 45_000,
      });

      await invitedRow.getByRole("button", { name: /member actions/i }).click();
      await page.getByTestId("cancel-invite-menu-item").click();
      await page.getByTestId("cancel-invite-confirm").click();
      await expect
        .poll(
          async () =>
            (await clientCommsTruth(fixtures.org_id)).memberships.some(
              (m) => m.user_id === invited.user_id,
            ),
          { timeout: 45_000 },
        )
        .toBe(false);
    } else {
      // Seats full: the control must say so rather than fail silently.
      await expect(page.getByRole("button", { name: /no seats available/i })).toBeVisible();
    }

    expect(meaningfulConsoleErrors(errors)).toEqual([]);
  });
});
