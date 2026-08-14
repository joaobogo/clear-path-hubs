import { expect, test, type Page } from "@playwright/test";
import {
  QA_PASSWORD,
  cleanupApplyArtifacts,
  collectConsoleErrors,
  createCvApplication,
  loginAs,
  lookupTenant,
  matchDecisions,
  meaningfulConsoleErrors,
  pipelineSnapshot,
  runPipelineForMatch,
  seedFixtures,
  uniqueApplicant,
  type SeedResult,
} from "./helpers/qa";

/**
 * Scope: Client Candidates list, Kanban board and candidate detail — the
 * surface clients live in. Every decision assertion is persisted truth read
 * back through the read-only QA probe, then re-checked from the admin side.
 */

test.describe.configure({ mode: "serial" });

let fixtures: SeedResult;
let otherOrgName = "";

type Cand = { matchId: string; name: string; email: string };
const cands: Cand[] = [];

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await expect
    .poll(async () => await page.locator("main, table, [data-testid=pipeline-column]").count(), {
      timeout: 45_000,
      intervals: [250, 500, 1_000],
    })
    .toBeGreaterThan(0);
}

function esc(s: string) {
  return s.replace(/[\\()]/g, (m) => `\\${m}`);
}

/** Single-page PDF with a real, uncompressed text layer — parsable by unpdf. */
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

/**
 * The fixture role asks for Python, PostgreSQL and REST API design. The
 * evidence gate blocks approval when a must-have has no supporting passage, so
 * the CV has to speak to each one for the publish path to be exercised here.
 */
function cvFor(name: string): string {
  return textPdf([
    `${name} - Backend Engineer`,
    "Six years of professional backend engineering experience building production services.",
    "Python: 6 years writing Python services with FastAPI and Django, including async workers.",
    "PostgreSQL experience: owns the PostgreSQL schema, query tuning and migrations for a 4TB database.",
    "REST API design: designed and documented 30+ versioned REST APIs consumed by mobile and partner clients.",
    "Also runs CI/CD on AWS (ECS, RDS, S3) with Terraform.",
    "Senior Backend Engineer - Solvia Software, Lisbon, 2021-04 to present.",
    "Backend Engineer - Beacon Analytics, Lisbon, 2018-09 to 2021-03.",
    "Education: BSc Computer Science, IST Lisbon, 2014-2018.",
  ]).toString("base64");
}

async function approveAndPublish(page: Page, matchId: string) {
  await page.goto(`/admin/candidates/${matchId}`, { waitUntil: "domcontentloaded" });
  await settle(page);
  await page.locator('[data-qa-action="primary-approve-score"]').first().click();
  await expect
    .poll(async () => (await pipelineSnapshot(matchId)).match.admin_status, { timeout: 40_000 })
    .toBe("approved");

  // Approval reshapes the rail; reload so the next step is read from the server.
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page);
  const publish = page.locator('[data-qa-action="publish-to-client"]').first();
  await expect(publish).toBeVisible({ timeout: 30_000 });

  await publish.click();
  await expect
    .poll(async () => (await pipelineSnapshot(matchId)).match.client_visibility, {
      timeout: 40_000,
    })
    .toBe("visible");
}

test.beforeAll(async () => {
  await cleanupApplyArtifacts();
  fixtures = await seedFixtures();
  const other = await lookupTenant({ organizationId: fixtures.other_org_id });
  otherOrgName = other.organizations[0]?.name ?? "";

  for (const label of ["KAN1", "KAN2", "KAN3", "KAN4"]) {
    const applicant = uniqueApplicant(label);
    const created = await createCvApplication({
      positionId: fixtures.position_id,
      email: applicant.email,
      fullName: applicant.fullName,
      cvBase64: cvFor(applicant.fullName),
      cvFilename: `${label.toLowerCase()}.pdf`,
    });
    await runPipelineForMatch(created.candidate_match_id);
    cands.push({
      matchId: created.candidate_match_id,
      name: applicant.fullName,
      email: applicant.email,
    });
  }
});

