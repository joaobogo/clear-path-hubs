/**
 * PAYMENTS-OFF JOURNEY — one brand-new employer, end to end.
 *
 * /intake (3 steps, fresh email) → submit → booking screen → book a slot →
 * client dashboard. At every stop we assert:
 *   - visible page text contains no money vocabulary (case-insensitive)
 *   - no Stripe iframe and no card input exists in the DOM
 *   - no request, redirect or document navigation ever touches /checkout
 *   - the console stays free of meaningful errors
 *
 * Skipped when PAYMENTS_ENABLED is true — the assertions describe the
 * payments-off configuration only.
 */
import { expect, test, type Page } from "@playwright/test";
import { PAYMENTS_ENABLED } from "@/config/commerce";
import {
  collectConsoleErrors,
  lookupIntake,
  meaningfulConsoleErrors,
  uniqueProspect,
  waitForIntakeHydration,
} from "./helpers/qa";

const MONEY_WORDS = ["pay", "payment", "checkout", "card", "invoice", "charge"];

const JD_TEXT =
  "We are hiring a Clinical Operations Manager to run our trial sites end to end. " +
  "You will own site readiness, monitoring cadence, vendor performance and inspection " +
  "readiness across three regions, working closely with data management and quality.";

/** Reads what a human can actually see, then screens it for money vocabulary. */
async function expectNoMoneyWords(page: Page, where: string) {
  const text = (await page.locator("body").innerText()).toLowerCase();
  for (const word of MONEY_WORDS) {
    // Word-boundary match so "compare"/"discard" style substrings never
    // produce a false positive, and "pay" still catches "pay now".
    const hit = new RegExp(`\\b${word}\\w*\\b`, "i").exec(text);
    expect(hit?.[0] ?? null, `${where}: visible text must not contain "${word}"`).toBeNull();
  }
}

/** No Stripe surface may exist in the DOM, visible or not. */
async function expectNoPaymentDom(page: Page, where: string) {
  const stripeFrames = await page
    .locator('iframe[src*="stripe" i], iframe[name*="stripe" i], iframe[title*="stripe" i]')
    .count();
  expect(stripeFrames, `${where}: no Stripe iframe`).toBe(0);
  const cardInputs = await page
    .locator(
      'input[name*="card" i], input[id*="card" i], input[autocomplete*="cc-" i], input[autocomplete="cc-number"]',
    )
    .count();
  expect(cardInputs, `${where}: no card input`).toBe(0);
}

async function assertClean(page: Page, where: string) {
  await expectNoMoneyWords(page, where);
  await expectNoPaymentDom(page, where);
}

async function dismissConsent(page: Page) {
  const accept = page.getByRole("button", { name: /^accept all$/i });
  if (await accept.count()) await accept.first().click();
  await expect(page.getByRole("dialog", { name: /cookie and tracking/i })).toHaveCount(0);
}

async function continueStep(page: Page) {
  await page.getByTestId("step-continue").click();
}

async function expectStep(page: Page, index: 0 | 1 | 2) {
  await expect(page.getByTestId("intake-nav")).toHaveAttribute("data-step", String(index));
}

async function addMustHave(page: Page, text: string) {
  await page.getByRole("button", { name: /^add requirement$/i }).click();
  const rows = page.getByRole("textbox", { name: /^Requirement \d+$/ });
  const index = (await rows.count()) - 1;
  await rows.nth(index).fill(text);
  await page
    .getByRole("group", { name: `Requirement ${index + 1} tag` })
    .getByRole("button", { name: "Must have", exact: true })
    .click();
}

