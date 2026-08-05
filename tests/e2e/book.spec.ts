/**
 * TEST 2 — /book, the single booking destination.
 *
 * Drives the intake step exactly as a visitor would, asserts the booking_sessions
 * row actually lands, then drives the Calendly webhook handler with a real HMAC
 * signature to prove the meeting facts (scheduled_start, join_url) get written.
 * Booking rows are namespaced qa.book+* and removed in teardown.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  collectConsoleErrors,
  lookupBooking,
  meaningfulConsoleErrors,
  postCalendlyWebhook,
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
  await page.goto("/book", { waitUntil: "domcontentloaded" });
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

test.describe("TEST 2 — /book time booking", () => {
  test("required-field validation blocks Continue until the intake is complete", async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    await openBook(page);
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
    const { email, companyName } = uniqueBookingProspect();

    await openBook(page);

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
    const { sessions } = await lookupBooking(email);
    expect(sessions.length, "booking_sessions row created").toBeGreaterThan(0);
    const row = sessions[0]!;
    expect(row.company_name).toBe(companyName);
    expect(row.status).toBe("intake_submitted");

    expect(meaningfulConsoleErrors(errors)).toEqual([]);
  });

  test("calendly invitee.created webhook schedules the booking session", async ({ page }) => {
    const { email, companyName } = uniqueBookingProspect();

    await openBook(page);
    await fillIntake(page, email, companyName);
    await page.getByRole("button", { name: /continue to choose a time/i }).click();
    await expect(page.getByLabel("Booking calendar")).toBeVisible({ timeout: 30_000 });

    const before = (await lookupBooking(email)).sessions;
    expect(before.length, "booking_sessions row created").toBeGreaterThan(0);
    const sessionId = before[0]!.id;

    const startTime = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const endTime = new Date(Date.now() + 3 * 86_400_000 + 1_800_000).toISOString();
    const joinUrl = `https://meet.example.com/qa-${sessionId}`;
    const payload = {
      event: "invitee.created",
      created_at: new Date().toISOString(),
      payload: {
        email,
        uri: `https://api.calendly.com/scheduled_events/qa/invitees/${sessionId}`,
        reschedule_url: "https://calendly.com/reschedulings/qa",
        cancel_url: "https://calendly.com/cancellations/qa",
        timezone: "Europe/London",
        tracking: { utm_content: sessionId },
        scheduled_event: {
          uri: `https://api.calendly.com/scheduled_events/qa-${sessionId}`,
          start_time: startTime,
          end_time: endTime,
          location: { join_url: joinUrl },
          event_memberships: [{ user_name: "QA Host", user_email: "host@taasflow.com" }],
        },
      },
    };

    // A forged signature must be rejected before anything is written.
    const forged = await postCalendlyWebhook(payload, { forge: true });
    expect(forged.status, "forged signature rejected").toBe(401);

    const accepted = await postCalendlyWebhook(payload);
    expect(accepted.status, accepted.text).toBe(200);
    expect(accepted.text).not.toMatch(/no matching session/i);

    const after = (await lookupBooking(email)).sessions.find((s) => s.id === sessionId);
    expect(after, "session still present").toBeTruthy();
    expect(after!.status).toBe("scheduled");
    expect(after!.scheduled_start).toBeTruthy();
    expect(new Date(after!.scheduled_start!).toISOString()).toBe(startTime);
    expect(after!.join_url).toBe(joinUrl);
    expect(after!.host_name).toBe("QA Host");
    expect(after!.timezone).toBe("Europe/London");

    // Retries must be idempotent, not double-applied.
    const replay = await postCalendlyWebhook(payload);
    expect(replay.status).toBe(200);
    expect(replay.text).toMatch(/already processed/i);
  });

  test("honeypot submissions are accepted without exposing the trap", async ({ page }) => {
    const { email, companyName } = uniqueBookingProspect();
    await openBook(page);
    await fillIntake(page, email, companyName);
    // Fill the trap the way a bot would.
    await page.locator('input[name="website"]').fill("http://spam.example", { force: true });
    await page.getByRole("button", { name: /continue to choose a time/i }).click();
    // No crash, no error banner leaking the trap.
    await expect(page.getByText(/couldn't save your details/i)).toHaveCount(0);
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("no horizontal overflow at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openBook(page);
    await page.getByRole("button", { name: /continue to choose a time/i }).click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);
  });
});