test.afterAll(async () => {
  await cleanupApplyArtifacts();
});

test("staff approve and publish all four candidates into the client workspace", async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await loginAs(page, "admin", fixtures.users["platform_admin"]!.email, QA_PASSWORD);
  for (const c of cands) {
    const snap = await pipelineSnapshot(c.matchId);
    expect(snap.match.processing_state, `${c.name} did not score`).toBe("scored");
    await approveAndPublish(page, c.matchId);
  }
  expect(meaningfulConsoleErrors(errors)).toEqual([]);
});

test("kanban shows the six columns with only this client's published candidates", async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await loginAs(page, "client", fixtures.users["client_admin"]!.email, QA_PASSWORD);
  await page.goto("/client/candidates?view=board", { waitUntil: "domcontentloaded" });
  await settle(page);

  const columns = page.locator('[data-testid="pipeline-column"]');
  await expect(columns).toHaveCount(6);

  for (const c of cands) {
    await expect(
      page.locator('[data-testid="pipeline-card"]', { hasText: c.name }).first(),
    ).toBeVisible({ timeout: 30_000 });
  }
  if (otherOrgName) {
    await expect(page.getByText(otherOrgName, { exact: false })).toHaveCount(0);
  }

  // Every card opens its own candidate, by id.
  const first = cands[0]!;
  await page
    .locator('[data-testid="pipeline-card"]', { hasText: first.name })
    .first()
    .getByRole("link", { name: first.name })
    .click();
  await expect.poll(() => page.url(), { timeout: 20_000 }).toContain(first.matchId);
  await settle(page);
  await expect(page.getByText(first.name).first()).toBeVisible();
  expect(meaningfulConsoleErrors(errors)).toEqual([]);
});

test("candidate detail is client-safe and carries score plus evidence", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await loginAs(page, "client", fixtures.users["client_admin"]!.email, QA_PASSWORD);
  const c = cands[0]!;
  await page.goto(`/client/candidates/${c.matchId}`, { waitUntil: "domcontentloaded" });
  await settle(page);

  await expect(page.getByText("Candidate not found.")).toHaveCount(0);
  const body = (await page.locator("body").innerText()).toLowerCase();
  for (const forbidden of [
    c.email.toLowerCase(),
    "processing_state",
    "parse_state",
    "score_run",
    "internal note",
    otherOrgName.toLowerCase(),
  ]) {
    if (!forbidden) continue;
    expect(body, `client detail leaked "${forbidden}"`).not.toContain(forbidden);
  }
  // Score and evidence are the reason this page exists.
  expect(body).toMatch(/fit|score/);
  expect(body).toMatch(/evidence|why we/);
  expect(meaningfulConsoleErrors(errors)).toEqual([]);
});

