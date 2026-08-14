import { expect, test, type Page } from "@playwright/test";
import {
  QA_PASSWORD,
  cleanupApplyArtifacts,
  collectConsoleErrors,
  createCvApplication,
  loginAs,
  lookupTenant,
  meaningfulConsoleErrors,
  pipelineSnapshot,
  runPipelineForMatch,
  seedFixtures,
  uniqueApplicant,
  type SeedResult,
} from "./helpers/qa";

/**
 * Scope: Admin Publish Desk — the boundary between internal and client-visible
 * data. Every assertion is persisted truth (read back through the QA snapshot
 * endpoint) plus what the two personas actually see in their own browsers.
 */

test.describe.configure({ mode: "serial" });

let fixtures: SeedResult;
let orgName = "";
let otherOrgName = "";
const candidates: Array<{ matchId: string; name: string; email: string }> = [];

/**
 * Workspace routes render inside the client-only authenticated shell, so the
 * page is ready once React has mounted real content — not when the HTML lands.
 */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await expect
    .poll(async () => await page.locator("main, table, [data-qa-action]").count(), {
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

function cvFor(name: string): string {
  return textPdf([
    `${name} - Client Success Manager, EMEA`,
    "Seven years of professional experience owning mid-market B2B SaaS accounts.",
    "Currently responsible for 24 accounts worth EUR 1.8M ARR at 109% net revenue retention.",
    "Runs onboarding, quarterly business reviews and renewal negotiation end to end.",
    "Skills: account management, renewals, QBRs, HubSpot, Zendesk, churn analysis.",
    "Senior Client Success Manager - Solvia Software, Lisbon, 2021-04 to present.",
    "Client Success Manager - Beacon Analytics, Lisbon, 2018-09 to 2021-03.",
    "Education: BA Management, ISCTE Lisbon, 2014-2017. Languages: Portuguese, English.",
  ]).toString("base64");
}

test.beforeAll(async () => {
  await cleanupApplyArtifacts();
  fixtures = await seedFixtures();
  const tenants = await lookupTenant({ organizationId: fixtures.org_id });
  orgName = tenants.organizations[0]?.name ?? "";
  const other = await lookupTenant({ organizationId: fixtures.other_org_id });
  otherOrgName = other.organizations[0]?.name ?? "";

  // Two real applications, driven through the same pipeline runner the cron uses.
  for (const label of ["PUBDESK1", "PUBDESK2"]) {
    const applicant = uniqueApplicant(label);
    const created = await createCvApplication({
      positionId: fixtures.position_id,
      email: applicant.email,
      fullName: applicant.fullName,
      cvBase64: cvFor(applicant.fullName),
      cvFilename: `${label.toLowerCase()}.pdf`,
    });
    await runPipelineForMatch(created.candidate_match_id);
    candidates.push({
      matchId: created.candidate_match_id,
      name: applicant.fullName,
      email: applicant.email,
    });
  }
});

test.afterAll(async () => {
  await cleanupApplyArtifacts();
});

async function approveScore(page: Page, matchId: string) {
  await page.goto(`/admin/candidates/${matchId}`, { waitUntil: "domcontentloaded" });
  await settle(page);
  const approve = page.locator('[data-qa-action="primary-approve-score"]');
  await expect(approve).toBeVisible();
  await approve.click();
  await expect
    .poll(async () => (await pipelineSnapshot(matchId)).match.admin_status, { timeout: 30_000 })
    .toBe("approved");
}

test("scored candidates can be approved, then reach the publish desk ready queue", async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await loginAs(page, "admin", fixtures.users["platform_admin"]!.email, QA_PASSWORD);

  for (const c of candidates) {
    const snap = await pipelineSnapshot(c.matchId);
    expect(snap.match.processing_state).toBe("scored");
    expect(snap.score?.total_score).not.toBeNull();
    expect(snap.match.current_score_run_id).not.toBeNull();
    await approveScore(page, c.matchId);
  }

  await page.goto("/admin/publish", { waitUntil: "domcontentloaded" });
  await settle(page);
  for (const c of candidates) {
    await expect(page.locator("tr", { hasText: c.name }).first()).toBeVisible();
  }
  expect(meaningfulConsoleErrors(errors)).toEqual([]);
});

test("preview-as-client shows the sanitized DTO for an unpublished candidate", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await loginAs(page, "admin", fixtures.users["platform_admin"]!.email, QA_PASSWORD);

  const c = candidates[0]!;
  // Still hidden: the preview must work before publication, not after.
  expect((await pipelineSnapshot(c.matchId)).match.client_visibility).toBe("hidden");

  await page.goto(
    `/client/candidates/${c.matchId}?org=${fixtures.org_id}&preview=client_admin`,
    { waitUntil: "domcontentloaded" },
  );
  await settle(page);
  await expect(page.getByText("Candidate not found.")).toHaveCount(0);
  await expect(page.getByText(c.name).first()).toBeVisible();

  // Field-by-field: internal-only data must not reach this surface.
  const body = (await page.locator("body").innerText()).toLowerCase();
  for (const forbidden of [
    c.email.toLowerCase(), // contact is a separate release, never in the DTO
    "processing_state",
    "internal note",
    "admin note",
    "raw cv text",
    "parse_state",
    "score_run",
    otherOrgName.toLowerCase(), // no other client's workspace name
  ]) {
    if (!forbidden) continue;
    expect(body, `preview leaked "${forbidden}"`).not.toContain(forbidden);
  }
  // The sanitized DTO speaks in bands, never a raw internal number.
  expect(body).not.toMatch(/score:\s*\d{1,3}\s*\/\s*100/);
  expect(meaningfulConsoleErrors(errors)).toEqual([]);
});

