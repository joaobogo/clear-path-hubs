/**
 * TEST 2 — /book, the single booking destination.
 *
 * Drives the intake step exactly as a visitor would, then the NATIVE scheduler:
 * picks a real slot, asserts the booking_sessions row is scheduled, proves the
 * slot cannot be double-booked, and exercises reschedule + cancel.
 *
 * Zero external scheduling dependencies. Booking rows are namespaced qa.book+*
 * and removed in teardown.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  collectConsoleErrors,
  lookupBooking,
  meaningfulConsoleErrors,
  uniqueBookingProspect,
  waitForReactMount,
} from "./helpers/qa";

const SELECTS: [string, string][] = [
  ["companySize", "51–200"],
  ["openRoles", "4–9"],
  ["hiringVolume", "6–15 hires this year"],
  ["hiringTimeline", "Within 30 days"],
  ["currentProcess", ""],
  ["heardAbout", ""],
];

/** Opens /book and waits until the form is genuinely interactive. */
async function openBook(page: Page) {
  // "domcontentloaded" can hang on this route in dev (streamed module graph),
  // so commit + explicit hydration wait is the reliable gate.
  await page.goto("/book", { waitUntil: "commit" });
  await waitForReactMount(page, "#firstName");
}

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

/** Intake → scheduler. Returns the first offered slot's ISO start. */
async function reachScheduler(page: Page, email: string, companyName: string): Promise<string> {
  await openBook(page);
  await fillIntake(page, email, companyName);
  await page.getByRole("button", { name: /continue to choose a time/i }).click();

  const calendar = page.getByTestId("booking-calendar");
  await expect(calendar).toBeVisible({ timeout: 30_000 });
  const slot = calendar.locator("[data-slot-start]").first();
  await expect(slot).toBeVisible({ timeout: 30_000 });
  const start = await slot.getAttribute("data-slot-start");
  expect(start, "scheduler offered at least one slot").toBeTruthy();
  return start!;
}

async function pickSlot(page: Page, startIso: string) {
  await page.locator(`[data-slot-start="${startIso}"]`).first().click();
  await expect(page.getByTestId("booked-when")).toBeVisible({ timeout: 30_000 });
}

test.describe("TEST 2 — /book native scheduling", () => {
  test("required-field validation blocks Continue until the intake is complete", async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    await openBook(page);
    await expect(page.getByRole("heading", { name: /book your hiring call/i })).toBeVisible();

    await page.getByRole("button", { name: /continue to choose a time/i }).click();
    await expect(page.getByText("Enter your first name")).toBeVisible();
    await expect(page.getByText("Enter your last name")).toBeVisible();
    await expect(page.getByText(/enter your work email/i)).toBeVisible();
    await expect(page.getByText("Enter your job title")).toBeVisible();
    await expect(page.getByText("Enter your company name")).toBeVisible();
    await expect(page.locator("#firstName")).toBeVisible();

    for (const [id] of SELECTS) {
      await expect(page.locator(`#${id}`)).toHaveAttribute("aria-invalid", "true");
    }

    expect(meaningfulConsoleErrors(errors)).toEqual([]);
  });

  test("intake stores a booking session and the scheduler offers real slots", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const { email, companyName } = uniqueBookingProspect();

    await openBook(page);
    const honeypot = page.locator('input[name="website"]');
    await expect(honeypot).toHaveCount(1);
    await expect(honeypot).toBeHidden();

    await fillIntake(page, email, companyName);
    await page.getByRole("button", { name: /continue to choose a time/i }).click();

    const calendar = page.getByTestId("booking-calendar");
    await expect(calendar).toBeVisible({ timeout: 30_000 });
    await expect(calendar.locator("[data-slot-start]").first()).toBeVisible({ timeout: 30_000 });
    // Timezone is the visitor's, and changeable.
    await expect(page.locator("#timezone")).toBeVisible();

    const { sessions } = await lookupBooking(email);
    expect(sessions.length, "exactly one booking_sessions row").toBe(1);
    expect(sessions[0]!.company_name).toBe(companyName);
    expect(sessions[0]!.status).toBe("intake_submitted");
    expect(sessions[0]!.scheduled_start).toBeNull();

    expect(meaningfulConsoleErrors(errors)).toEqual([]);
  });

  test("picking a slot schedules the session and blocks double-booking", async ({
    page,
    context,
  }) => {
    const { email, companyName } = uniqueBookingProspect();
    const start = await reachScheduler(page, email, companyName);
    await pickSlot(page, start);

    const { sessions } = await lookupBooking(email);
    expect(sessions.length, "still exactly one row — no duplicate on confirm").toBe(1);
    const row = sessions[0]!;
    expect(row.status).toBe("scheduled");
    expect(row.scheduled_start).toBe(start);
    expect(row.scheduled_end).not.toBeNull();
    expect(
      Date.parse(row.scheduled_end!) - Date.parse(row.scheduled_start!),
      "30-minute slot",
    ).toBe(30 * 60_000);
    expect(row.timezone, "visitor timezone recorded").toBeTruthy();
    expect(row.host_name, "host recorded").toBeTruthy();

    // A second visitor must NOT be offered the slot we just took.
    const second = await context.newPage();
    const other = uniqueBookingProspect();
    await reachScheduler(second, other.email, other.companyName);
    await expect(second.locator(`[data-slot-start="${start}"]`)).toHaveCount(0);
    await second.close();
  });

  test("reschedule moves the meeting and cancel releases it", async ({ page }) => {
    const { email, companyName } = uniqueBookingProspect();
    const first = await reachScheduler(page, email, companyName);
    await pickSlot(page, first);

    // Reschedule to a different offered slot.
    await page.getByRole("button", { name: /^reschedule$/i }).click();
    const calendar = page.getByTestId("booking-calendar");
    await expect(calendar).toBeVisible();
    await expect(calendar.locator("[data-slot-start]").first()).toBeVisible({ timeout: 30_000 });
    const starts = await calendar.locator("[data-slot-start]").evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-slot-start")!),
    );
    const next = starts.find((s) => s !== first);
    expect(next, "a second slot is available to move to").toBeTruthy();
    await pickSlot(page, next!);

    const after = (await lookupBooking(email)).sessions;
    expect(after.length, "reschedule updates in place").toBe(1);
    expect(after[0]!.status).toBe("scheduled");
    expect(after[0]!.scheduled_start).toBe(next);

    // Cancel returns to the picker and frees the slot.
    await page.getByRole("button", { name: /cancel this call/i }).click();
    await expect(page.getByText(/that call is cancelled/i)).toBeVisible({ timeout: 30_000 });

    const cancelled = (await lookupBooking(email)).sessions;
    expect(cancelled.length).toBe(1);
    expect(cancelled[0]!.status).toBe("cancelled");
  });

  test("no horizontal overflow at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { email, companyName } = uniqueBookingProspect();
    await reachScheduler(page, email, companyName);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
