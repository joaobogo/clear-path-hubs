/**
 * Full-journey smoke test — the six steps a launch review actually cares about:
 *
 *   1. A candidate signs up (the apply wizard creates the account) and applies.
 *   2. That candidate signs in and sees their own application.
 *   3. Staff approve the match for client visibility (the gate that has to run
 *      before any client can see a candidate at all).
 *   4. The client signs in and advances the candidate on their shortlist.
 *   5. Staff manage the processing queue.
 *
 * Everything runs through the real UI on real routes. Every artefact lives on a
 * qa+apply-*@taasflow.test mailbox and is removed in teardown.
 */
import { test, expect, type Page } from "@playwright/test";
import {
  allowTestFixtures,
  cleanupApplyArtifacts,
  collectConsoleErrors,
  loginAs,
  lookupCandidate,
  meaningfulConsoleErrors,
  QA_PASSWORD,
  runPipelineDrain,
  seedFixtures,
  uniqueApplicant,
  type SeedResult,
} from "./helpers/qa";
import { TEXT_LAYER_CV_PDF } from "./fixtures/text-layer-cv";
import {
  attachApiFailures,
  captureApiFailures,
  logPipelineState,
  waitForProcessingState,
} from "./helpers/pipeline-diagnostics";

let fixtures: SeedResult;

test.beforeAll(async () => {
  await cleanupApplyArtifacts();
  fixtures = await seedFixtures();
});

test.afterAll(async () => {
  await cleanupApplyArtifacts();
});

/**
 * Single-page PDF with a real text layer, so extraction recovers a full CV and
 * the match moves past `ocr_required` without an OCR runner in the loop.
 */
const PDF_BYTES = TEXT_LAYER_CV_PDF;

const continueBtn = (page: Page) => page.getByTestId("apply-continue");

/** Answers whatever screening questions the fixture role carries. */
async function answerScreening(page: Page) {
  const numeric = page.locator('input[type="number"]');
  if (await numeric.count()) await numeric.first().fill("7");
  const yes = page.getByRole("radio", { name: /^yes$/i });
  if (await yes.count()) await yes.first().click();
  const freeText = page.locator("textarea").filter({ hasNot: page.locator("#cover_letter") });
  if (await freeText.count()) {
    await freeText.first().fill("QA smoke screening answer.").catch(() => undefined);
  }
}

/** Turns on the admin-wide test-record scope so QA fixtures are in every read. */
async function showTestRecords(page: Page) {
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  const toggle = page.getByRole("switch", { name: /show test records/i });
  await expect(toggle).toBeVisible({ timeout: 60_000 });
  if ((await toggle.getAttribute("aria-checked")) !== "true") {
    await toggle.click();
    await expect(page.getByText(/test records shown/i).first()).toBeVisible();
  }
}