test("publishing two candidates makes them visible in the client workspace", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await loginAs(page, "admin", fixtures.users["platform_admin"]!.email, QA_PASSWORD);
  await page.goto("/admin/publish", { waitUntil: "domcontentloaded" });
  await settle(page);

  for (const c of candidates) {
    const row = page.locator("tr", { hasText: c.name }).first();
    await row.locator('[data-qa-action="publish"]').click();
    await expect
      .poll(async () => (await pipelineSnapshot(c.matchId)).match.client_visibility, {
        timeout: 30_000,
      })
      .toBe("visible");
    await expect(row.locator('[data-qa-action="unpublish"]')).toBeVisible();
  }
  expect(meaningfulConsoleErrors(errors)).toEqual([]);
});

test("the client sees both published candidates, and only their own workspace", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await loginAs(page, "client", fixtures.users["client_admin"]!.email, QA_PASSWORD);
  await page.goto("/client/candidates", { waitUntil: "domcontentloaded" });
  await settle(page);

  for (const c of candidates) {
    await expect(page.getByText(c.name).first()).toBeVisible();
  }
  if (orgName && otherOrgName && orgName !== otherOrgName) {
    await expect(page.getByText(otherOrgName, { exact: false })).toHaveCount(0);
  }
  // The detail view opens by exact id for the real client too.
  await page.goto(`/client/candidates/${candidates[0]!.matchId}`, {
    waitUntil: "domcontentloaded",
  });
  await settle(page);
  await expect(page.getByText("Candidate not found.")).toHaveCount(0);
  expect(meaningfulConsoleErrors(errors)).toEqual([]);
});

test("unpublishing removes the candidate from the client workspace", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const removed = candidates[1]!;
  const kept = candidates[0]!;

  await loginAs(page, "admin", fixtures.users["platform_admin"]!.email, QA_PASSWORD);
  await page.goto("/admin/publish", { waitUntil: "domcontentloaded" });
  await settle(page);
  await page
    .locator("tr", { hasText: removed.name })
    .first()
    .locator('[data-qa-action="unpublish"]')
    .click();
  await expect
    .poll(async () => (await pipelineSnapshot(removed.matchId)).match.client_visibility, {
      timeout: 30_000,
    })
    .toBe("hidden");

  // The status change propagates to the admin record view as well.
  await page.goto(`/admin/candidates/${removed.matchId}`, { waitUntil: "domcontentloaded" });
  await settle(page);
  await expect(page.getByText(/hidden/i).first()).toBeVisible();

  await page.context().clearCookies();
  await loginAs(page, "client", fixtures.users["client_admin"]!.email, QA_PASSWORD);
  await page.goto("/client/candidates", { waitUntil: "domcontentloaded" });
  await settle(page);
  await expect(page.getByText(kept.name).first()).toBeVisible();
  await expect(page.getByText(removed.name)).toHaveCount(0);

  // Direct-URL access to the unpublished candidate is closed for the client.
  await page.goto(`/client/candidates/${removed.matchId}`, { waitUntil: "domcontentloaded" });
  await settle(page);
  await expect(page.getByText("Candidate not found.")).toBeVisible();
  expect(meaningfulConsoleErrors(errors)).toEqual([]);
});
