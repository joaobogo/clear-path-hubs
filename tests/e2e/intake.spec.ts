/**
 * TEST 1 — client intake (/intake) driven as an anonymous prospect.
 *
 * The form is a three step wizard: step 1 company + you + account, step 2 the
 * role and who you need, step 3 details, review and submit. Every assertion is
 * made against the real UI and, for submit, against the rows the flow actually
 * persisted. Data is namespaced QA_INTAKE_E2E_* and removed in global teardown.
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

const JD_TEXT =
  "We are hiring a Clinical Operations Manager to run our trial sites end to end. " +
  "You will own site readiness, monitoring cadence, vendor performance and inspection " +
  "readiness across three regions, working closely with data management and quality.";

/**
 * The primary submit label depends on the commerce flag: with payments off the
 * review step offers a single "create workspace and pick a time" action, so the
 * spec resolves the label from the flag instead of hardcoding the pay copy.
 */
const PRIMARY_SUBMIT = PAYMENTS_ENABLED
  ? /start now — pay and publish/i
  : /create my workspace and pick a time/i;

const PRIMARY_SUBMIT_TESTID = PAYMENTS_ENABLED ? "intake-submit-pay" : "intake-submit-call";

/** The wizard reports its own position, so no test has to infer the step. */
function stepIndicator(page: Page) {
  return page.getByTestId("intake-nav");
}

async function expectStep(page: Page, index: 0 | 1 | 2) {
  await expect(stepIndicator(page)).toHaveAttribute("data-step", String(index));
}

async function continueStep(page: Page) {
  await page.getByTestId("step-continue").click();
}

async function fillCompany(page: Page, companyName: string, website = "northwindhealth.com") {
  await page.getByLabel("Company name").fill(companyName);
  await page.getByLabel("Company website").fill(website);
}

async function fillYou(page: Page, email: string) {
  await page.getByLabel("First name").fill("Dana");
  await page.getByLabel("Last name").fill("Whitfield");
  await page.getByLabel("Work email").fill(email);
}

async function fillPasswords(page: Page, password: string, confirm = password) {
  await page.locator("#account-password").fill(password);
  await page.getByLabel("Confirm password").fill(confirm);
}