test.describe("PAYMENTS-OFF — full employer journey", () => {
  test.skip(PAYMENTS_ENABLED, "payments-off assertions only apply with PAYMENTS_ENABLED=false");
  test.setTimeout(240_000);

  test("intake → booking → dashboard, never a money word or a /checkout hit", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const { companyName, email } = uniqueProspect();
    const password = "QaTest!Phase11";

    // Every request AND every frame navigation is recorded, so a redirect into
    // /checkout cannot slip past by happening between assertions.
    const checkoutHits: string[] = [];
    page.on("request", (r) => {
      if (new URL(r.url()).pathname.startsWith("/checkout")) checkoutHits.push(`request ${r.url()}`);
    });
    page.on("framenavigated", (f) => {
      if (new URL(f.url()).pathname.startsWith("/checkout")) checkoutHits.push(`navigated ${f.url()}`);
    });

    // ── Step 1: company + you + a brand-new account ──────────────────────────
    await page.goto("/intake", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded" });
    await dismissConsent(page);
    await waitForIntakeHydration(page);
    await expectStep(page, 0);
    await assertClean(page, "intake step 1");

    await page.getByLabel("Company name").fill(companyName);
    await page.getByLabel("Company website").fill("northwindhealth.com");
    await page.getByLabel("First name").fill("Dana");
    await page.getByLabel("Last name").fill("Whitfield");
    await page.getByLabel("Work email").fill(email);
    await page.locator("#account-password").fill(password);
    await page.getByLabel("Confirm password").fill(password);
    await continueStep(page);
    await expectStep(page, 1);

    // ── Step 2: the role ────────────────────────────────────────────────────
    await assertClean(page, "intake step 2");
    await page.getByLabel("Job title", { exact: true }).fill("Clinical Operations Manager");
    await page.locator("#jd-text").fill(JD_TEXT);
    await addMustHave(page, "5+ years running clinical trial sites");
    await continueStep(page);
    await expectStep(page, 2);

    // ── Step 3: practicalities + review ─────────────────────────────────────
    await page.getByLabel("Where is the role based?").fill("Manchester, United Kingdom");
    await page.locator("#work-model").selectOption("hybrid");
    await page.getByLabel("Days on site each week").fill("3");
    await page.locator("#currency").selectOption("GBP");
    await page.getByLabel("From", { exact: true }).fill("70000");
    await page.getByLabel("To", { exact: true }).fill("85000");
    await page
      .getByRole("radio", { name: /^No — candidates must already be authorised to work here/ })
      .check();
    await page.getByLabel("Deal-breaker 1").fill("No agency-side-only backgrounds");
    await page.getByLabel("Who makes the final decision?").fill("Dana Okoro, Operations Director");
    await page.locator("#pilot-acknowledgement").click();
    await page.locator("#terms-consent").click();
    await assertClean(page, "intake step 3 (review)");

    const submit = page.getByTestId("intake-submit-call");
    await expect(submit).toBeEnabled();
    await submit.click();

    // ── Booking screen ──────────────────────────────────────────────────────
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 90_000 })
      .toMatch(/^\/(book-call|book|intake\/confirmation)/);
    await expect(page.getByRole("heading").first()).toBeVisible();
    await assertClean(page, `booking screen (${new URL(page.url()).pathname})`);

    const persisted = await lookupIntake(companyName, email);
    expect(persisted.auth_user, "account created from intake").not.toBeNull();
    expect(persisted.organization, "organization created").not.toBeNull();
    expect(persisted.position, "role saved").not.toBeNull();

    // ── Book a slot ─────────────────────────────────────────────────────────
    // The booking screen opens its scheduler in place. Native slots carry
    // data-slot-start; the hosted embed may be unavailable in CI, in which case
    // the page must still offer a real way forward (asserted, never skipped).
    const openScheduler = page.getByRole("button", { name: /open the scheduler/i });
    if (await openScheduler.count()) await openScheduler.first().click();

    const slot = page.locator("[data-slot-start]").first();
    const booked = await slot
      .waitFor({ state: "visible", timeout: 30_000 })
      .then(() => true)
      .catch(() => false);

    if (booked) {
      await slot.click();
      await expect(page.getByTestId("booked-when")).toBeVisible({ timeout: 30_000 });
    } else {
      // No native slot rendered: the fallback must be a live path, not a
      // dead end, and it still must not mention money.
      await expect(
        page
          .getByRole("link", { name: /booking page|open the booking page/i })
          .or(page.getByRole("button", { name: /go to my dashboard|go to your workspace/i }))
          .first(),
      ).toBeVisible({ timeout: 30_000 });
    }
    await assertClean(page, "booking screen after scheduling");

    // ── Client dashboard ────────────────────────────────────────────────────
    await page.goto("/client", { waitUntil: "domcontentloaded" });
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 60_000 })
      .toMatch(/^\/client/);
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 30_000 });
    await page.waitForLoadState("networkidle").catch(() => {});
    await assertClean(page, "client dashboard");

    // The role the employer just briefed is visible in their workspace.
    const dashboardText = await page.locator("body").innerText();
    const roleVisible =
      dashboardText.includes("Clinical Operations Manager") ||
      (await page.goto("/client/positions", { waitUntil: "domcontentloaded" }).then(async () => {
        await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 30_000 });
        await assertClean(page, "client positions");
        return (await page.locator("body").innerText()).includes("Clinical Operations Manager");
      }));
    expect(roleVisible, "the briefed role appears in the client workspace").toBe(true);

    // ── Global invariants ───────────────────────────────────────────────────
    expect(checkoutHits, "nothing ever requested or navigated to /checkout").toEqual([]);
    const meaningful = meaningfulConsoleErrors(errors);
    // eslint-disable-next-line no-console
    console.log("CONSOLE OUTPUT (all errors captured):\n" + (errors.length ? errors.join("\n") : "(none)"));
    // eslint-disable-next-line no-console
    console.log("FINAL URL: " + page.url());
    expect(meaningful).toEqual([]);
  });
});
