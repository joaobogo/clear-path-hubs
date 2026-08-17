/** TEMP verification spec — deleted after the intake-status payload check. */
import { expect, test, type Page } from "@playwright/test";
import { PAYMENTS_ENABLED } from "@/config/commerce";
import { lookupIntake, uniqueProspect, waitForIntakeHydration } from "./helpers/qa";

const PRIMARY_SUBMIT_TESTID = PAYMENTS_ENABLED ? "intake-submit-pay" : "intake-submit-call";
const JD_TEXT =
  "We are hiring a Clinical Operations Manager to run our trial sites end to end. " +
  "You will own site readiness, monitoring cadence, vendor performance and inspection readiness.";

async function dismissConsent(page: Page) {
  const accept = page.getByRole("button", { name: /^accept all$/i });
  if (await accept.count()) await accept.first().click();
}

test("intake-status payload leaks no org id or company name", async ({ page }) => {
  const { companyName, email } = uniqueProspect();
  await page.goto("/intake", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await dismissConsent(page);
  await waitForIntakeHydration(page);

  await page.getByLabel("Company name").fill(companyName);
  await page.getByLabel("Company website").fill("northwindhealth.com");
  await page.getByLabel("First name").fill("Dana");
  await page.getByLabel("Last name").fill("Whitfield");
  await page.getByLabel("Work email").fill(email);
  await page.locator("#account-password").fill("QaTest!Phase11");
  await page.getByLabel("Confirm password").fill("QaTest!Phase11");
  await page.getByTestId("step-continue").click();

  await page.getByLabel("Job title", { exact: true }).fill("Clinical Operations Manager");
  await page.locator("#jd-text").fill(JD_TEXT);
  await page.getByRole("button", { name: /^add requirement$/i }).click();
  const rows = page.getByRole("textbox", { name: /^Requirement \d+$/ });
  const idx = (await rows.count()) - 1;
  await rows.nth(idx).fill("5+ years running clinical trial sites");
  await page
    .getByRole("group", { name: `Requirement ${idx + 1} tag` })
    .getByRole("button", { name: "Must have", exact: true })
    .click();
  await page.getByTestId("step-continue").click();

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

  await page.getByTestId(PRIMARY_SUBMIT_TESTID).click();
  await expect
    .poll(() => new URL(page.url()).pathname, { timeout: 60_000 })
    .toMatch(/^\/(book-call|book|checkout|intake\/confirmation)/);

  const state = await lookupIntake(companyName, email);
  const intakeId = (state.intake_submission as { id: string } | null)?.id;
  const orgId = (state.organization as { id: string } | null)?.id;
  expect(intakeId).toBeTruthy();
  console.log("[verify] intakeId", intakeId, "orgId", orgId, "company", companyName);

  // Confirmation screen still renders for this fresh intake.
  const anon = await page.context().browser()!.newContext();
  const anonPage = await anon.newPage();
  await anonPage.goto(`/intake/confirmation?intake_id=${intakeId}`, {
    waitUntil: "domcontentloaded",
  });
  await anonPage.waitForTimeout(6000);
  const text = await anonPage.locator("body").innerText();
  console.log("[verify] confirmation heading:", (await anonPage.locator("h1, h2").first().innerText()));
  expect(text.toLowerCase()).not.toContain("something went wrong");
  await anonPage.screenshot({ path: "/tmp/browser/intake-status/confirmation.png" });

  // Raw GET of the hardened endpoint from the logged-out context.
  const res = await anon.request.get(`/api/public/intake-status/${intakeId}`);
  const raw = await res.text();
  console.log("[verify] status", res.status(), "body", raw);
  expect(res.ok()).toBeTruthy();
  expect(raw).not.toContain(orgId ?? "__no_org__");
  expect(raw.toLowerCase()).not.toContain(companyName.toLowerCase());
  expect(raw).not.toContain("organization_id");
  expect(raw).not.toContain("company_name");
  expect(JSON.parse(raw).intake.statusLabel).toBeTruthy();
  await anon.close();
});
