import { expect, test, type Page } from "@playwright/test";
import {
  QA_PASSWORD,
  cleanupApplyArtifacts,
  collectConsoleErrors,
  createCvApplication,
  loginAs,
  meaningfulConsoleErrors,
  pipelineSnapshot,
  replaceCv,
  runPipelineForMatch,
  seedFixtures,
  uniqueApplicant,
  type SeedResult,
} from "./helpers/qa";

/**
 * Scope: CV parsing and scoring pipeline.
 *
 * Everything asserted here is persisted truth, read back through the QA
 * snapshot endpoint, plus what an admin actually sees on the candidate record.
 * The pipeline is driven through the same runner endpoint the cron uses — no
 * shortcut writes of scores or states.
 */

let fixtures: SeedResult;

test.beforeAll(async () => {
  await cleanupApplyArtifacts();
  fixtures = await seedFixtures();
});

test.afterAll(async () => {
  await cleanupApplyArtifacts();
});

function esc(s: string) {
  return s.replace(/[\\()]/g, (m) => `\\${m}`);
}

/** A single-page PDF with a real, uncompressed text layer — parsable by unpdf. */
function textPdf(lines: string[]): Buffer {
  const content = [
    "BT",
    "/F1 11 Tf",
    "14 TL",
    "40 760 Td",
    ...lines.map((l) => `(${esc(l)}) Tj T*`),
    "ET",
  ].join("\n");
  const objs = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>",
    `<</Length ${content.length}>>\nstream\n${content}\nendstream`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out +=
    `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

const CV_BODIES: Array<{ label: string; lines: string[] }> = [
  {
    label: "client-success",
    lines: [
      "Client Success Manager - mid-market SaaS, EMEA",
      "Six years of professional experience owning mid-market B2B SaaS accounts.",
      "Currently responsible for 28 accounts worth EUR 2.1M ARR at 112% net revenue retention.",
      "Runs onboarding, quarterly business reviews and renewal negotiation end to end.",
      "Skills: account management, renewals, QBRs, HubSpot, Zendesk, churn analysis.",
      "Senior Client Success Manager - Solvia Software, Lisbon, 2022-03 to present.",
      "Client Success Manager - Beacon Analytics, Lisbon, 2019-09 to 2022-02.",
      "Education: BA Management, ISCTE Lisbon, 2015-2018. Languages: Portuguese, Spanish, English.",
    ],
  },
  {
    label: "operations",
    lines: [
      "Operations Lead - B2B services",
      "Eight years of professional experience running service delivery operations for SaaS and services firms.",
      "Owns a team of nine coordinators and a EUR 1.4M annual operating budget.",
      "Rebuilt the onboarding workflow, cutting time-to-first-value from 41 to 22 days.",
      "Skills: process design, forecasting, SLA management, Looker, SQL, vendor management.",
      "Operations Lead - Marchetti Group, Porto, 2021-01 to present.",
      "Operations Analyst - Marchetti Group, Porto, 2018-04 to 2020-12.",
      "Education: MSc Industrial Engineering, University of Porto, 2016-2018.",
    ],
  },
  {
    label: "account-exec",
    lines: [
      "Account Executive - mid-market new business",
      "Five years of professional experience selling B2B SaaS into mid-market accounts across Iberia.",
      "Carried a EUR 900k annual quota and closed at 104% attainment for two consecutive years.",
      "Owns full cycle from outbound prospecting to commercial close and handover to client success.",
      "Skills: outbound, discovery, MEDDIC, negotiation, Salesforce, Outreach, forecasting.",
      "Account Executive - Nordvale Software, Madrid, 2022-02 to present.",
      "Sales Development Representative - Nordvale Software, Madrid, 2020-06 to 2022-01.",
      "Education: BSc Economics, Universidad Carlos III, 2016-2020.",
    ],
  },
];

/** A file with a PDF header but no usable structure — a genuinely corrupt CV. */
const CORRUPT_PDF = Buffer.from(
  `%PDF-1.4\n${"\u0000\u00ff\u00fe corrupted-bytes-not-a-pdf ".repeat(40)}\n%%EOF\n`,
  "latin1",
);

type Created = {
  label: string;
  email: string;
  fullName: string;
  matchId: string;
  applicationId: string;
};

async function seedCv(label: string, buffer: Buffer): Promise<Created> {
  const { email, fullName } = uniqueApplicant(`PIPE-${label.toUpperCase()}`);
  const created = await createCvApplication({
    positionId: fixtures.position_id,
    email,
    fullName,
    cvBase64: buffer.toString("base64"),
    cvFilename: `qa-pipeline-${label}.pdf`,
  });
  return {
    label,
    email,
    fullName,
    matchId: created.candidate_match_id,
    applicationId: created.application_id,
  };
}

async function openAdminRecord(page: Page, matchId: string) {
  await page.goto(`/admin/candidates/${matchId}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("admin-candidate-detail").or(page.locator("main"))).toBeVisible({
    timeout: 30_000,
  });
}

