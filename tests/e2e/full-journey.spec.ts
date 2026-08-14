/**
 * PROMPT 9 — full journey walkthrough.
 *
 * One run of the real product, end to end, on real routes:
 *
 *   intake submitted → admin converts to org + position → position activated →
 *   job visible on the public board → candidate applies with a PDF CV →
 *   processing completes → scoring completes with evidence → admin publishes →
 *   client sees the candidate → shortlists → requests an interview →
 *   interview scheduled → candidate sees it → offer → hire → position filled.
 *
 * Each handoff is checked three ways: the UI a human would look at, the audit
 * row the business relies on later, and the notification that tells the other
 * side something happened. A step that "looks fine" but wrote no trail is a
 * broken handoff, so the trail assertions are soft: the run continues and the
 * printed table names every failure instead of stopping at the first one.
 *
 * All artefacts live on QA_INTAKE_E2E_* / qa+apply-* namespaces and are removed
 * in teardown.
 */
import { test, expect, type Page } from "@playwright/test";
import {
  BASE_URL,
  QA_PASSWORD,
  allowTestFixtures,
  cleanupApplyArtifacts,
  cleanupIntakeArtifacts,
  journeyTrail,
  loginAs,
  lookupCandidate,
  lookupIntake,
  runPipelineDrain,
  seedFixtures,
  trailHas,
  uniqueApplicant,
  uniqueProspect,
  type JourneyTrail,
  type SeedResult,
} from "./helpers/qa";

let fixtures: SeedResult;

test.beforeAll(async () => {
  await cleanupIntakeArtifacts();
  await cleanupApplyArtifacts();
  fixtures = await seedFixtures();
});

test.afterAll(async () => {
  await cleanupIntakeArtifacts();
  await cleanupApplyArtifacts();
});

/** Minimal but structurally valid single-page PDF (CVs are PDF-only). */
const PDF_BYTES = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n" +
    "trailer<</Root 1 0 R>>\n%%EOF\n",
  "utf8",
);

// ── step ledger ───────────────────────────────────────────────────────────────

type StepRow = {
  step: string;
  ui: "PASS" | "FAIL" | "n/a";
  audit: "PASS" | "FAIL" | "n/a";
  notification: "PASS" | "FAIL" | "n/a";
  note: string;
};

const rows: StepRow[] = [];

function record(row: StepRow) {
  rows.push(row);
}

function renderTable(): string {
  const head = ["Step", "UI", "Audit", "Notification", "Note"];
  const body = rows.map((r) => [r.step, r.ui, r.audit, r.notification, r.note]);
  const widths = head.map((h, i) =>
    Math.max(h.length, ...body.map((b) => (b[i] ?? "").length)),
  );
  const line = (cells: string[]) =>
    "| " + cells.map((c, i) => c.padEnd(widths[i]!)).join(" | ") + " |";
  return [
    line(head),
    "|" + widths.map((w) => "-".repeat(w + 2)).join("|") + "|",
    ...body.map(line),
  ].join("\n");
}

/**
 * Soft trail assertion: reads what the handoff persisted and records it without
 * aborting, so one missing notification does not hide the remaining steps.
 */
async function checkTrail(
  step: string,
  ui: "PASS" | "FAIL",
  args: { organizationId: string; positionId?: string; matchId?: string },
  patterns: RegExp[],
  note = "",
): Promise<JourneyTrail> {
  const trail = await journeyTrail(args);
  const hit = trailHas(trail, patterns);
  record({
    step,
    ui,
    audit: hit.audit ? "PASS" : "FAIL",
    notification: hit.notification ? "PASS" : "FAIL",
    note,
  });
  expect.soft(hit.audit, `${step}: audit event recorded`).toBe(true);
  expect.soft(hit.notification, `${step}: notification recorded`).toBe(true);
  return trail;
}

// ── UI helpers ────────────────────────────────────────────────────────────────

const continueBtn = (page: Page) => page.getByTestId("apply-continue");

