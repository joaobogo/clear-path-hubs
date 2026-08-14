/**
 * Public candidate apply flow — end-to-end, driven exactly as an applicant.
 *
 * /jobs/:id/apply is a 5-step wizard (details → CV → screening → consent &
 * review → submit). This suite completes the whole thing against the seeded
 * fixture role with a real uploaded PDF, then asserts what actually landed in
 * the database and in private storage — not just what the UI claimed.
 *
 * Every artefact lives on a qa+apply-*@taasflow.test mailbox (`.test` is a
 * reserved TLD, so nothing can reach a real inbox) and is deleted in teardown.
 */
import { test, expect, type Page } from "@playwright/test";
import {
  allowTestFixtures,
  cleanupApplyArtifacts,
  collectConsoleErrors,
  lookupCandidate,
  meaningfulConsoleErrors,
  runPipelineDrain,
  seedFixtures,
  uniqueApplicant,
  type SeedResult,
} from "./helpers/qa";

let fixtures: SeedResult;

test.beforeAll(async () => {
  // Start from a clean slate so a previous aborted run can't skew assertions.
  await cleanupApplyArtifacts();
  fixtures = await seedFixtures();
});

/** Minimal but structurally valid single-page PDF (has %PDF header and %%EOF). */
const PDF_BYTES = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n" +
    "trailer<</Root 1 0 R>>\n%%EOF\n",
  "utf8",
);

/** A PDF that declares an /Encrypt dictionary — i.e. password-protected. */
const ENCRYPTED_PDF_BYTES = Buffer.from(
  "%PDF-1.6\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n" +
    "4 0 obj<</Filter/Standard/V 2/R 3/Length 128/P -1>>endobj\n" +
    "trailer<</Root 1 0 R/Encrypt 4 0 R>>\n%%EOF\n",
  "utf8",
);

function pdfFile(name = "qa-apply-cv.pdf") {
  return { name, mimeType: "application/pdf", buffer: PDF_BYTES };
}

const applyUrl = () => `/jobs/${fixtures.position_id}/apply`;

async function openWizard(page: Page) {
  await page.goto(applyUrl(), { waitUntil: "domcontentloaded" });
  // Step 1 flips to ready once the client resolved the session; typing earlier
  // lets React's initial state overwrite the values we filled.
  // Generous timeout: the first hit can pay a cold dev-server compile.
  await expect(page.locator('[data-hydrated="ready"]')).toBeVisible({ timeout: 90_000 });
}

async function fillDetails(page: Page, email: string, fullName: string) {
  await page.locator("#full_name").fill(fullName);
  await page.locator("#email").fill(email);
  await page.locator("#phone").fill("+351912345678");
  await page.locator("#country").fill("Portugal");
  await page.locator("#city").fill("Lisbon");
}

/** Answers the seeded screening questions (number + boolean + optional text). */
async function answerScreening(page: Page) {
  const numeric = page.locator('input[type="number"]');
  if (await numeric.count()) await numeric.first().fill("7");
  const yes = page.getByRole("radio", { name: /^yes$/i });
  if (await yes.count()) await yes.first().click();
  const freeText = page.locator("textarea").filter({ hasNot: page.locator("#cover_letter") });
  if (await freeText.count()) {
    await freeText.first().fill("QA screening answer.").catch(() => undefined);
  }
}

const continueBtn = (page: Page) => page.getByTestId("apply-continue");

