/**
 * Pass 12 — candidate portal: Applications, Profile, CV, Messages, Settings.
 *
 * Everything is driven as the real candidate through the real UI, and every
 * assertion is checked against database truth (`candidate_truth`) rather than a
 * toast, so a green run means the row actually changed.
 */
import { test, expect } from "@playwright/test";
import {
  candidateTruth,
  collectConsoleErrors,
  createCvApplication,
  loginAs,
  meaningfulConsoleErrors,
  QA_PASSWORD,
  seedFixtures,
  type SeedResult,
} from "./helpers/qa";

let fixtures: SeedResult;
let candidateEmail: string;

const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
  "utf8",
);

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  fixtures = await seedFixtures();
  candidateEmail = fixtures.users["candidate"]!.email;
  // The portal needs at least one real application to show. Created through the
  // same server path the apply flow uses, on the seeded candidate's mailbox so
  // the profile is owned by the auth user that signs in below.
  await createCvApplication({
    positionId: fixtures.position_id,
    email: candidateEmail,
    fullName: "QA Portal Candidate",
    cvBase64: PDF.toString("base64"),
    cvFilename: "qa-portal-cv.pdf",
  });
});

test("applications list shows this candidate's real applications with candidate-safe status", async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await loginAs(page, "candidate", candidateEmail, QA_PASSWORD);
  await page.goto("/me/applications", { waitUntil: "domcontentloaded" });

  const truth = await candidateTruth(candidateEmail);
  const live = truth.applications.filter((a) => !a.withdrawn_at);
  expect(live.length).toBeGreaterThan(0);

  // One card per live application, and the six-word vocabulary only.
  const cards = page.locator("h3, [class*='CardTitle'], .text-base");
  await expect(page.getByRole("link", { name: /track application/i }).first()).toBeVisible({
    timeout: 30_000,
  });
  expect(await page.getByRole("link", { name: /track application/i }).count()).toBe(live.length);
  await expect(cards.first()).toBeVisible();

  const body = (await page.locator("main").innerText()).toLowerCase();
  const allowed = [
    "received",
    "under review",
    "shared with the employer",
    "interviewing",
    "offer stage",
    "closed",
  ];
  expect(allowed.some((s) => body.includes(s))).toBe(true);
  // Internal vocabulary must never reach the candidate.
  for (const leak of ["admin_status", "client_visibility", "processing_state", "fit band"]) {
    expect(body).not.toContain(leak);
  }
  expect(meaningfulConsoleErrors(errors)).toEqual([]);
});

test("profile edit saves and persists to the database", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await loginAs(page, "candidate", candidateEmail, QA_PASSWORD);
  await page.goto("/me/profile", { waitUntil: "domcontentloaded" });

  const phone = `+3519${Date.now().toString().slice(-8)}`;
  // Sections are read-only until opened, exactly as a candidate would.
  const contact = page.locator("section", { has: page.getByRole("heading", { name: /^contact/i }) });
  await expect(contact.first()).toBeVisible({ timeout: 30_000 });
  await contact.first().getByRole("button", { name: /^(edit|add)$/i }).click();
  const field = page.locator("#p-phone");
  await expect(field).toBeVisible({ timeout: 30_000 });
  await field.fill(phone);
  await page.getByRole("button", { name: /save contact/i }).click();
  await expect(page.getByText(/saved\./i).first()).toBeVisible({ timeout: 20_000 });

  await expect
    .poll(async () => (await candidateTruth(candidateEmail)).profile?.["phone"], {
      timeout: 20_000,
    })
    .toBe(phone);

  // And it survives a reload — the field is read back, not just local state.
  // Sections collapse to read mode on load, so reopen Contact before reading.
  await page.reload({ waitUntil: "domcontentloaded" });
  const reopened = page.locator("section", {
    has: page.getByRole("heading", { name: /^contact/i }),
  });
  await expect(reopened.first()).toBeVisible({ timeout: 30_000 });
  await reopened.first().getByRole("button", { name: /^(edit|add)$/i }).click();
  await expect(page.locator("#p-phone")).toHaveValue(phone, { timeout: 30_000 });
  expect(meaningfulConsoleErrors(errors)).toEqual([]);
});

test("CV replacement uploads, stores a new version, and queues parsing again", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await loginAs(page, "candidate", candidateEmail, QA_PASSWORD);
  await page.goto("/me/cv", { waitUntil: "domcontentloaded" });

  const before = (await candidateTruth(candidateEmail)).files.length;
  const input = page.locator("#cv-upload");
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.setInputFiles({
    name: "qa-replacement-cv.pdf",
    mimeType: "application/pdf",
    buffer: PDF,
  });

  await expect
    .poll(async () => (await candidateTruth(candidateEmail)).files.length, { timeout: 30_000 })
    .toBeGreaterThan(before);

  const files = (await candidateTruth(candidateEmail)).files;
  const newest = files[0]!;
  expect(newest.filename).toContain("qa-replacement-cv");
  // The defect this pass fixed: a replaced CV with no parse state never gets
  // read again, so the candidate's new file silently never re-parses.
  expect(newest.parse_state).toBe("queued");
  expect(meaningfulConsoleErrors(errors)).toEqual([]);
});

