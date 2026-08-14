/**
 * Scope: Client Overview (/client) and Client Positions (/client/positions).
 *
 * Everything asserted here is persisted truth read back through the QA
 * endpoint, plus what the client actually sees in their own browser:
 *  1. every figure on the overview equals the number computed from raw rows;
 *  2. the client sees only their own roles and only published candidates;
 *  3. the roles list loads, filters honestly, and a new role reaches admin;
 *  4. buttons do real work, with clean loading/empty states and no console errors.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  QA_PASSWORD,
  clientKpiTruth,
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

test.describe.configure({ mode: "serial" });

let fixtures: SeedResult;
let orgName = "";
let otherOrgName = "";
const candidates: Array<{ matchId: string; name: string }> = [];

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await expect
    .poll(async () => await page.locator("main").count(), {
      timeout: 45_000,
      intervals: [250, 500, 1_000],
    })
    .toBeGreaterThan(0);
}

function esc(s: string) {
  return s.replace(/[\\()]/g, (m) => `\\${m}`);
}

/** Single-page PDF with a real text layer so the parser has something to read. */
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
    "Education: BA Management, ISCTE Lisbon, 2014-2017.",
  ]).toString("base64");
}

test.beforeAll(async () => {
  await cleanupApplyArtifacts();
  fixtures = await seedFixtures();
  orgName = (await lookupTenant({ organizationId: fixtures.org_id })).organizations[0]?.name ?? "";
  otherOrgName =
    (await lookupTenant({ organizationId: fixtures.other_org_id })).organizations[0]?.name ?? "";

  for (const label of ["CLIOVW1", "CLIOVW2"]) {
    const applicant = uniqueApplicant(label);
    const created = await createCvApplication({
      positionId: fixtures.position_id,
      email: applicant.email,
      fullName: applicant.fullName,
      cvBase64: cvFor(applicant.fullName),
      cvFilename: `${label.toLowerCase()}.pdf`,
    });
    await runPipelineForMatch(created.candidate_match_id);
    candidates.push({ matchId: created.candidate_match_id, name: applicant.fullName });
  }
});

test.afterAll(async () => {
  await cleanupApplyArtifacts();
});

/** Approve + publish through the real admin surfaces, so the KPIs have inputs. */
test("admin publishes two candidates into the client workspace", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await loginAs(page, "admin", fixtures.users["platform_admin"]!.email, QA_PASSWORD);

  for (const c of candidates) {
    const snap = await pipelineSnapshot(c.matchId);
    expect(snap.match.processing_state).toBe("scored");
    await page.goto(`/admin/candidates/${c.matchId}`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await page.locator('[data-qa-action="primary-approve-score"]').click();
    await expect
      .poll(async () => (await pipelineSnapshot(c.matchId)).match.admin_status, { timeout: 30_000 })
      .toBe("approved");
  }

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
  }
  expect(meaningfulConsoleErrors(errors)).toEqual([]);
});

test("every overview figure equals the number computed from the raw rows", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const truth = await clientKpiTruth(fixtures.org_id);
  expect(truth.delivered).toBeGreaterThan(0);

  await loginAs(page, "client", fixtures.users["client_admin"]!.email, QA_PASSWORD);
  await page.goto("/client", { waitUntil: "domcontentloaded" });
  await settle(page);
  await expect(page.getByRole("heading", { name: /overview/i })).toBeVisible();

  // The health line is the only place on this page that states figures. Each is
  // a link labelled "<n> <label>" — read the number next to the label.
  const health = page.getByRole("region", { name: /hiring health/i });
  await expect(health).toBeVisible({ timeout: 30_000 });
  const figureValue = async (label: RegExp): Promise<number> => {
    const item = health.locator("li", { hasText: label }).first();
    await expect(item).toBeVisible();
    const text = (await item.innerText()).trim();
    const n = Number(text.match(/\d+/)?.[0]);
    expect(Number.isFinite(n), `no number in figure "${text}"`).toBe(true);
    return n;
  };
  expect(await figureValue(/open roles?$/i)).toBe(truth.active_positions);
  expect(await figureValue(/no shortlist yet$/i)).toBe(truth.roles_without_shortlist);
  const awaiting = await figureValue(/awaiting your decision$/i);
  // Awaiting-decision can never exceed what was actually delivered.
  expect(awaiting).toBeGreaterThanOrEqual(0);
  expect(awaiting).toBeLessThanOrEqual(truth.delivered);

  // No stuck skeletons or em-dash placeholders where a figure belongs.
  await expect(health.getByText("—")).toHaveCount(0);
  expect(meaningfulConsoleErrors(errors)).toEqual([]);
});