async function answerScreening(page: Page) {
  const numeric = page.locator('input[type="number"]');
  if (await numeric.count()) await numeric.first().fill("7");
  const yes = page.getByRole("radio", { name: /^yes$/i });
  if (await yes.count()) await yes.first().click();
  const freeText = page.locator("textarea").filter({ hasNot: page.locator("#cover_letter") });
  if (await freeText.count()) {
    await freeText.first().fill("QA journey screening answer.").catch(() => undefined);
  }
}

/** QA fixtures are test records; this scope makes them part of every admin read. */
async function showTestRecords(page: Page) {
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  const toggle = page.getByRole("switch", { name: /show test records/i });
  await expect(toggle).toBeVisible({ timeout: 60_000 });
  if ((await toggle.getAttribute("aria-checked")) !== "true") {
    await toggle.click();
  }
}

/** Posts the same payload the public intake form posts. */
async function submitIntake(companyName: string, email: string) {
  const res = await fetch(`${BASE_URL}/api/public/intake`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idempotencyKey: `journey-${companyName}`,
      firstName: "Dana",
      lastName: "Whitfield",
      currentTitle: "Head of Talent",
      workEmail: email,
      companyName,
      companyWebsite: "northwindhealth.com",
      industry: "Healthcare",
      roleTitle: "Clinical Operations Manager",
      location: "Lisbon, Portugal",
      workModel: "hybrid",
      employmentType: "full_time",
      seniority: "Senior",
      headcount: 1,
      jobDescription:
        "Own trial site readiness, monitoring cadence, vendor performance and inspection " +
        "readiness across three regions, working with data management and quality.",
      hireFromCountries: ["Portugal"],
      targetCountries: ["Portugal"],
      statesRegions: [],
      metroAreas: [],
      mustHaveSkills: ["Clinical operations", "GCP", "Vendor management"],
      niceToHaveSkills: ["CTMS"],
      certificationsList: [],
      toolsPlatforms: [],
      targetTitles: [],
      targetCompanyTypes: [],
      includeKeywords: [],
      excludeKeywords: [],
      disqualifiers: [],
      screeningQuestions: [],
      consent: true,
      password: QA_PASSWORD,
      source: "e2e_full_journey",
    }),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

// ── the walkthrough ───────────────────────────────────────────────────────────

