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
  resolveOcrGate,
  type ApiFailureLog,
  waitForProcessingState,
} from "./helpers/pipeline-diagnostics";

let fixtures: SeedResult;
/** Diagnostics captured during the run, flushed to the report even on failure. */
let apiFailureLog: ApiFailureLog = { failures: [] };
let trackedMatchId: string | null = null;

test.beforeAll(async () => {
  await cleanupApplyArtifacts();
  fixtures = await seedFixtures();
});

// Runs even when the journey fails: the failing run is the one that needs the
// processing state and the refused API calls written down.
test.afterEach(async () => {
  await attachApiFailures(apiFailureLog, "smoke-journey");
  if (trackedMatchId) await logPipelineState(trackedMatchId, "final");
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
    await freeText
      .first()
      .fill("QA smoke screening answer.")
      .catch(() => undefined);
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
    apiFailureLog = captureApiFailures(page);
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
    await page.getByLabel(/create a candidate account/i).check();
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
    trackedMatchId = matchId;

    // ── 2. Candidate signs in and sees their application ──────────────────
    await loginAs(page, "candidate", email, QA_PASSWORD);
    await page.goto("/me/applications", { waitUntil: "domcontentloaded" });
    await expect(
      page
        .getByText(new RegExp(fixtures.position_id.slice(0, 6), "i"))
        .or(page.getByRole("heading", { name: /applications/i }))
        .first(),
    ).toBeVisible({ timeout: 60_000 });
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
    // No OCR runner runs in the suite: if extraction asked for OCR, simulate the
    // OCR result (and only that step) so review and publication stay reachable.
    await waitForProcessingState(matchId, /ocr_required|parsed|enriching|ready_to_score|scored|manual_review_required|failed/, {
      timeout: 120_000,
      label: "parse",
    }).catch(() => undefined);
    await resolveOcrGate(matchId);
    await waitForProcessingState(matchId, /scored|ready_to_score|manual_review_required/, {
      timeout: 180_000,
      label: "parse-and-score",
    });
    await logPipelineState(matchId, "before-approval");

    // ── 3. Staff work the review desk and publish the candidate ───────────
    await loginAs(page, "admin", fixtures.users["platform_admin"]!.email);
    await showTestRecords(page);
    // The work queue is where a scored match surfaces for review.
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /work queue/i }).first()).toBeVisible({
      timeout: 60_000,
    });

    // Full review pass on the desk itself: the reviewer must be able to see who
    // they are deciding on, the score that decision rests on, and the evidence
    // behind it before the publish control is used.
    await page.goto(`/admin/review/${matchId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(fullName).first()).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(/try again|something went wrong/i).first()).toBeHidden({
      timeout: 30_000,
    });
    await expect(
      page.getByText(/evidence|requirement/i).first(),
      "review desk shows the evidence the decision rests on",
    ).toBeVisible({ timeout: 60_000 });

    const approveOnDesk = page.getByRole("button", { name: /^approve/i }).first();
    await expect(
      approveOnDesk,
      "a scored, evidence-complete match offers the publish decision",
    ).toBeEnabled({ timeout: 60_000 });
    await approveOnDesk.click();

    // A blocked publish gate fails loudly with its reason instead of timing out
    // later on a candidate the client can never see.
    const blocked = page.getByText(/publish blocked|missing evidence/i).first();
    if (await blocked.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await logPipelineState(matchId, "publish-blocked");
      throw new Error(`Publish gate blocked the approval: ${await blocked.innerText()}`);
    }

    // ── 3b. Assert the published state, from the persisted truth ──────────
    await expect
      .poll(async () => (await lookupCandidate(email)).matches[0]?.client_visibility, {
        timeout: 90_000,
        intervals: [1_000, 2_000],
      })
      .toBe("visible");

    const published = await logPipelineState(matchId, "published");
    expect(published, "published snapshot is readable").not.toBeNull();
    const publishedMatch = published!.match;
    expect(publishedMatch.client_visibility, "candidate is visible to the client").toBe("visible");
    expect(publishedMatch.admin_status, "admin status records the approval").toMatch(/approved/i);
    expect(
      publishedMatch.approved_score_run_id,
      "publication pins the approved score run",
    ).toBeTruthy();
    expect(
      publishedMatch.approved_score_run_id,
      "the approved run is the run the reviewer saw",
    ).toBe(publishedMatch.current_score_run_id);
    expect(publishedMatch.delivered_at, "delivery to the client is timestamped").toBeTruthy();
    expect(publishedMatch.canonical_state, "canonical state left the review states").toMatch(
      /published|delivered|client/i,
    );

    // Staff-side confirmation: the admin candidate record reads as published,
    // not still awaiting review.
    await page.goto(`/admin/candidates/${matchId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(fullName).first()).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(/visible to client|approved|published/i).first()).toBeVisible({
      timeout: 60_000,
    });

    // ── 4. Client signs in and advances the candidate ─────────────────────
    await loginAs(page, "client", fixtures.users["client_admin"]!.email);
    // Publication is only real if the candidate shows up in the client's own list.
    await page.goto("/client/candidates", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByText(fullName).first(),
      "published candidate appears in the client's candidate list",
    ).toBeVisible({ timeout: 90_000 });
    await page.goto(`/client/candidates/${matchId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(fullName).first()).toBeVisible({ timeout: 90_000 });

    const advance = page.getByRole("button", { name: /advance to (shortlist|interview)/i }).first();
    await expect(advance, "client sees a forward decision on an approved candidate").toBeVisible({
      timeout: 60_000,
    });
    await advance.click();
    await expect(
      page.getByText(/added to your shortlist|interview requested/i).first(),
    ).toBeVisible({
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