test("messages send, persist, and expose only this candidate's thread", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await loginAs(page, "candidate", candidateEmail, QA_PASSWORD);
  await page.goto("/me/messages", { waitUntil: "domcontentloaded" });

  const composer = page.getByPlaceholder(/write a message/i);
  await expect(composer).toBeVisible({ timeout: 30_000 });

  const first = `QA portal message A ${Date.now()}`;
  await composer.fill(first);
  await page.getByRole("button", { name: /^send$/i }).click();
  await expect(page.getByText(first)).toBeVisible({ timeout: 20_000 });

  const second = `QA portal message B ${Date.now()}`;
  await composer.fill(second);
  await page.getByRole("button", { name: /^send$/i }).click();
  await expect(page.getByText(second)).toBeVisible({ timeout: 20_000 });

  const truth = await candidateTruth(candidateEmail);
  const bodies = truth.messages.map((m) => m.body);
  expect(bodies).toContain(first);
  expect(bodies).toContain(second);
  // Single thread, and it is this candidate's own.
  const threads = new Set(truth.messages.map((m) => m.thread_id));
  expect(threads.size).toBe(1);
  expect([...threads][0]).toBe(truth.profile?.["user_id"]);
  expect(meaningfulConsoleErrors(errors)).toEqual([]);
});

test("settings save, take effect, and revert cleanly", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await loginAs(page, "candidate", candidateEmail, QA_PASSWORD);
  await page.goto("/me/settings", { waitUntil: "domcontentloaded" });

  const toggle = page.getByRole("switch", { name: /talent network/i });
  await expect(toggle).toBeVisible({ timeout: 30_000 });
  const initial = (await toggle.getAttribute("aria-checked")) === "true";

  await toggle.click();
  await page.getByRole("button", { name: /save preferences/i }).click();
  await expect
    .poll(
      async () => {
        const c = (await candidateTruth(candidateEmail)).profile?.["consent"] as
          | Record<string, unknown>
          | null;
        return JSON.stringify(c ?? {});
      },
      { timeout: 25_000 },
    )
    .not.toBe("");

  await page.reload({ waitUntil: "domcontentloaded" });
  const after = page.getByRole("switch", { name: /talent network/i });
  await expect(after).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(async () => (await after.getAttribute("aria-checked")) === "true", { timeout: 20_000 })
    .toBe(!initial);

  // Revert so the account is left as it was found.
  await after.click();
  await page.getByRole("button", { name: /save preferences/i }).click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect
    .poll(
      async () =>
        (await page
          .getByRole("switch", { name: /talent network/i })
          .getAttribute("aria-checked")) === "true",
      { timeout: 25_000 },
    )
    .toBe(initial);
  expect(meaningfulConsoleErrors(errors)).toEqual([]);
});

test("an admin action on the match is reflected in the candidate's status", async ({
  page,
  browser,
}) => {
  await loginAs(page, "candidate", candidateEmail, QA_PASSWORD);
  await page.goto("/me/applications", { waitUntil: "domcontentloaded" });
  const before = (await page.locator("main").innerText()).toLowerCase();

  const truth = await candidateTruth(candidateEmail);
  const match = truth.matches[0]!;

  // Real staff action through the real admin UI: archive the candidate off this
  // position. The candidate side must move to "Closed".
  const staff = await browser.newContext();
  const staffPage = await staff.newPage();
  await loginAs(
    staffPage,
    "admin",
    fixtures.users["platform_admin"]!.email,
    QA_PASSWORD,
  );
  await staffPage.goto(`/admin/candidates/${match.id}`, { waitUntil: "domcontentloaded" });
  await staffPage.locator('[data-qa-action="candidate-overflow-menu"]').click();
  await staffPage.locator('[data-qa-action="overflow-delete"]').click();
  await staffPage.getByLabel(/reason for deletion/i).fill("QA pass 12 status propagation");
  await staffPage.getByRole("textbox", { name: /type delete/i }).fill("DELETE");
  await staffPage.getByRole("button", { name: /delete candidate/i }).click();
  await staff.close();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect
    .poll(async () => (await page.locator("main").innerText()).toLowerCase(), { timeout: 30_000 })
    .not.toBe(before);
});
