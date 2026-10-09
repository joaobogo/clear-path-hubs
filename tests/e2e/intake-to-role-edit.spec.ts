/**
 * Intake → role → analysis → edit, end to end, against a REAL environment.
 *
 * Owner report (8 Oct): "I applied for a role, it picked up, it didn't
 * automatically analyze … then it kept saying I didn't put the time zone or
 * city, but I actually did in the intake form. The same information in the
 * intake form should be the one in the editing role area."
 *
 * What this proves, through the real UI and the real API:
 *  1. a pilot intake with a city, remote time-zone bands, a salary range and
 *     interview stages submits and lands in the client workspace;
 *  2. the role shows "Analysing your role…" and then finishes on its own —
 *     nobody presses anything;
 *  3. the edit screen opens with every intake answer pre-filled;
 *  4. clearing the time zones and saving succeeds (no required time zone/city).
 *
 * ── How to run (never against production) ───────────────────────────────────
 *   E2E_INTAKE_ROLE_EDIT=1            required; the spec skips without it
 *   E2E_BASE_URL=http://localhost:8080  the app under test (dev server or
 *                                     `vite preview`) wired to a LOCAL Supabase:
 *                                     SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY /
 *                                     VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
 *                                     in that server's env (e.g. `supabase start`
 *                                     + `supabase db reset` for all migrations)
 *   QA_SEED_TOKEN=…                   only if the server enforces one (qa-seed)
 *   LOVABLE_API_KEY                   set on the SERVER for the analysis to
 *                                     reach "ready". Without it the analysis
 *                                     ends "failed (missing_api_key)"; set
 *                                     E2E_ALLOW_ANALYSIS_FAILURE=1 to accept
 *                                     that and still test the edit screen.
 *   E2E_ANALYSIS_TIMEOUT_MS=240000    how long to wait for the analysis
 *
 *   E2E_INTAKE_ROLE_EDIT=1 E2E_BASE_URL=http://localhost:8080 \
 *     npx playwright test tests/e2e/intake-to-role-edit.spec.ts
 *
 * Data is namespaced QA_INTAKE_E2E_* and removed by the suite's global
 * teardown (cleanup_intake_e2e).
 */
import { expect, test, type Page } from "@playwright/test";
import { TIMEZONE_BAND_LABELS } from "@/lib/express-intake-schema";
import {
  BASE_URL,
  allowTestFixtures,
  lookupIntake,
  uniqueProspect,
  waitForIntakeHydration,
} from "./helpers/qa";

const ENABLED = process.env["E2E_INTAKE_ROLE_EDIT"] === "1";
const PRODUCTION = /(^|\.)taasflow\.com$/i.test(new URL(BASE_URL).hostname);
const ALLOW_ANALYSIS_FAILURE = process.env["E2E_ALLOW_ANALYSIS_FAILURE"] === "1";
const ANALYSIS_TIMEOUT = Number(process.env["E2E_ANALYSIS_TIMEOUT_MS"] ?? 240_000);

test.use({ baseURL: BASE_URL });

const JD_TEXT =
  "We are hiring a Clinical Operations Manager to run our clinics across the region. " +
  "You will own scheduling, staffing, inspection readiness and vendor performance, " +
  "working closely with quality and finance.";
const CITY = "Manchester, United Kingdom";
const ZONES = ["uk_ireland", "europe_central"] as const;
const MUST_HAVE = "Five years running multi-site clinical operations";
const STAGES = ["Intro call", "Hiring manager interview"];

/**
 * A new workspace greets its first visitor with the onboarding tour, a modal
 * that hides the rest of the page from the accessibility tree. Skip it the way
 * a person would, whenever it appears.
 */
async function dismissTour(page: Page) {
  const skip = page.getByRole("button", { name: /^skip tour$/i });
  // The tour opens once the workspace context has loaded, a moment after the
  // page itself; give it a few seconds to show up before deciding it won't.
  await skip.first().waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);
  if (await skip.count().catch(() => 0)) {
    await skip.first().click().catch(() => undefined);
    await skip.first().waitFor({ state: "hidden", timeout: 5_000 }).catch(() => undefined);
  }
}

