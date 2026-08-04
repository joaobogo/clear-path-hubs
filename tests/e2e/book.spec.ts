/**
 * TEST 2 — /book, the single booking destination.
 *
 * Drives the intake step exactly as a visitor would, then verifies the
 * scheduler step either embeds the real calendar or degrades to the honest
 * fallback. Booking rows are namespaced qa.book+* and removed in teardown.
 */
import { expect, test, type Page } from "@playwright/test";
import { collectConsoleErrors, meaningfulConsoleErrors, qaSeed } from "./helpers/qa";

function prospect() {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return { stamp, email: `qa.book+${stamp}@qa.taasflow.test` };
}

const SELECTS: [string, string][] = [
  ["companySize", "51–200"],
  ["openRoles", "4–9"],
  ["hiringVolume", "6–15 hires this year"],
  ["hiringTimeline", "Within 30 days"],
  ["currentProcess", ""],
  ["heardAbout", ""],
];

async function fillIntake(page: Page, email: string, companyName: string) {
  await page.locator("#firstName").fill("Dana");
  await page.locator("#lastName").fill("Whitfield");
  await page.locator("#email").fill(email);
  await page.locator("#jobTitle").fill("Head of Talent");
  await page.locator("#companyName").fill(companyName);

  for (const [id, preferred] of SELECTS) {
    const select = page.locator(`#${id}`);
    const options = await select.locator("option").all();
    const values = (await Promise.all(options.map((o) => o.getAttribute("value")))).filter(
      (v): v is string => Boolean(v),
    );
    const value = preferred && values.includes(preferred) ? preferred : values[0]!;
    await select.selectOption(value);
  }

  await page.locator("#rolesHiring").fill("Clinical operations and data management");
  await page
    .locator("#hiringChallenge")
    .fill("Our inbound is large but unscreened, so hiring managers waste days on unqualified CVs.");
}

test.describe("TEST 2 — /book time booking", () => {
  test("required-field validation blocks Continue until the intake is complete", async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/book", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /book your hiring call/i })).toBeVisible();

    // Empty submit: stays on the intake step and explains what is missing.
    await page.getByRole("button", { name: /continue to choose a time/i }).click();
    await expect(page.getByText("Enter your first name")).toBeVisible();
    await expect(page.getByText("Enter your last name")).toBeVisible();
    await expect(page.getByText(/enter your work email/i)).toBeVisible();
    await expect(page.getByText("Enter your job title")).toBeVisible();
    await expect(page.getByText("Enter your company name")).toBeVisible();
    await expect(page.getByText(/which roles or departments/i).last()).toBeVisible();
    await expect(page.getByText(/biggest problem to solve/i).last()).toBeVisible();
    await expect(page.locator("#firstName")).toBeVisible();

    // Every required select must be flagged too, not silently accepted.
    for (const [id] of SELECTS) {
      await expect(page.locator(`#${id}`)).toHaveAttribute("aria-invalid", "true");
    }

    expect(meaningfulConsoleErrors(errors)).toEqual([]);
  });

  test("complete intake advances to the scheduler and records a booking session", async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    const { email, stamp } = prospect();
    const companyName = `QA_INTAKE_E2E_BOOK_${stamp}`;

    await page.goto("/book", { waitUntil: "domcontentloaded" });

    // The honeypot must exist and stay invisible to people.
    const honeypot = page.locator('input[name="website"]');
    await expect(honeypot).toHaveCount(1);
    await expect(honeypot).toBeHidden();

    await fillIntake(page, email, companyName);
    await page.getByRole("button", { name: /continue to choose a time/i }).click();

    // Scheduler step: either the real embed or the graceful fallback.
    const calendar = page.getByLabel("Booking calendar");
    await expect(calendar).toBeVisible({ timeout: 30_000 });

    const fallback = page.getByText(/calendar couldn't load in this browser/i);
    const embedded = calendar.locator("iframe");
    await expect
      .poll(async () => (await embedded.count()) > 0 || (await fallback.count()) > 0, {
        timeout: 30_000,
      })
      .toBe(true);

    if ((await fallback.count()) > 0) {
      // Fallback must offer a working retry and a real scheduling link.
      const retry = page.getByRole("button", { name: /try again/i });
      await expect(retry).toBeVisible();
      await retry.click();
      await expect(calendar).toBeVisible();
      const external = page.getByRole("link", { name: /open the scheduling page/i });
      if ((await external.count()) > 0) {
        const href = await external.getAttribute("href");
        expect(href).toMatch(/^https:\/\/(www\.)?calendly\.com\//);
        expect(await external.getAttribute("target")).toBe("_blank");
      }
    }

    // The intake submit must have persisted a booking session.
    const { sessions } = await qaSeed<{ sessions: Array<{ id: string; email: string }> }>(
      "lookup_booking",
      { email },
    );
    expect(sessions.length, "booking_sessions row created").toBeGreaterThan(0);

    expect(meaningfulConsoleErrors(errors)).toEqual([]);
  });

  test("honeypot submissions are accepted without exposing the trap", async ({ page }) => {
    const { email, stamp } = prospect();
    await page.goto("/book", { waitUntil: "domcontentloaded" });
    await fillIntake(page, email, `QA_INTAKE_E2E_BOOK_${stamp}`);
    // Fill the trap the way a bot would.
    await page.locator('input[name="website"]').fill("http://spam.example", { force: true });
    await page.getByRole("button", { name: /continue to choose a time/i }).click();
    // No crash, no error banner leaking the trap.
    await expect(page.getByText(/couldn't save your details/i)).toHaveCount(0);
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("no horizontal overflow at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/book", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /continue to choose a time/i }).click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);
  });
});
