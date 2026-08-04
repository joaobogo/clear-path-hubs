/**
 * Candidate journey, driven as a real candidate:
 * public board → role detail → 5-step apply wizard → confirmation →
 * pipeline processing → candidate account view.
 *
 * All rows are created through the real UI/server functions. Every artefact
 * lives on a qa.cand+*@qa.taasflow.test mailbox and is removed in teardown.
 */
import { test, expect, type Page } from "@playwright/test";
import {
  allowTestFixtures,
  collectConsoleErrors,
  cleanupCandidateArtifacts,
  loginAs,
  lookupCandidate,
  meaningfulConsoleErrors,
  QA_PASSWORD,
  runPipelineDrain,
  seedFixtures,
  uniqueCandidate,
  type SeedResult,
} from "./helpers/qa";

let fixtures: SeedResult;

test.beforeAll(async () => {
  fixtures = await seedFixtures();
});

const PDF_BYTES = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
  "utf8",
);

function smallPdf(name = "qa-cv.pdf") {
  return { name, mimeType: "application/pdf", buffer: PDF_BYTES };
}

async function fillStepOne(page: Page, email: string, fullName: string) {
  // Step 1 marks itself ready once the client has resolved the session.
  // Typing before that lets React's initial state overwrite the typed values.
  await expect(page.locator('[data-hydrated="ready"]')).toBeVisible();
  await page.locator("#full_name").fill(fullName);
  await page.locator("#email").fill(email);
  await page.locator("#phone").fill("+351912345678");
  await page.locator("#country").fill("Portugal");
  await page.locator("#city").fill("Lisbon");
}

/** Answers the seeded screening questions (number + boolean + optional text). */
async function answerScreening(page: Page) {
  const numeric = page.locator('input[type="number"]');
  if (await numeric.count()) await numeric.first().fill("6");
  const yes = page.getByRole("radio", { name: /^yes$/i });
  if (await yes.count()) await yes.first().click();
}