async function dismissConsent(page: Page) {
  const accept = page.getByRole("button", { name: /^accept all$/i });
  if (await accept.count()) await accept.first().click();
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

async function submitPilotIntake(page: Page, companyName: string, email: string) {
  await page.goto("/intake", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await dismissConsent(page);
  await waitForIntakeHydration(page);

  // Step 1 — company, you, account, job description.
  await page.getByLabel("Company name").fill(companyName);
  await page.getByLabel("Company website").fill("northwindhealth.com").catch(() => undefined);
  await page.getByLabel("First name").fill("Dana");
  await page.getByLabel("Last name").fill("Whitfield");
  await page.getByLabel("Work email").fill(email);
  await page.locator("#account-password").fill("QaTest!Phase11");
  await page.getByLabel("Confirm password").fill("QaTest!Phase11");
  await page.locator("#jd-text").fill(JD_TEXT).catch(() => undefined);
  await page.getByTestId("step-continue").click();

  // Step 2 — the role and who you need.
  await page.getByLabel("Job title", { exact: true }).fill("Clinical Operations Manager");
  if (await page.locator("#jd-text").isVisible().catch(() => false)) {
    await page.locator("#jd-text").fill(JD_TEXT);
  }
  await addMustHave(page, MUST_HAVE);
  await page.getByTestId("step-continue").click();

  // Step 3 — practicalities: city, remote with two time-zone bands, salary,
  // sponsorship, and two interview stages.
  await page.getByLabel("Where is the role based?").fill(CITY);
  await page.locator("#work-model").selectOption("remote");
  for (const z of ZONES) await page.getByLabel(TIMEZONE_BAND_LABELS[z]).check();
  await page.locator("#currency").selectOption("GBP");
  await page.getByLabel("From", { exact: true }).fill("70000");
  await page.getByLabel("To", { exact: true }).fill("85000");
  await page
    .getByRole("radio", { name: /^No — candidates must already be authorised to work here/ })
    .check();
  await page.getByRole("button", { name: /use this as a starting point/i }).click();
  const stageNames = page.getByPlaceholder("Hiring manager interview");
  await stageNames.nth(0).fill(STAGES[0]);
  await stageNames.nth(1).fill(STAGES[1]);
  // The template has three stages; keep two.
  if ((await stageNames.count()) > 2) {
    await page.getByRole("button", { name: "Remove", exact: true }).last().click();
  }
  await page.getByLabel("Who makes the final decision?").fill("Dana Okoro, COO");

  await page.locator("#pilot-acknowledgement").click();
  await page.locator("#terms-consent").click();
  // "Talk first" with payments on, the only submit with payments off — either
  // way the role is created and the client is signed in.
  await page.getByTestId("intake-submit-call").click();

  await expect
    .poll(() => new URL(page.url()).pathname, { timeout: 90_000 })
    .toMatch(/^\/(intake\/confirmation|checkout|client)/);
}

test.describe("intake → role analysis → edit role", () => {
  test.skip(!ENABLED, "set E2E_INTAKE_ROLE_EDIT=1 and E2E_BASE_URL to a non-production environment");
  test.skip(PRODUCTION, "never run against production");
  test.setTimeout(ANALYSIS_TIMEOUT + 240_000);

  test("every intake answer reaches the edit screen, the role analyses itself, and time zone is optional", async ({
    page,
    context,
  }) => {
    // The intake refuses QA-named records in a live workspace; the e2e cookie
    // marks this browser as test traffic (same as the smoke journey).
    await allowTestFixtures(context);
    const { companyName, email } = uniqueProspect();
    await submitPilotIntake(page, companyName, email);

    const state = await lookupIntake(companyName, email);
    expect(state.position, "the role was created").not.toBeNull();
    const positionId = state.position!.id;

    // ── The role analyses itself ──────────────────────────────────────────────
    await page.goto(`/client/positions/${positionId}`, { waitUntil: "domcontentloaded" });
    await dismissTour(page);
    const panel = page.getByTestId("role-analysis");
    // Either still working (shows "Analysing your role…"), or already done.
    if (await panel.count()) {
      await expect(page.getByText(/analysing your role|restarting the analysis|role brief/i).first()).toBeVisible();
    }
    await expect
      .poll(
        async () => {
          if ((await panel.count()) === 0) return "ready";
          return (await panel.getAttribute("data-state")) ?? "analysing";
        },
        { timeout: ANALYSIS_TIMEOUT, intervals: [2_000, 5_000] },
      )
      .toMatch(ALLOW_ANALYSIS_FAILURE ? /^(ready|failed)$/ : /^ready$/);

    // ── The edit screen is the saved intake ───────────────────────────────────
    await page.goto(`/client/positions/${positionId}/edit`, { waitUntil: "domcontentloaded" });
    await dismissTour(page);
    await expect(page.getByLabel("Job title")).toHaveValue("Clinical Operations Manager");
    await page.getByRole("button", { name: /^2\. Who you need$/ }).click();
    await expect(page.getByText(MUST_HAVE)).toBeVisible();

    await page.getByRole("button", { name: /^3\. Practicalities$/ }).click();
    await expect(page.getByTestId("edit-practicalities")).toBeVisible();
    await expect(page.locator('[data-field="location"]')).toHaveValue(CITY);
    for (const z of ZONES) {
      await expect(page.getByRole("checkbox", { name: TIMEZONE_BAND_LABELS[z] })).toBeChecked();
    }
    await expect(page.locator('[data-field="budget_min"]')).toHaveValue("70000");
    await expect(page.locator('[data-field="budget_max"]')).toHaveValue("85000");
    await expect(
      page.getByRole("radio", { name: /^No — candidates must already be authorised to work here/ }),
    ).toBeChecked();

    await page.getByRole("button", { name: /^4\. Process and confirm$/ }).click();
    await expect(page.getByTestId("interview-stage")).toHaveCount(2);
    await expect(page.locator('[data-field="decision_maker"]')).toHaveValue("Dana Okoro, COO");

    // ── Clear the time zones (and the city) and save: it must succeed ─────────
    await page.getByRole("button", { name: /^3\. Practicalities$/ }).click();
    for (const z of ZONES) await page.getByRole("checkbox", { name: TIMEZONE_BAND_LABELS[z] }).click();
    await page.locator('[data-field="location"]').fill("");
    await page.getByTestId("save-role").click();
    await expect(page.getByText(/role saved/i).first()).toBeVisible();
    // Save keeps the client on the edit screen (it is the saved intake they can
    // keep altering); the role page is one click away. What matters is that
    // the save was accepted with no time zone and no city.
    expect(new URL(page.url()).pathname).toMatch(new RegExp(`^/client/positions/${positionId}(/edit)?$`));

    // And it stays saved.
    await page.goto(`/client/positions/${positionId}/edit?step=3`, { waitUntil: "domcontentloaded" });
    await dismissTour(page);
    for (const z of ZONES) {
      await expect(page.getByRole("checkbox", { name: TIMEZONE_BAND_LABELS[z] })).not.toBeChecked();
    }
    await expect(page.locator('[data-field="location"]')).toHaveValue("");
  });
});