test.describe("full journey walkthrough", () => {
  test("intake to hire, with audit and notification at every handoff", async ({
    page,
    context,
  }, testInfo) => {
    test.setTimeout(1_500_000);
    await allowTestFixtures(context);

    const prospect = uniqueProspect();
    const applicant = uniqueApplicant("JOURNEY");

    // ── 1. Intake submitted ───────────────────────────────────────────────
    const intakeRes = await submitIntake(prospect.companyName, prospect.email);
    expect(intakeRes.status, `intake accepted (${JSON.stringify(intakeRes.body)})`).toBe(200);

    const intake = await lookupIntake(prospect.companyName, prospect.email);
    expect(intake.intake_submission, "intake row persisted").toBeTruthy();
    expect(intake.organization, "workspace created from intake").toBeTruthy();
    const orgId = intake.organization!.id;
    const intakeId = intake.intake_submission!.id;
    await checkTrail(
      "1. Intake submitted",
      "PASS",
      { organizationId: orgId },
      [/intake/i, /lead/i],
      prospect.companyName,
    );

    // ── 2. Admin converts intake to a position ────────────────────────────
    await loginAs(page, "admin", fixtures.users["platform_admin"]!.email);
    await showTestRecords(page);
    await page.goto(`/admin/intake/${intakeId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(prospect.companyName).first()).toBeVisible({ timeout: 60_000 });

    const convert = page.getByRole("button", { name: /convert to position/i });
    let positionId = intake.position?.id ?? null;
    if (await convert.count()) {
      await convert.first().click();
      await expect
        .poll(async () => (await lookupIntake(prospect.companyName)).position?.id ?? null, {
          timeout: 120_000,
          intervals: [2_000, 3_000],
        })
        .toBeTruthy();
      positionId = (await lookupIntake(prospect.companyName)).position!.id;
    }
    expect(positionId, "intake produced a position").toBeTruthy();
    await checkTrail(
      "2. Converted to position",
      "PASS",
      { organizationId: orgId, positionId: positionId! },
      [/position\.(create|convert)/i, /intake/i, /position_approved/i],
    );

    // ── 3. Position activated ─────────────────────────────────────────────
    await page.goto(`/admin/positions/${positionId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 60_000 });

    // The lifecycle bar surfaces exactly one legal forward move at a time, so
    // walk it until the role is active rather than assuming a single click.
    for (let i = 0; i < 5; i++) {
      const current = (await journeyTrail({ organizationId: orgId, positionId: positionId! }))
        .position?.status;
      if (current === "active") break;
      const forward = page
        .getByRole("button", { name: /^(approve|activate|start review|submit)$/i })
        .first();
      if (!(await forward.count())) break;
      await forward.click();
      await page.waitForTimeout(2_500);
    }
    const activated = await journeyTrail({ organizationId: orgId, positionId: positionId! });
    expect(activated.position?.status, "position is active").toBe("active");
    await checkTrail(
      "3. Position activated",
      "PASS",
      { organizationId: orgId, positionId: positionId! },
      [/position\.(status|activate)/i, /position_activated/i],
    );

    // ── 4. Job appears on the public board ────────────────────────────────
    const publicOk = await (async () => {
      await page.goto(`/jobs/${positionId}`, { waitUntil: "domcontentloaded" });
      return page
        .getByText(/clinical operations manager/i)
        .first()
        .isVisible({ timeout: 60_000 })
        .catch(() => false);
    })();
    record({
      step: "4. Public job board",
      ui: publicOk ? "PASS" : "FAIL",
      audit: "n/a",
      notification: "n/a",
      note: `reference ${activated.position?.reference_code ?? "—"}`,
    });
    expect.soft(publicOk, "role is reachable on the public board").toBe(true);

    // ── 5. Candidate applies with a PDF CV ────────────────────────────────
    await page.goto(`/jobs/${positionId}/apply`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-hydrated="ready"]')).toBeVisible({ timeout: 120_000 });
    await page.locator("#full_name").fill(applicant.fullName);
    await page.locator("#email").fill(applicant.email);
    await page.locator("#phone").fill("+351912345678");
    await page.locator("#country").fill("Portugal");
    await page.locator("#city").fill("Lisbon");
    await page.getByRole("checkbox", { name: /create a candidate account/i }).click();
    await page.locator("#password").fill(QA_PASSWORD);
    await page.locator("#password2").fill(QA_PASSWORD);
    await continueBtn(page).click();

    await expect(page.locator("#cv")).toBeVisible();
    await page.locator("#cv").setInputFiles({
      name: "qa-journey-cv.pdf",
      mimeType: "application/pdf",
      buffer: PDF_BYTES,
    });
    await expect(page.getByText(/ready to send/i)).toBeVisible();
    await continueBtn(page).click();

    if (await page.getByRole("heading", { name: /screening questions/i }).count()) {
      await answerScreening(page);
      await continueBtn(page).click();
    }
    await page.getByRole("checkbox", { name: /i agree to the terms/i }).click();
    await continueBtn(page).click();
    await expect(page.getByRole("heading", { name: /review & submit/i })).toBeVisible();
    await page.getByTestId("apply-submit").click();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 150_000 })
      .toContain("/apply/received/");

    const created = await lookupCandidate(applicant.email);
    expect(created.applications, "application persisted").toHaveLength(1);
    expect(created.applications[0]!.cv_file_id, "PDF CV stored").toBeTruthy();
    expect(created.matches, "match created").toHaveLength(1);
    const matchId = created.matches[0]!.id;
    await checkTrail(
      "5. Candidate applied",
      "PASS",
      { organizationId: orgId, positionId: positionId!, matchId },
      [/application/i, /application_received/i],
      applicant.email,
    );

    // ── 6-7. Processing and scoring complete with evidence ────────────────
    for (let i = 0; i < 6; i++) {
      await runPipelineDrain();
      const state = (await lookupCandidate(applicant.email)).matches[0]?.processing_state;
      if (state && /scored|manual_review_required/.test(state)) break;
      await page.waitForTimeout(5_000);
    }
    const processed = await journeyTrail({ organizationId: orgId, positionId: positionId!, matchId });
    const processedOk = /scored|ready_to_score|manual_review_required/.test(
      processed.match?.processing_state ?? "",
    );
    record({
      step: "6. Processing complete",
      ui: processedOk ? "PASS" : "FAIL",
      audit: processed.audit_events.some((e) => /cv|parse|process/i.test(e.event_type))
        ? "PASS"
        : "FAIL",
      notification: "n/a",
      note: `state ${processed.match?.processing_state ?? "—"}`,
    });
    expect.soft(processedOk, "CV processing reached a terminal state").toBe(true);

    const scoredOk =
      processed.match?.total_score !== null && processed.match?.total_score !== undefined;
    record({
      step: "7. Scoring complete",
      ui: scoredOk ? "PASS" : "FAIL",
      audit: processed.audit_events.some((e) => /scor/i.test(e.event_type)) ? "PASS" : "FAIL",
      notification: processed.notifications.some((n) => /scor/i.test(n.event_type)) ? "PASS" : "n/a",
      note: `score ${processed.match?.total_score ?? "—"} band ${processed.match?.score_band ?? "—"}`,
    });
    expect.soft(scoredOk, "a score run bound to this match exists").toBe(true);

    // ── 8. Admin publishes the candidate to the client ────────────────────
    await loginAs(page, "admin", fixtures.users["platform_admin"]!.email);
    await showTestRecords(page);
    await page.goto(`/admin/review/${matchId}`, { waitUntil: "domcontentloaded" });
    const approve = page.getByRole("button", { name: /^(approve|publish)/i }).first();
    if (await approve.count()) await approve.click();
    await expect
      .poll(
        async () =>
          (await journeyTrail({ organizationId: orgId, matchId })).match?.client_visibility,
        { timeout: 120_000, intervals: [2_000, 3_000] },
      )
      .toBe("visible");
    await checkTrail(
      "8. Admin published candidate",
      "PASS",
      { organizationId: orgId, positionId: positionId!, matchId },
      [/match\.visibility/i, /candidate_published/i, /approve/i],
    );

    // ── 9. Client sees the candidate ──────────────────────────────────────
    await loginAs(page, "client", prospect.email, QA_PASSWORD);
    await page.goto(`/client/candidates/${matchId}`, { waitUntil: "domcontentloaded" });
    const clientSees = await page
      .getByText(applicant.fullName.split(" ")[0]!)
      .first()
      .isVisible({ timeout: 90_000 })
      .catch(() => false);
    record({
      step: "9. Client sees candidate",
      ui: clientSees ? "PASS" : "FAIL",
      audit: "n/a",
      notification: "n/a",
      note: "",
    });
    expect.soft(clientSees, "published candidate is visible to the client").toBe(true);

    // ── 10-12. Shortlist, request interview, advance ──────────────────────
    const advanceOnce = async (label: RegExp) => {
      const btn = page.getByRole("button", { name: label }).first();
      if (!(await btn.count())) return false;
      await btn.click();
      await page.waitForTimeout(3_000);
      return true;
    };

    const shortlisted = await advanceOnce(/advance to shortlist/i);
    await checkTrail(
      "10. Client shortlisted",
      shortlisted ? "PASS" : "FAIL",
      { organizationId: orgId, positionId: positionId!, matchId },
      [/shortlist/i, /client_shortlisted/i],
    );

    const interviewRequested = await advanceOnce(/advance to interview/i);
    await checkTrail(
      "11. Interview requested",
      interviewRequested ? "PASS" : "FAIL",
      { organizationId: orgId, positionId: positionId!, matchId },
      [/interview/i],
    );

    // ── 13. Interview scheduled ───────────────────────────────────────────
    await page.goto("/client/interviews", { waitUntil: "domcontentloaded" });
    const interviewVisible = await page
      .getByText(applicant.fullName.split(" ")[0]!)
      .first()
      .isVisible({ timeout: 90_000 })
      .catch(() => false);
    record({
      step: "12. Interview on client board",
      ui: interviewVisible ? "PASS" : "FAIL",
      audit: "n/a",
      notification: "n/a",
      note: "",
    });
    expect.soft(interviewVisible, "requested interview appears for the client").toBe(true);

    // ── 14. Candidate sees their application state ────────────────────────
    await loginAs(page, "candidate", applicant.email, QA_PASSWORD);
    await page.goto("/me/applications", { waitUntil: "domcontentloaded" });
    const candidateSees = await page
      .getByText(/clinical operations manager/i)
      .first()
      .isVisible({ timeout: 90_000 })
      .catch(() => false);
    record({
      step: "13. Candidate sees progress",
      ui: candidateSees ? "PASS" : "FAIL",
      audit: "n/a",
      notification: "n/a",
      note: "",
    });
    expect.soft(candidateSees, "candidate sees their own application").toBe(true);

    // ── 15. Offer and hire ────────────────────────────────────────────────
    await loginAs(page, "client", prospect.email, QA_PASSWORD);
    await page.goto(`/client/candidates/${matchId}`, { waitUntil: "domcontentloaded" });
    const offered = await advanceOnce(/advance to offer/i);
    await checkTrail(
      "14. Offer stage",
      offered ? "PASS" : "FAIL",
      { organizationId: orgId, positionId: positionId!, matchId },
      [/offer/i],
    );

    const hired = await advanceOnce(/(advance to hire|mark as hired|confirm hire)/i);
    await checkTrail(
      "15. Hire confirmed",
      hired ? "PASS" : "FAIL",
      { organizationId: orgId, positionId: positionId!, matchId },
      [/hire/i, /candidate_hired/i],
    );

    // ── 16. Position filled ───────────────────────────────────────────────
    await loginAs(page, "admin", fixtures.users["platform_admin"]!.email);
    await showTestRecords(page);
    await page.goto(`/admin/positions/${positionId}`, { waitUntil: "domcontentloaded" });
    const fill = page.getByRole("button", { name: /mark filled/i }).first();
    let filledUi = false;
    if (await fill.count()) {
      await fill.click();
      await page.waitForTimeout(3_000);
      const reason = page.getByRole("textbox").first();
      if (await reason.count()) {
        await reason.fill("Hired through the journey walkthrough.").catch(() => undefined);
        await page
          .getByRole("button", { name: /^(confirm|mark filled|save)/i })
          .first()
          .click()
          .catch(() => undefined);
      }
      await page.waitForTimeout(3_000);
      filledUi =
        (await journeyTrail({ organizationId: orgId, positionId: positionId! })).position?.status ===
        "filled";
    }
    await checkTrail(
      "16. Position filled",
      filledUi ? "PASS" : "FAIL",
      { organizationId: orgId, positionId: positionId! },
      [/position\.(status|filled)/i, /position_filled/i],
    );

    // ── Report ────────────────────────────────────────────────────────────
    const table = renderTable();
    const broken = rows.filter(
      (r) => r.ui === "FAIL" || r.audit === "FAIL" || r.notification === "FAIL",
    );
    const report = `${table}\n\nBroken handoffs: ${broken.length}\n`;
    console.log(`\n${report}`);
    await testInfo.attach("full-journey-report.md", {
      body: report,
      contentType: "text/markdown",
    });
  });
});