test("shortlist, interview, decline and feedback each persist and survive refresh", async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await loginAs(page, "client", fixtures.users["client_admin"]!.email, QA_PASSWORD);

  const open = async (matchId: string) => {
    await page.goto(`/client/candidates/${matchId}`, { waitUntil: "domcontentloaded" });
    await settle(page);
  };

  // 1) Shortlist — the single forward move from "delivered".
  const a = cands[0]!;
  await open(a.matchId);
  await page.getByRole("button", { name: /advance to shortlist/i }).click();
  await expect
    .poll(async () => (await matchDecisions(a.matchId)).match.stage, { timeout: 30_000 })
    .toBe("shortlisted");

  // 2) Interview — shortlist first, then advance again.
  const b = cands[1]!;
  await open(b.matchId);
  await page.getByRole("button", { name: /advance to shortlist/i }).click();
  await expect
    .poll(async () => (await matchDecisions(b.matchId)).match.stage, { timeout: 30_000 })
    .toBe("shortlisted");
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page);
  await page.getByRole("button", { name: /advance to interview/i }).click();
  await expect
    .poll(async () => (await matchDecisions(b.matchId)).match.stage, { timeout: 30_000 })
    .toBe("interview_process");

  // 3) Decline — reason is mandatory, so the dialog is part of the path.
  const c = cands[2]!;
  await open(c.matchId);
  await page.getByRole("button", { name: /not a fit/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio").first().check().catch(async () => {
    await dialog.locator("button[role=radio], input[type=radio]").first().click();
  });
  await dialog.getByRole("button", { name: /confirm|not a fit|save|decline/i }).last().click();
  await expect
    .poll(async () => (await matchDecisions(c.matchId)).match.stage, { timeout: 30_000 })
    .toBe("not_moving_forward");

  // 4) Feedback — recorded as a decision, no stage change.
  const d = cands[3]!;
  await open(d.matchId);
  await page.getByRole("button", { name: /more|actions/i }).first().click();
  await page.getByRole("menuitem", { name: /add feedback/i }).click();
  const fb = page.getByRole("dialog");
  await expect(fb).toBeVisible();
  await fb
    .locator("textarea")
    .first()
    .fill("Strong backend depth; would like to see more distributed systems exposure.");
  await fb.getByRole("button", { name: /save feedback/i }).click();
  await expect
    .poll(
      async () =>
        (await matchDecisions(d.matchId)).decisions.some((x) => x.decision_type === "feedback"),
      { timeout: 30_000 },
    )
    .toBe(true);

  // Refresh: every stage survives a reload of the list.
  await page.goto("/client/candidates", { waitUntil: "domcontentloaded" });
  await settle(page);
  const stages = await Promise.all(cands.map((x) => matchDecisions(x.matchId)));
  expect(stages.map((s) => s.match.stage)).toEqual([
    "shortlisted",
    "interview_process",
    "not_moving_forward",
    "delivered",
  ]);
  expect(meaningfulConsoleErrors(errors)).toEqual([]);
});

test("a board move persists through the same single stage-move path", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await loginAs(page, "client", fixtures.users["client_admin"]!.email, QA_PASSWORD);
  await page.goto("/client/candidates?view=board", { waitUntil: "domcontentloaded" });
  await settle(page);

  const d = cands[3]!;
  const card = page.locator(`[data-testid="pipeline-card"][data-match-id="${d.matchId}"]`);
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.getByRole("button", { name: /change stage/i }).click();
  await page.getByRole("menuitem", { name: /shortlist/i }).first().click();

  await expect
    .poll(async () => (await matchDecisions(d.matchId)).match.stage, { timeout: 30_000 })
    .toBe("shortlisted");

  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page);
  await expect(
    page
      .locator('[data-testid="pipeline-column"][data-stage="shortlisted"]')
      .locator(`[data-match-id="${d.matchId}"]`),
  ).toBeVisible({ timeout: 30_000 });
  expect(meaningfulConsoleErrors(errors)).toEqual([]);
});

test("all four client decisions are visible to staff on the admin side", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await loginAs(page, "admin", fixtures.users["platform_admin"]!.email, QA_PASSWORD);

  const expected: Array<[Cand, RegExp]> = [
    [cands[0]!, /shortlist/i],
    [cands[1]!, /interview/i],
    [cands[2]!, /not moving forward|declined|not a fit/i],
    [cands[3]!, /shortlist/i],
  ];
  for (const [c, pattern] of expected) {
    await page.goto(`/admin/candidates/${c.matchId}`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await expect(page.getByText(pattern).first()).toBeVisible({ timeout: 30_000 });
  }
  // The feedback the client wrote reached a persisted decision row.
  const fb = await matchDecisions(cands[3]!.matchId);
  expect(fb.decisions.some((x) => x.decision_type === "feedback")).toBe(true);
  expect(meaningfulConsoleErrors(errors)).toEqual([]);
});
