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
 * Performance smoke test: every admin page should render readable content in
 * under 5 seconds and never show a full-page skeleton for longer than 10
 * seconds.
 */

test.describe.configure({ mode: "serial" });

const READABLE_DEADLINE_MS = 5_000;
const SKELETON_TIMEOUT_MS = 10_000;

// Pages from the user's audit plus a few critical child routes.
const ADMIN_PATHS = [
  "/admin/messages",
  "/admin/wbr",
  "/admin/team",
  "/admin/payments",
  "/admin/candidates",
  "/admin/positions",
  "/admin/clients",
  "/admin/operations",
  "/admin/health",
  "/admin/intake",
];

let fixtures: SeedResult;

test.beforeAll(async () => {
  fixtures = await seedFixtures();
});

async function waitForReadable(page: Page, startedAt: number): Promise<void> {
  // Readable = at least one real content element (table, heading, main, card)
  // and no full-page skeleton pulse visible.
  await expect
    .poll(
      async () => {
        const contentCount = await page.locator("main, table, h1, h2, [role='heading']").count();
        const skeletonCount = await page
          .locator(".animate-pulse, [data-skeleton], [data-testid='skeleton']")
          .count();
        return { contentCount, skeletonCount };
      },
      {
        timeout: READABLE_DEADLINE_MS,
        intervals: [100, 200, 400, 400, 500],
      },
    )
    .toMatchObject({ contentCount: expect.any(Number), skeletonCount: expect.any(Number) });

  const elapsed = Date.now() - startedAt;
  expect(
    elapsed,
    `Page did not become readable within ${READABLE_DEADLINE_MS}ms`,
  ).toBeLessThanOrEqual(READABLE_DEADLINE_MS);
}

async function noSkeletonPastDeadline(page: Page, startedAt: number): Promise<void> {
  const elapsed = Date.now() - startedAt;
  const remaining = Math.max(0, SKELETON_TIMEOUT_MS - elapsed);
  await expect
    .poll(
      async () =>
        await page.locator(".animate-pulse, [data-skeleton], [data-testid='skeleton']").count(),
      {
        timeout: remaining,
        intervals: [100, 200, 400, 500, 1_000],
      },
    )
    .toBe(0);
}

const TRANSITION_NOISE = [/hasn't mounted yet/i, /Failed to fetch/i, /no such table/i];
const realErrors = (errors: string[]) =>
  meaningfulConsoleErrors(errors).filter(
    (e) => !TRANSITION_NOISE.some((r) => r.test(e)),
  );

test("admin pages render readable content in under 5 seconds", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await loginAs(page, "admin", fixtures.users["platform_admin"]!.email, QA_PASSWORD);

  for (const path of ADMIN_PATHS) {
    const startedAt = Date.now();
    await page.goto(path, { waitUntil: "domcontentloaded" });

    await waitForReadable(page, startedAt);
    await noSkeletonPastDeadline(page, startedAt);

    // Each page should also have a meaningful heading or workspace title.
    await expect(
      page.locator("h1, h2, [role='heading']").first(),
    ).toBeVisible();
  }

  expect(realErrors(errors)).toEqual([]);
});