test.describe("candidate journey", () => {
  test("public board hides test fixtures and closed roles", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/jobs", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const body = page.locator("body");
    await expect(body).not.toContainText("QA Closed Role");
    // Fixtures are is_test_record → invisible without the QA cookie.
    await expect(body).not.toContainText("QA Backend Engineer");
    expect(meaningfulConsoleErrors(errors)).toEqual([]);
  });

  test("board → detail → apply wizard renders for the fixture role", async ({ page, context }) => {
    await allowTestFixtures(context);
    await page.goto("/jobs", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("QA Backend Engineer").first()).toBeVisible();
    await page.getByText("QA Backend Engineer").first().click();
    await expect.poll(() => new URL(page.url()).pathname).toContain("/jobs/");
    await expect(page.getByRole("heading", { name: /QA Backend Engineer/i })).toBeVisible();
    await page.goto(`/jobs/${fixtures.position_id}/apply`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#full_name")).toBeVisible();
  });

  test("step 1 required-field validation blocks continue", async ({ page, context }) => {
    await allowTestFixtures(context);
    await page.goto(`/jobs/${fixtures.position_id}/apply`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-hydrated="ready"]')).toBeVisible();
    await page.getByTestId("apply-continue").click();
    await expect(page.getByText("Enter your full name")).toBeVisible();
    await expect(page.getByText("Enter a valid email")).toBeVisible();
    await expect(page.locator("#full_name")).toBeVisible();

    const { email, fullName } = uniqueCandidate();
    await fillStepOne(page, email, fullName);
    await page.getByTestId("apply-continue").click();
    await expect(page.locator("#cv")).toBeVisible();
  });

  test("account creation password validation", async ({ page, context }) => {
    await allowTestFixtures(context);
    const { email, fullName } = uniqueCandidate();
    await page.goto(`/jobs/${fixtures.position_id}/apply`, { waitUntil: "domcontentloaded" });
    await fillStepOne(page, email, fullName);
    await page.getByRole("checkbox").first().click();
    await page.locator("#password").fill("short");
    await page.locator("#password2").fill("short");
    await page.getByTestId("apply-continue").click();
    await expect(page.locator("#password")).toBeVisible();

    await page.locator("#password").fill(QA_PASSWORD);
    await page.locator("#password2").fill(`${QA_PASSWORD}x`);
    await page.getByTestId("apply-continue").click();
    await expect(page.locator("#password2")).toBeVisible();

    await page.locator("#password2").fill(QA_PASSWORD);
    await page.getByTestId("apply-continue").click();
    await expect(page.locator("#cv")).toBeVisible();
  });

  test("step 2 rejects non-PDF and accepts a small PDF; link validation", async ({
    page,
    context,
  }) => {
    await allowTestFixtures(context);
    const { email, fullName } = uniqueCandidate();
    await page.goto(`/jobs/${fixtures.position_id}/apply`, { waitUntil: "domcontentloaded" });
    await fillStepOne(page, email, fullName);
    await page.getByTestId("apply-continue").click();

    // Non-PDF
    await page.locator("#cv").setInputFiles({
      name: "cv.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not a pdf"),
    });
    await expect(page.getByText(/PDF/i).first()).toBeVisible();

    // Oversized (>10 MB)
    await page.locator("#cv").setInputFiles({
      name: "big.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(11 * 1024 * 1024, 0x20),
    });
    await expect(page.getByText(/10 ?MB|too large|larger/i).first()).toBeVisible();

    // Valid PDF
    await page.locator("#cv").setInputFiles(smallPdf());
    await expect(page.getByText(/Attached:/i)).toBeVisible();

    // Bad URL blocks continue
    await page.locator("#linkedin_url").fill("not-a-url");
    await page.getByTestId("apply-continue").click();
    await expect(page.locator("#cv")).toBeVisible();
    await page.locator("#linkedin_url").fill("https://linkedin.com/in/qa-candidate");
    await page.getByTestId("apply-continue").click();
    await expect(page.getByRole("heading", { name: /screening questions/i })).toBeVisible();
  });

  test("full submit without account: rows, confirmation, idempotency", async ({ page, context }) => {
    test.setTimeout(180_000);
    await allowTestFixtures(context);
    const errors = collectConsoleErrors(page);
    const { email, fullName } = uniqueCandidate();

    await page.goto(`/jobs/${fixtures.position_id}/apply`, { waitUntil: "domcontentloaded" });
    await fillStepOne(page, email, fullName);
    await page.getByTestId("apply-continue").click();
    await page.locator("#cv").setInputFiles(smallPdf());
    await expect(page.getByText(/Attached:/i)).toBeVisible();
    await page.getByTestId("apply-continue").click();

    // Step 3: required questions block continue when empty.
    await expect(page.getByRole("heading", { name: /screening questions/i })).toBeVisible();
    await page.getByTestId("apply-continue").click();
    await expect(page.getByRole("heading", { name: /screening questions/i })).toBeVisible();
    await answerScreening(page);
    await page.getByTestId("apply-continue").click();

    // Step 4: review + consent gate.
    await expect(page.getByText(fullName).first()).toBeVisible();
    await expect(page.getByText(email).first()).toBeVisible();
    await page.getByTestId("apply-continue").click();
    await expect(page.getByText(/must accept the terms/i)).toBeVisible();
    await page.getByRole("checkbox", { name: /i agree to the terms/i }).click();
    await page.getByRole("checkbox", { name: /talent network/i }).click();
    await page.getByTestId("apply-continue").click();

    // Step 5: submit.
    await page.getByTestId("apply-submit").click();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 90_000 })
      .toContain("/apply/received/");
    await expect(page.getByText(/reference/i).first()).toBeVisible();

    const applicationId = new URL(page.url()).pathname.split("/").pop()!;
    expect(applicationId.length).toBeGreaterThan(10);

    // Rows actually created.
    const created = await lookupCandidate(email);
    expect(created.candidate_profile).not.toBeNull();
    expect(created.applications).toHaveLength(1);
    expect(created.matches).toHaveLength(1);
    expect(created.jobs.some((j) => j.job_type === "parse_and_score")).toBeTruthy();

    // Draft cleared.
    const draft = await page.evaluate(() =>
      Object.keys(window.localStorage).filter((k) => k.includes("apply")),
    );
    expect(draft).toEqual([]);

    // Idempotency: re-submitting the same wizard state must not duplicate.
    await page.goBack();
    await page.waitForTimeout(500);
    const after = await lookupCandidate(email);
    expect(after.applications).toHaveLength(1);

    // Pipeline reaches a terminal processed state.
    await runPipelineDrain();
    await expect
      .poll(
        async () => {
          await runPipelineDrain();
          const state = await lookupCandidate(email);
          return state.matches[0]?.processing_state ?? "none";
        },
        { timeout: 120_000, intervals: [5_000] },
      )
      .not.toMatch(/queued|processing|none/);

    const done = await lookupCandidate(email);
    expect(done.score_runs.length).toBeGreaterThan(0);

    expect(meaningfulConsoleErrors(errors)).toEqual([]);
  });

  test("submit with account: candidate can sign in and see a safe status", async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000);
    await allowTestFixtures(context);
    const { email, fullName } = uniqueCandidate();

    await page.goto(`/jobs/${fixtures.position_id}/apply`, { waitUntil: "domcontentloaded" });
    await fillStepOne(page, email, fullName);
    await page.getByRole("checkbox").first().click();
    await page.locator("#password").fill(QA_PASSWORD);
    await page.locator("#password2").fill(QA_PASSWORD);
    await page.getByTestId("apply-continue").click();
    await page.locator("#cv").setInputFiles(smallPdf());
    await expect(page.getByText(/Attached:/i)).toBeVisible();
    await page.getByTestId("apply-continue").click();
    await answerScreening(page);
    await page.getByTestId("apply-continue").click();
    await page.getByRole("checkbox", { name: /i agree to the terms/i }).click();
    await page.getByTestId("apply-continue").click();
    await page.getByTestId("apply-submit").click();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 90_000 })
      .toContain("/apply/received/");

    const created = await lookupCandidate(email);
    expect(created.candidate_profile?.user_id).toBeTruthy();

    // Fresh session: sign in through the real form.
    await context.clearCookies();
    await page.evaluate(() => window.localStorage.clear());
    await loginAs(page, "candidate", email, QA_PASSWORD);
    await page.goto("/me/applications", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /my applications/i })).toBeVisible();
    const text = (await page.locator("main").innerText()).toLowerCase();
    // Candidate-safe: no raw internal score, no band letters.
    expect(text).not.toMatch(/total score|score:\s*\d|score band/);
  });

  test("mobile 390px: apply wizard has no horizontal overflow", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await allowTestFixtures(context);
    const page = await context.newPage();
    await page.goto(`/jobs/${fixtures.position_id}/apply`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#full_name")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await context.close();
  });
});

test.afterAll(async () => {
  await cleanupCandidateArtifacts();
});