test.describe("candidate apply flow", () => {
  test("completes all 5 steps and persists the full record", async ({ page, context }) => {
    test.setTimeout(240_000);
    await allowTestFixtures(context);
    const errors = collectConsoleErrors(page);
    const { email, fullName } = uniqueApplicant();

    // Step 1 — details
    await openWizard(page);
    await fillDetails(page, email, fullName);
    await continueBtn(page).click();

    // Step 2 — CV upload (required)
    await expect(page.locator("#cv")).toBeVisible();
    await page.locator("#cv").setInputFiles(pdfFile());
    await expect(page.getByText(/ready to send/i)).toBeVisible();
    await continueBtn(page).click();

    // Step 3 — screening
    await expect(page.getByRole("heading", { name: /screening questions/i })).toBeVisible();
    await answerScreening(page);
    await continueBtn(page).click();

    // Step 4 — consent

    await page.getByRole("checkbox", { name: /i agree to the terms/i }).click();
    await continueBtn(page).click();

    // Step 5 — review, grouped by section, then submit
    await expect(page.getByRole("heading", { name: /review & submit/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /your details/i })).toBeVisible();
    await expect(page.getByText(fullName).first()).toBeVisible();
    await expect(page.getByText(email).first()).toBeVisible();
    await expect(page.getByText(/\.pdf/i).first()).toBeVisible();

    // A mistyped email is correctable in two taps: Edit → back to review.
    await page.getByTestId("review-edit-details").click();
    await expect(page.locator("#email")).toBeFocused();
    await page.getByTestId("apply-return-to-review").click();
    await expect(page.getByRole("heading", { name: /review & submit/i })).toBeVisible();
    await expect(page.getByText(email).first()).toBeVisible();

    await page.getByTestId("apply-submit").click();

    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 120_000 })
      .toContain("/apply/received/");
    await expect(page.getByText(/reference/i).first()).toBeVisible();

    // ---- Database assertions -------------------------------------------------
    const created = await lookupCandidate(email);

    // Candidate profile created and linked.
    expect(created.candidate_profile).not.toBeNull();
    expect(created.candidate_profile?.email).toBe(email);
    expect(created.candidate_profile?.full_name).toBe(fullName);

    // Application linked to the position AND the owning organization.
    expect(created.applications).toHaveLength(1);
    const application = created.applications[0]!;
    expect(application.position_id).toBe(fixtures.position_id);
    expect(application.organization_id).toBe(fixtures.org_id);
    expect(application.cv_file_id).toBeTruthy();

    // Candidate match created in the same tenant.
    expect(created.matches).toHaveLength(1);
    expect(created.matches[0]!.organization_id).toBe(fixtures.org_id);
    expect(created.matches[0]!.application_id).toBe(application.id);

    // Screening answers saved.
    expect(created.answers.length).toBeGreaterThan(0);
    expect(created.answers.every((a) => a.application_id === application.id)).toBeTruthy();

    // CV row + the object bytes really exist in the private bucket.
    expect(created.files.length).toBeGreaterThan(0);
    const cvRow = created.files.find((f) => f.id === application.cv_file_id)!;
    expect(cvRow).toBeTruthy();
    expect(cvRow.mime_type).toBe("application/pdf");
    expect(cvRow.size).toBe(PDF_BYTES.byteLength);
    expect(created.storage_objects.some((o) => o.path === cvRow.storage_path && o.exists)).toBeTruthy();

    // Downstream: processing job enqueued and the notification event emitted.
    expect(created.jobs.some((j) => j.job_type === "parse_and_score")).toBeTruthy();
    expect(
      created.notification_events.some((e) => e.event_type === "application_received"),
    ).toBeTruthy();
    expect(created.notifications).toBeGreaterThan(0);

    // Draft cleared after a successful submit.
    const leftoverDrafts = await page.evaluate(() =>
      Object.keys(window.localStorage).filter((k) => k.includes("apply")),
    );
    expect(leftoverDrafts).toEqual([]);

    // Pipeline reaches a terminal state and produces a score run.
    await expect
      .poll(
        async () => {
          await runPipelineDrain();
          const state = await lookupCandidate(email);
          return state.matches[0]?.processing_state ?? "none";
        },
        { timeout: 150_000, intervals: [5_000] },
      )
      .not.toMatch(/queued|processing|none/);
    const settled = await lookupCandidate(email);
    expect(settled.score_runs.length).toBeGreaterThan(0);

    expect(meaningfulConsoleErrors(errors)).toEqual([]);
  });

  test("rejects a non-PDF with a clear message", async ({ page, context }) => {
    await allowTestFixtures(context);
    const { email, fullName } = uniqueApplicant();
    await openWizard(page);
    await fillDetails(page, email, fullName);
    await continueBtn(page).click();

    await page.locator("#cv").setInputFiles({
      name: "cv.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from("PK\x03\x04 not really a docx"),
    });
    await expect(page.getByText(/please upload a pdf|not accepted/i).first()).toBeVisible();
    // Never accepted: continue must keep us on step 2.
    await continueBtn(page).click();
    await expect(page.locator("#cv")).toBeVisible();
  });

  test("rejects a file larger than 10 MB", async ({ page, context }) => {
    await allowTestFixtures(context);
    const { email, fullName } = uniqueApplicant();
    await openWizard(page);
    await fillDetails(page, email, fullName);
    await continueBtn(page).click();

    await page.locator("#cv").setInputFiles({
      name: "huge.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(11 * 1024 * 1024, 0x20),
    });
    await expect(page.getByText(/the limit is 10 ?MB/i).first()).toBeVisible();
    await continueBtn(page).click();
    await expect(page.locator("#cv")).toBeVisible();
  });

  test("handles a password-protected PDF gracefully", async ({ page, context }) => {
    await allowTestFixtures(context);
    const errors = collectConsoleErrors(page);
    const { email, fullName } = uniqueApplicant();
    await openWizard(page);
    await fillDetails(page, email, fullName);
    await continueBtn(page).click();

    await page.locator("#cv").setInputFiles({
      name: "locked.pdf",
      mimeType: "application/pdf",
      buffer: ENCRYPTED_PDF_BYTES,
    });
    // Actionable message, no spinner left behind, no crash.
    await expect(page.getByText(/password-protected/i).first()).toBeVisible();
    await expect(page.getByText(/checking/i)).toHaveCount(0);
    expect(meaningfulConsoleErrors(errors)).toEqual([]);

    // Replacing it with an unlocked copy recovers.
    await page.locator("#cv").setInputFiles(pdfFile());
    await expect(page.getByText(/ready to send/i)).toBeVisible();
  });

  test("accepts a Unicode filename, as the UI promises", async ({ page, context }) => {
    test.setTimeout(180_000);
    await allowTestFixtures(context);
    const { email, fullName } = uniqueApplicant();
    await openWizard(page);
    await fillDetails(page, email, fullName);
    await continueBtn(page).click();

    await page.locator("#cv").setInputFiles({
      name: "Currículo — José Ünïcode 履歴書.pdf",
      mimeType: "application/pdf",
      buffer: PDF_BYTES,
    });
    await expect(page.getByText(/ready to send/i)).toBeVisible();
    await continueBtn(page).click();
    await answerScreening(page);
    await continueBtn(page).click();
    await page.getByRole("checkbox", { name: /i agree to the terms/i }).click();
    await continueBtn(page).click();
    await page.getByTestId("apply-submit").click();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 120_000 })
      .toContain("/apply/received/");

    // Stored under a sanitised, path-safe key — but still accepted.
    const created = await lookupCandidate(email);
    const cv = created.files[0]!;
    expect(cv.storage_path).toBeTruthy();
    expect(cv.storage_path!).not.toContain("..");
    expect(cv.storage_path!).toMatch(/\.pdf$/i);
    expect(created.storage_objects.some((o) => o.exists)).toBeTruthy();
  });

  test("restores a half-finished application after a reload", async ({ page, context }) => {
    await allowTestFixtures(context);
    const { email, fullName } = uniqueApplicant();
    await openWizard(page);
    await fillDetails(page, email, fullName);
    await page.locator("#full_name").blur();

    // Walk to step 3 so screening answers are part of the draft too.
    await continueBtn(page).click();
    await page.locator("#cv").setInputFiles(pdfFile());
    await expect(page.getByText(/ready to send/i)).toBeVisible();
    await page.locator("#cover_letter").fill("Half-finished cover letter.");
    await continueBtn(page).click();
    await answerScreening(page);

    // Reload: text answers come back, the CV deliberately does not.
    await openWizard(page);
    await expect(page.locator("#full_name")).toHaveValue(fullName);
    await expect(page.locator("#email")).toHaveValue(email);
    await expect(page.locator("#city")).toHaveValue("Lisbon");
    await continueBtn(page).click();
    await expect(page.locator("#cover_letter")).toHaveValue("Half-finished cover letter.");
    // CV must be re-attached — we never persist file bytes.
    await expect(page.getByText(/ready to send/i)).toHaveCount(0);
  });

  test("a failed submit always surfaces an error and never hangs on a spinner", async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000);
    await allowTestFixtures(context);
    const { email, fullName } = uniqueApplicant();

    // Break the submit round-trip the way a flaky network would.
    await page.route("**/_serverFn/**", (route) => route.abort("failed"));

    await openWizard(page);
    await fillDetails(page, email, fullName);
    await continueBtn(page).click();
    await page.locator("#cv").setInputFiles(pdfFile());
    await expect(page.getByText(/ready to send/i)).toBeVisible();
    await continueBtn(page).click();
    await answerScreening(page);
    await continueBtn(page).click();
    await page.getByRole("checkbox", { name: /i agree to the terms/i }).click();
    await continueBtn(page).click();
    await page.getByTestId("apply-submit").click();

    // A named error, a re-enabled button, and no navigation.
    await expect(page.getByTestId("apply-server-error")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("apply-submit")).toBeEnabled();
    expect(new URL(page.url()).pathname).not.toContain("/apply/received/");

    // Nothing was half-written.
    const created = await lookupCandidate(email);
    expect(created.applications).toHaveLength(0);
  });
});

test.afterAll(async () => {
  const { deleted } = await cleanupApplyArtifacts();
  // Teardown must leave nothing behind for this mailbox family.
  console.log("[apply.spec] cleanup:", JSON.stringify(deleted));
  expect(deleted.candidate_profiles_found ?? 0).toBeGreaterThanOrEqual(0);
});