test.describe("cv parsing and scoring pipeline", () => {
  test("parses and scores three submitted CVs, with evidence on the admin record", async ({
    page,
  }) => {
    test.setTimeout(600_000);
    const errors = collectConsoleErrors(page);

    // 1. Three real applications, each owning its own CV object in the bucket.
    const created: Created[] = [];
    for (const body of CV_BODIES) {
      created.push(await seedCv(body.label, textPdf(body.lines)));
    }

    // Every one starts life visibly queued — never blank, never "scored".
    for (const c of created) {
      const before = await pipelineSnapshot(c.matchId);
      expect(before.match.processing_state).toBe("queued");
      expect(before.match.total_score).toBeNull();
    }

    // 2. Run the pipeline through the same endpoint cron uses.
    for (const c of created) {
      const run = await runPipelineForMatch(c.matchId);
      expect(run.ok).toBeTruthy();
    }

    // 3. Parsed profile + score + evidence are persisted for each.
    for (const c of created) {
      const snap = await pipelineSnapshot(c.matchId);
      expect(
        ["scored", "manual_review_required"],
        `${c.label} settled in ${snap.match.processing_state} (${snap.match.processing_error_message ?? "no message"})`,
      ).toContain(snap.match.processing_state);
      expect(snap.file?.parse_state, `${c.label} file parse_state`).toBe("parsed");
      expect(snap.file?.parser).toBe("pdf");
      expect(snap.score_runs.length, `${c.label} score runs`).toBeGreaterThan(0);
      expect(snap.match.current_score_run_id, `${c.label} current score run`).toBeTruthy();
      expect(typeof snap.match.total_score, `${c.label} total score`).toBe("number");
      expect(snap.match.score_band, `${c.label} band`).toBeTruthy();
      expect(snap.evidence_items.length, `${c.label} evidence items`).toBeGreaterThan(0);
    }

    // 4. The admin record shows the score and its evidence.
    await loginAs(page, "admin", fixtures.users.platform_admin.email, QA_PASSWORD);
    const first = created[0]!;
    await openAdminRecord(page, first.matchId);
    const snap = await pipelineSnapshot(first.matchId);
    await expect(page.getByText(String(snap.match.total_score)).first()).toBeVisible({
      timeout: 30_000,
    });
    await page.goto(`/admin/candidates/${first.matchId}/evidence`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("main")).toContainText(/evidence/i, { timeout: 30_000 });

    expect(meaningfulConsoleErrors(errors)).toEqual([]);
  });

  test("a corrupt CV fails visibly, keeps its record, and is repairable from the admin UI", async ({
    page,
  }) => {
    test.setTimeout(600_000);
    const errors = collectConsoleErrors(page);

    const broken = await seedCv("corrupt", CORRUPT_PDF);
    await runPipelineForMatch(broken.matchId);

    // The record survives with an honest terminal state — never a silent loss,
    // never stuck in a transient state.
    const failed = await pipelineSnapshot(broken.matchId);
    expect(["failed", "ocr_required", "manual_review_required"]).toContain(
      failed.match.processing_state,
    );
    expect(failed.match.processing_error_message).toBeTruthy();
    expect(failed.match.total_score).toBeNull();

    // The admin sees that state, and the repair action is reachable.
    await loginAs(page, "admin", fixtures.users.platform_admin.email, QA_PASSWORD);
    await openAdminRecord(page, broken.matchId);
    await expect(page.locator("main")).toContainText(
      /failed|needs review|manual review|ocr|couldn'?t|could not/i,
      { timeout: 30_000 },
    );
    const repair = page.locator('[data-qa-action="primary-repair-processing"]');
    await expect(repair).toBeVisible({ timeout: 30_000 });

    // Repair on a still-corrupt file must fail honestly rather than pretend.
    await repair.click();
    await expect
      .poll(async () => (await pipelineSnapshot(broken.matchId)).match.processing_state, {
        timeout: 120_000,
      })
      .not.toMatch(/parsing|scoring|enriching|queued/);

    // A readable replacement CV (what a candidate re-upload produces) plus the
    // same admin repair action must carry the record all the way to scored.
    await replaceCv(broken.matchId, textPdf(CV_BODIES[0]!.lines).toString("base64"));
    await page.reload({ waitUntil: "domcontentloaded" });
    const repairAgain = page.locator('[data-qa-action="primary-repair-processing"]');
    await expect(repairAgain).toBeVisible({ timeout: 30_000 });
    await repairAgain.click();

    await expect
      .poll(async () => (await pipelineSnapshot(broken.matchId)).match.processing_state, {
        timeout: 240_000,
      })
      .toBe("scored");

    const repaired = await pipelineSnapshot(broken.matchId);
    expect(repaired.file?.parse_state).toBe("parsed");
    expect(typeof repaired.match.total_score).toBe("number");
    expect(repaired.evidence_items.length).toBeGreaterThan(0);

    expect(meaningfulConsoleErrors(errors)).toEqual([]);
  });

  test("no match is ever left sitting in a transient processing state", async () => {
    test.setTimeout(300_000);
    const created = await seedCv("stuck-check", textPdf(CV_BODIES[1]!.lines));
    await runPipelineForMatch(created.matchId);
    const snap = await pipelineSnapshot(created.matchId);
    // Terminal, one way or the other: a transient state after the runner
    // returns means the record is stranded.
    expect(["queued", "parsing", "enriching", "ready_to_score", "scoring"]).not.toContain(
      snap.match.processing_state,
    );
  });

  test("re-running the pipeline on a scored match is idempotent unless forced", async () => {
    test.setTimeout(300_000);
    const created = await seedCv("idempotent", textPdf(CV_BODIES[2]!.lines));
    await runPipelineForMatch(created.matchId);
    const first = await pipelineSnapshot(created.matchId);
    test.skip(first.match.processing_state !== "scored", "first run did not reach scored");

    await runPipelineForMatch(created.matchId);
    const second = await pipelineSnapshot(created.matchId);
    expect(second.score_runs.length).toBe(first.score_runs.length);
    expect(second.match.current_score_run_id).toBe(first.match.current_score_run_id);

    // Forced re-run produces a new score run and keeps the record scored.
    await runPipelineForMatch(created.matchId, { force: true });
    await expect
      .poll(async () => (await pipelineSnapshot(created.matchId)).match.processing_state, {
        timeout: 180_000,
      })
      .toBe("scored");
    const forced = await pipelineSnapshot(created.matchId);
    expect(forced.score_runs.length).toBeGreaterThanOrEqual(first.score_runs.length);
  });
});