/** Step 2: the role itself plus at least one tagged must-have. */
async function fillRole(page: Page, { withJd }: { withJd: boolean }) {
  await page.getByLabel("Job title", { exact: true }).fill("Clinical Operations Manager");
  // "Why is this role open?" was intentionally removed from intake — the brief
  // no longer asks prospects for it, so the wizard has no such field.
  if (withJd) await page.locator("#jd-text").fill(JD_TEXT);
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

/**
 * The consent dialog is rendered above the wizard, so it is dismissed before
 * any step interaction rather than clicking through an overlay.
 */
async function dismissConsent(page: Page) {
  const accept = page.getByRole("button", { name: /^accept all$/i });
  if (await accept.count()) await accept.first().click();
  await expect(page.getByRole("dialog", { name: /cookie and tracking/i })).toHaveCount(0);
}

/** Step 3: the practicalities and process answers a complete brief needs. */
async function fillDetails(page: Page) {
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
}

async function acceptTerms(page: Page) {
  await page.locator("#pilot-acknowledgement").click();
  await page.locator("#terms-consent").click();
}

/** Walks a brand-new prospect from a blank step 1 to the review step. */
async function completeToReview(page: Page, companyName: string, email: string) {
  await fillCompany(page, companyName);
  await fillYou(page, email);
  await fillPasswords(page, "QaTest!Phase11");
  await continueStep(page);
  await expectStep(page, 1);

  await fillRole(page, { withJd: true });
  await addMustHave(page, "5+ years running clinical trial sites");
  await continueStep(page);
  await expectStep(page, 2);

  await fillDetails(page);
  await acceptTerms(page);
}

test.describe("TEST 1 — /intake as a brand-new prospect", () => {
  test("step gating, review, autosave and every control behave", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const { companyName, email } = uniqueProspect();

    await page.goto("/intake", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /launch a role in minutes/i })).toBeVisible();
    await dismissConsent(page);
    await waitForIntakeHydration(page);
    await expectStep(page, 0);

    // ── Step 1 gates on its own required fields, and does not advance ─────────
    await continueStep(page);
    await expectStep(page, 0);
    await expect(page.getByText("Enter your company name")).toBeVisible();
    await expect(page.getByText("Enter your company website")).toBeVisible();
    await expect(page.getByText("Enter your first name")).toBeVisible();
    await expect(page.getByText("Enter your last name")).toBeVisible();
    await expect(page.getByText("Enter a valid work email")).toBeVisible();

    // ── Website: step 1 only checks presence, not format ─────────────────────
    // KNOWN UI GAP: stepValidators.company accepts any 3+ character string, so
    // "not a website" advances and the strict format check ("Enter a valid
    // website") only runs at submit. Asserted as-is rather than pretending the
    // step catches it.
    await fillCompany(page, companyName, "not a website");
    await continueStep(page);
    await expect(page.getByText("Enter your company website")).toHaveCount(0);
    await fillCompany(page, companyName, "northwindhealth.com");

    // ── Contact fields are filled; their errors clear on the next validation ──
    // (field errors are recomputed when the step is validated, not on keystroke,
    // so clearing is asserted after the successful Continue at the end of step 1.)
    await fillYou(page, email);


    // ── Account: password rules are enforced by the inline create action ─────
    // (step 1's Continue does not gate on the password — the account block is a
    // separate inline action, so its rules surface on "Create my account now".)
    const createAccount = page.getByRole("button", { name: /create my account now/i });
    await fillPasswords(page, "short");
    await createAccount.click();
    await expectStep(page, 0);
    await expect(page.getByText(/at least 8 characters/i).first()).toBeVisible();

    await fillPasswords(page, "QaTest!Phase11", "QaTest!Different");
    await createAccount.click();
    await expectStep(page, 0);
    await expect(page.getByText(/passwords don't match yet/i).first()).toBeVisible();

    await fillPasswords(page, "QaTest!Phase11");

    // An existing client must be able to reach a real sign-in path from here.
    const signInLink = page.getByRole("link", { name: /sign in/i }).first();
    await expect(signInLink).toBeVisible();
    await expect(signInLink).toHaveAttribute("href", "/login");
    // …and the inline toggle must actually switch the account block to sign-in.
    await page.getByRole("button", { name: /i already have an account/i }).click();
    await expect(page.getByRole("button", { name: /sign in and continue/i })).toBeVisible();
    await page.getByRole("button", { name: /don't have an account yet/i }).click();
    await expect(page.getByRole("button", { name: /create my account now/i })).toBeVisible();
    await fillPasswords(page, "QaTest!Phase11");

    // ── Step 1 complete: the wizard advances and its errors are gone ─────────
    await continueStep(page);
    await expectStep(page, 1);
    await expect(page.getByText("Enter your first name")).toHaveCount(0);
    await expect(page.getByText("Enter a valid work email")).toHaveCount(0);



    // ── Step 2 gates on the role and on at least one tagged must-have ────────
    await continueStep(page);
    await expectStep(page, 1);
    await expect(page.getByText("Enter the job title")).toBeVisible();
    await expect(page.getByText(/tag at least one requirement as a must have/i)).toBeVisible();

    // A job description is required in some form. There is no longer a
    // character minimum on the pasted text — any real description is accepted.
    await fillRole(page, { withJd: false });
    await continueStep(page);
    await expect(
      page.getByText(/upload a job description file or paste the description/i),
    ).toBeVisible();
    await page.locator("#jd-text").fill(JD_TEXT);
    await addMustHave(page, "5+ years running clinical trial sites");
    await continueStep(page);
    await expect(
      page.getByText(/upload a job description file or paste the description/i),
    ).toHaveCount(0);
    await expectStep(page, 2);

    // ── Step 3 review: skipped optional fields must not read "Not provided" ──
    await expect(page.getByRole("heading", { name: /review your role brief/i })).toBeVisible();
    await expect(page.getByTestId("intake-review")).toBeVisible();
    await expect(page.getByText(companyName).first()).toBeVisible();
    await expect(page.getByText("Not provided")).toHaveCount(0);
    // Optional rows we deliberately skipped are absent, not blank-labelled.
    await expect(page.getByText("LinkedIn", { exact: true })).toHaveCount(0);

    // Show/Hide really toggles the review summary itself.
    await page.getByRole("button", { name: /^hide$/i }).click();
    await expect(page.getByTestId("intake-review")).toHaveCount(0);
    await page.getByRole("button", { name: /show summary/i }).click();
    await expect(page.getByTestId("intake-review")).toBeVisible();


    // Every review group offers an Edit affordance that jumps to its own step.
    await expect(page.getByRole("button", { name: /^Edit The role$/ })).toBeVisible();
    await page.getByRole("button", { name: /^Edit The role$/ }).click();
    await expectStep(page, 1);
    await expect(page.locator("#section-role")).toBeVisible();
    // "Back to review" returns without re-walking the wizard.
    await expect(page.getByTestId("step-continue")).toHaveText(/back to review/i);
    await continueStep(page);
    await expectStep(page, 2);

    // Submit is gated until every required answer is present, then unlocks.
    const submit = page.getByTestId(PRIMARY_SUBMIT_TESTID);
    await expect(submit).toHaveAccessibleName(PRIMARY_SUBMIT);
    await expect(submit).toBeDisabled();
    await expect(page.getByTestId("review-missing")).toBeVisible();
    await fillDetails(page);
    await acceptTerms(page);
    await expect(page.getByTestId("review-missing")).toHaveCount(0);
    await expect(submit).toBeEnabled();

    // ── Autosave survives a reload (passwords deliberately never persist) ────
    await expect(page.getByText(/^Saved /)).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await dismissConsent(page);
    await waitForIntakeHydration(page);
    await expect(page.getByLabel("Company name")).toHaveValue(companyName);
    await expect(page.getByLabel("Work email")).toHaveValue(email);
    await expect(page.locator("#account-password")).toHaveValue("");
    await continueStep(page);
    await expect(page.locator("#jd-text")).toHaveValue(JD_TEXT);

    expect(meaningfulConsoleErrors(errors)).toEqual([]);
  });

  test("no horizontal overflow at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/intake", { waitUntil: "domcontentloaded" });
    await dismissConsent(page);
    await waitForIntakeHydration(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);
  });

  test('submit path "Book a call first" creates account, org and intake', async ({ page }) => {
    // The secondary "Book a call first" button only exists alongside the pay
    // action, so this case is scoped to the payments-on configuration.
    test.skip(!PAYMENTS_ENABLED, "secondary call button only renders when payments are on");
    const errors = collectConsoleErrors(page);
    const { companyName, email } = uniqueProspect();

    await page.goto("/intake", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded" });
    await dismissConsent(page);
    await waitForIntakeHydration(page);

    await completeToReview(page, companyName, email);
    await page.getByTestId("intake-submit-call").click();

    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 60_000 })
      .toMatch(/^\/(book-call|book|intake\/confirmation)/);
    // Whatever the destination, it must render real content — never a dead end.
    await expect(page.locator("body")).not.toBeEmpty();
    await expect(page.getByRole("heading").first()).toBeVisible();

    const state = await lookupIntake(companyName, email);
    expect(state.auth_user, "auth account created").not.toBeNull();
    expect(state.organization, "organization created").not.toBeNull();
    expect(state.intake_submission, "intake submission created").not.toBeNull();
    expect(state.intake_submission?.organization_id).toBe(state.organization?.id);
    expect(state.position, "role saved").not.toBeNull();

    expect(meaningfulConsoleErrors(errors)).toEqual([]);
  });

  test("primary submit path lands on a live destination, never a dead end", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const { companyName, email } = uniqueProspect();

    await page.goto("/intake", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded" });
    await dismissConsent(page);
    await waitForIntakeHydration(page);

    await completeToReview(page, companyName, email);
    await page.getByTestId(PRIMARY_SUBMIT_TESTID).click();

    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 60_000 })
      .toMatch(
        PAYMENTS_ENABLED
          ? /^\/(checkout|intake\/confirmation)/
          : /^\/(book-call|book|intake\/confirmation)/,
      );

    await expect(page.getByRole("heading").first()).toBeVisible();
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body.length).toBeGreaterThan(80);
    expect(body).not.toContain("something went wrong");
    expect(body).not.toContain("unexpected application error");
    if (!PAYMENTS_ENABLED) {
      // Payments-off: no money vocabulary and no card field anywhere on the
      // destination the submitter actually reaches.
      for (const word of ["checkout", "payment", "pay now", "card number"]) {
        expect(body, `"${word}" must not appear with payments off`).not.toContain(word);
      }
      expect(await page.locator('input[name*="card" i], iframe[src*="stripe" i]').count()).toBe(0);
    }

    const state = await lookupIntake(companyName, email);
    expect(state.organization).not.toBeNull();
    expect(state.intake_submission).not.toBeNull();

    expect(meaningfulConsoleErrors(errors)).toEqual([]);
  });
});
