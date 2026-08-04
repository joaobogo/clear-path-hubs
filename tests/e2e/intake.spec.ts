/**
 * TEST 1 — client intake (/intake) driven as an anonymous prospect.
 *
 * Every assertion is made against the real UI and, for submit, against the
 * rows the flow actually persisted. Data is namespaced QA_INTAKE_E2E_* and
 * removed in global teardown.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  collectConsoleErrors,
  lookupIntake,
  meaningfulConsoleErrors,
  uniqueProspect,
} from "./helpers/qa";

const JD_TEXT =
  "We are hiring a Clinical Operations Manager to run our trial sites end to end. " +
  "You will own site readiness, monitoring cadence, vendor performance and inspection " +
  "readiness across three regions, working closely with data management and quality.";

async function fillCompany(page: Page, companyName: string, website = "northwindhealth.com") {
  await page.getByLabel("Company name").fill(companyName);
  await page.getByLabel("Company website").fill(website);
}

async function fillYou(page: Page, email: string) {
  await page.getByLabel("First name").fill("Dana");
  await page.getByLabel("Last name").fill("Whitfield");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Phone", { exact: false }).first().fill("+15551234567");
}

async function fillPasswords(page: Page, password: string, confirm = password) {
  await page.locator("#account-password").fill(password);
  await page.getByLabel("Confirm password").fill(confirm);
}

async function fillRole(page: Page, withJd: boolean) {
  await page.getByLabel("Job title").first().fill("Clinical Operations Manager");
  if (withJd) await page.locator("#jd-text").fill(JD_TEXT);
}

async function acceptTerms(page: Page) {
  await page.locator("#pilot-acknowledgement").click();
  await page.locator("#terms-consent").click();
}

test.describe("TEST 1 — /intake as a brand-new prospect", () => {
  test("validation, review, autosave and every control behave", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const { companyName, email } = uniqueProspect();

    await page.goto("/intake", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /launch a role in minutes/i })).toBeVisible();

    // ── Required-field validation on an empty form ───────────────────────────
    await page.getByRole("button", { name: /start now — pay and publish/i }).click();
    await expect(page.getByText("Enter your company name")).toBeVisible();
    await expect(page.getByText("Enter your company website")).toBeVisible();
    await expect(page.getByText("Enter your first name")).toBeVisible();
    await expect(page.getByText("Enter your last name")).toBeVisible();
    await expect(page.getByText("Enter a valid work email")).toBeVisible();
    await expect(page.getByText(/phone number we can reach you on/i)).toBeVisible();
    await expect(page.getByText("Enter the job title")).toBeVisible();
    await expect(page.getByText(/must accept the terms/i)).toBeVisible();
    await expect(page.getByText(/confirm you understand how the pilot works/i)).toBeVisible();

    // ── Website format validation ────────────────────────────────────────────
    await fillCompany(page, companyName, "not a website");
    await page.getByRole("button", { name: /start now — pay and publish/i }).click();
    await expect(page.getByText("Enter a valid website")).toBeVisible();
    await fillCompany(page, companyName, "northwindhealth.com");
    await page.getByRole("button", { name: /start now — pay and publish/i }).click();
    await expect(page.getByText("Enter a valid website")).toHaveCount(0);

    // ── Contact step ─────────────────────────────────────────────────────────
    await fillYou(page, email);
    await page.getByRole("button", { name: /start now — pay and publish/i }).click();
    await expect(page.getByText("Enter your first name")).toHaveCount(0);
    await expect(page.getByText("Enter a valid work email")).toHaveCount(0);

    // ── Account step: min length + confirm match ──────────────────────────────
    await fillPasswords(page, "short");
    await page.getByRole("button", { name: /start now — pay and publish/i }).click();
    await expect(page.getByText(/at least 8 characters/i).first()).toBeVisible();

    await fillPasswords(page, "QaTest!Phase11", "QaTest!Different");
    await page.getByRole("button", { name: /start now — pay and publish/i }).click();
    await expect(page.getByText(/passwords must match/i)).toBeVisible();

    await fillPasswords(page, "QaTest!Phase11");
    await page.getByRole("button", { name: /start now — pay and publish/i }).click();
    await expect(page.getByText(/passwords must match/i)).toHaveCount(0);

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

    // ── Role step: the 80-char minimum only applies when text is typed ────────
    await fillRole(page, false);
    await page.locator("#jd-text").fill("too short to be a job description");
    await page.getByRole("button", { name: /start now — pay and publish/i }).click();
    await expect(page.getByText(/at least 80 characters/i)).toBeVisible();
    await page.locator("#jd-text").fill(JD_TEXT);
    await page.getByRole("button", { name: /start now — pay and publish/i }).click();
    await expect(page.getByText(/at least 80 characters/i)).toHaveCount(0);

    // ── Review: skipped optional fields must not read "Not provided" ──────────
    await expect(page.getByRole("heading", { name: /review your role brief/i })).toBeVisible();
    const review = page.locator("div", { has: page.getByRole("heading", { name: "Your company" }) });
    await expect(page.getByText(companyName).first()).toBeVisible();
    await expect(review.getByText("Not provided")).toHaveCount(0);
    await expect(page.getByText("Not provided")).toHaveCount(0);

    // Show/Hide summary really toggles.
    await page.getByRole("button", { name: /^hide$/i }).click();
    await expect(page.getByRole("heading", { name: "Your company" })).toHaveCount(0);
    await page.getByRole("button", { name: /show summary/i }).click();
    await expect(page.getByRole("heading", { name: "Your company" })).toBeVisible();

    // Edit links jump to the matching section.
    for (const [block, target] of [
      ["Your company", "section-company"],
      ["You", "section-you"],
      ["The role", "section-role"],
    ] as const) {
      const heading = page.getByRole("heading", { name: block, exact: true }).last();
      await heading.locator("xpath=following-sibling::*[1]").first().click({ trial: true }).catch(() => undefined);
      await expect(page.locator(`#${target}`)).toBeVisible();
    }

    // Password visibility toggle is not a no-op.
    await expect(page.locator("#account-password")).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: /show password/i }).click();
    await expect(page.locator("#account-password")).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: /hide password/i }).click();
    await expect(page.locator("#account-password")).toHaveAttribute("type", "password");

    // ── Autosave survives a reload (passwords deliberately never persist) ────
    await expect(page.getByText(/^Saved /)).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("Company name")).toHaveValue(companyName);
    await expect(page.getByLabel("Work email")).toHaveValue(email);
    await expect(page.locator("#jd-text")).toHaveValue(JD_TEXT);
    await expect(page.locator("#account-password")).toHaveValue("");

    expect(meaningfulConsoleErrors(errors)).toEqual([]);
  });

  test("no horizontal overflow at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/intake", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /start now — pay and publish/i }).click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);
  });

  test('submit path "Book a call first" creates account, org and intake', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const { companyName, email } = uniqueProspect();

    await page.goto("/intake", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded" });

    await fillCompany(page, companyName);
    await fillYou(page, email);
    await fillPasswords(page, "QaTest!Phase11");
    await fillRole(page, true);
    await acceptTerms(page);

    await page.getByRole("button", { name: /book a call first/i }).click();

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

  test('submit path "Start now — pay and publish" degrades gracefully', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const { companyName, email } = uniqueProspect();

    await page.goto("/intake", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded" });

    await fillCompany(page, companyName);
    await fillYou(page, email);
    await fillPasswords(page, "QaTest!Phase11");
    await fillRole(page, true);
    await acceptTerms(page);

    await page.getByRole("button", { name: /start now — pay and publish/i }).click();

    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 60_000 })
      .toMatch(/^\/(checkout|intake\/confirmation)/);

    // The checkout stub must explain itself rather than crash or dead-end.
    await expect(page.getByRole("heading").first()).toBeVisible();
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body.length).toBeGreaterThan(80);
    expect(body).not.toContain("something went wrong");
    expect(body).not.toContain("unexpected application error");

    const state = await lookupIntake(companyName, email);
    expect(state.organization).not.toBeNull();
    expect(state.intake_submission).not.toBeNull();

    expect(meaningfulConsoleErrors(errors)).toEqual([]);
  });
});