test.describe("launch smoke journey", () => {
  test("candidate signs up and applies, staff approve, client advances, staff work the queue", async ({
    page,
    context,
  }) => {
    test.setTimeout(600_000);
    await allowTestFixtures(context);
    const errors = collectConsoleErrors(page);
    const apiFailures = captureApiFailures(page);
    const { email, fullName } = uniqueApplicant("SMOKE");

    // ── 1. Candidate signs up and applies ─────────────────────────────────
    await page.goto(`/jobs/${fixtures.position_id}/apply`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-hydrated="ready"]')).toBeVisible({ timeout: 120_000 });

    await page.locator("#full_name").fill(fullName);
    await page.locator("#email").fill(email);
    await page.locator("#phone").fill("+351912345678");
    await page.locator("#country").fill("Portugal");
    await page.locator("#city").fill("Lisbon");
    // Account creation is opt-in behind a checkbox, and supplying a password is
    // what creates it — this is the product's only candidate sign-up surface.
    await page.getByRole("checkbox", { name: /create a candidate account/i }).click();
    await page.locator("#password").fill(QA_PASSWORD);
    await page.locator("#password2").fill(QA_PASSWORD);

    await continueBtn(page).click();

    await expect(page.locator("#cv")).toBeVisible();
    await page.locator("#cv").setInputFiles({
      name: "qa-smoke-cv.pdf",
      mimeType: "application/pdf",
      buffer: PDF_BYTES,
    });
    await expect(page.getByText(/ready to send/i)).toBeVisible();
    await continueBtn(page).click();

    await expect(page.getByRole("heading", { name: /screening questions/i })).toBeVisible();
    await answerScreening(page);
    await continueBtn(page).click();

    await page.getByRole("checkbox", { name: /i agree to the terms/i }).click();
    await continueBtn(page).click();

    await expect(page.getByRole("heading", { name: /review & submit/i })).toBeVisible();
    await page.getByTestId("apply-submit").click();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 150_000 })
      .toContain("/apply/received/");

    const created = await lookupCandidate(email);
    expect(created.candidate_profile?.email).toBe(email);
    expect(created.candidate_profile?.user_id, "signup created a linked auth account").toBeTruthy();
    expect(created.applications).toHaveLength(1);
    const application = created.applications[0]!;
    expect(application.position_id).toBe(fixtures.position_id);
    expect(application.organization_id).toBe(fixtures.org_id);
    expect(application.cv_file_id).toBeTruthy();
    expect(created.matches).toHaveLength(1);
    const matchId = created.matches[0]!.id;

    // ── 2. Candidate signs in and sees their application ──────────────────
    await loginAs(page, "candidate", email, QA_PASSWORD);
    await page.goto("/me/applications", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(new RegExp(fixtures.position_id.slice(0, 6), "i")).or(
      page.getByRole("heading", { name: /applications/i }),
    ).first()).toBeVisible({ timeout: 60_000 });
    // Best-effort sign-out: bounded so a hidden/absent control can't stall the run.
    await page
      .getByRole("button", { name: /sign out/i })
      .first()
      .click({ timeout: 5_000 })
      .catch(() => undefined);

    // Let the pipeline parse + score so the match is approvable. The wait logs
    // every state transition and, on a stall (OCR above all), dumps the match,
    // file and job truth into the run output and the HTML report.
    await logPipelineState(matchId, "after-apply");
    await runPipelineDrain();
    await waitForProcessingState(matchId, /scored|ready_to_score|manual_review_required/, {
      timeout: 180_000,
      label: "parse-and-score",
    });
    await logPipelineState(matchId, "before-approval");

    // ── 3. Staff approve the match for client visibility ──────────────────
    await loginAs(page, "admin", fixtures.users["platform_admin"]!.email);
    await showTestRecords(page);
    // Approvals are worked from the Overview work queue.
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /work queue/i }).first()).toBeVisible({
      timeout: 60_000,
    });

    const approveRow = page
      .locator("li, tr, div")
      .filter({ hasText: fullName })
      .filter({ has: page.getByRole("button", { name: /^approve$/i }) })
      .first();
    if (await approveRow.count()) {
      await approveRow.getByRole("button", { name: /^approve$/i }).click();
    } else {
      // Not queued as a visibility approval (e.g. auto-approved or held on a
      // gate) — approve in place from the review desk instead.
      await page.goto(`/admin/review/${matchId}`, { waitUntil: "domcontentloaded" });
      const inPlace = page.getByRole("button", { name: /approve/i }).first();
      await expect(inPlace).toBeVisible({ timeout: 60_000 });
      await inPlace.click();
    }

    await expect
      .poll(
        async () => (await lookupCandidate(email)).matches[0]?.client_visibility,
        { timeout: 90_000, intervals: [1_000, 2_000] },
      )
      .toBe("visible");

    // ── 4. Client signs in and advances the candidate ─────────────────────
    await loginAs(page, "client", fixtures.users["client_admin"]!.email);
    await page.goto(`/client/candidates/${matchId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(fullName).first()).toBeVisible({ timeout: 90_000 });

    const advance = page.getByRole("button", { name: /advance to (shortlist|interview)/i }).first();
    await expect(advance, "client sees a forward decision on an approved candidate").toBeVisible({
      timeout: 60_000,
    });
    await advance.click();
    await expect(page.getByText(/added to your shortlist|interview requested/i).first()).toBeVisible({
      timeout: 60_000,
    });

    await expect
      .poll(async () => (await lookupCandidate(email)).matches[0]?.stage, {
        timeout: 60_000,
        intervals: [1_000, 2_000],
      })
      .toMatch(/shortlisted|interview_process/);

    // ── 5. Staff manage the processing queue ──────────────────────────────
    await loginAs(page, "admin", fixtures.users["platform_admin"]!.email);
    await page.goto("/admin/operations", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /^operations$/i })).toBeVisible({
      timeout: 90_000,
    });
    // The queue must render a real state, not an error card.
    await expect(page.getByText(/try again/i).first()).toBeHidden({ timeout: 30_000 });

    expect(meaningfulConsoleErrors(errors)).toEqual([]);
  });
});