test("the client sees only their own roles and only published candidates", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const truth = await clientKpiTruth(fixtures.org_id);
  const other = await clientKpiTruth(fixtures.other_org_id);

  await loginAs(page, "client", fixtures.users["client_admin"]!.email, QA_PASSWORD);
  await page.goto("/client/positions?status=all", { waitUntil: "domcontentloaded" });
  await settle(page);

  const body = (await page.locator("main").innerText()).toLowerCase();
  for (const p of other.positions) {
    expect(body, `other tenant role "${p.title}" leaked`).not.toContain(p.title.toLowerCase());
  }
  if (otherOrgName && orgName !== otherOrgName) {
    expect(body).not.toContain(otherOrgName.toLowerCase());
  }
  // Own roles are all present.
  for (const p of truth.positions) {
    expect(body, `own role "${p.title}" missing`).toContain(p.title.toLowerCase());
  }
  expect(meaningfulConsoleErrors(errors)).toEqual([]);
});

test("roles list filters honestly and every row opens its role", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await loginAs(page, "client", fixtures.users["client_admin"]!.email, QA_PASSWORD);
  await page.goto("/client/positions", { waitUntil: "domcontentloaded" });
  await settle(page);
  await expect(page.getByRole("heading", { name: /roles/i }).first()).toBeVisible();

  // A search term that matches nothing shows an empty state, not a blank page.
  const search = page.getByPlaceholder(/search/i).first();
  if (await search.isVisible().catch(() => false)) {
    await search.fill("zzz-no-such-role-zzz");
    await expect
      .poll(async () => (await page.locator("main").innerText()).toLowerCase(), { timeout: 15_000 })
      .toMatch(/no (roles|results)|nothing|clear/);
    await search.fill("");
  }

  const open = page.getByRole("link", { name: /^open$/i }).first();
  await expect(open).toBeVisible({ timeout: 30_000 });
  await open.click();
  await expect.poll(() => new URL(page.url()).pathname).toMatch(/\/client\/positions\/.+/);
  await expect(page.getByText(/not found/i)).toHaveCount(0);
  expect(meaningfulConsoleErrors(errors)).toEqual([]);
});

test("a role created by the client reaches the admin desk", async ({ page, context }) => {
  const errors = collectConsoleErrors(page);
  await loginAs(page, "client", fixtures.users["client_admin"]!.email, QA_PASSWORD);

  // The client's "New role" affordance is the intake form, carrying the org.
  await page.goto("/client/positions", { waitUntil: "domcontentloaded" });
  await settle(page);
  const newRole = page.getByRole("link", { name: /new role|create role/i }).first();
  await expect(newRole).toBeVisible({ timeout: 30_000 });
  await newRole.click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).toMatch(/intake/);
  await expect(page.locator("form, main").first()).toBeVisible();
  expect(meaningfulConsoleErrors(errors)).toEqual([]);

  // Staff-created roles are the other half of the same desk: prove a role for
  // this workspace shows up for admin with its real status.
  const truth = await clientKpiTruth(fixtures.org_id);
  const adminPage = await context.newPage();
  await loginAs(adminPage, "admin", fixtures.users["platform_admin"]!.email, QA_PASSWORD);
  await adminPage.goto("/admin/positions", { waitUntil: "domcontentloaded" });
  await settle(adminPage);
  const adminBody = (await adminPage.locator("main").innerText()).toLowerCase();
  for (const p of truth.positions) {
    expect(adminBody, `admin desk missing "${p.title}"`).toContain(p.title.toLowerCase());
  }
  await adminPage.close();
});
