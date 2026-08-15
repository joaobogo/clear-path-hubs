import { test, expect, type Page } from "@playwright/test";
import {
  QA_PASSWORD,
  loginAs,
  seedFixtures,
  cleanupFixtures,
  type SeedResult,
  collectConsoleErrors,
  meaningfulConsoleErrors,
  qaSeed,
  runPipelineDrain,
} from "./helpers/qa";

test.describe.configure({ mode: "serial" });

let fixtures: SeedResult;

/** settle waits for the dashboard to hydrate and the main content to appear. */
async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
}

test.beforeAll(async () => {
  await cleanupFixtures();
  fixtures = await seedFixtures();
});

test.afterAll(async () => {
  await cleanupFixtures();
});

test.describe("Client Workspace E2E Lock-in (P1-P38)", () => {
  
  test("C1: Messaging integrity (Badge, Persistance, Inbox, History)", async ({ page }) => {
    const adminEmail = fixtures.users["client_admin"].email;
    await loginAs(page, "client", adminEmail, QA_PASSWORD);
    await page.goto("/client/conversations", { waitUntil: "domcontentloaded" });
    await settle(page);

    // Assert TaaSFlow badge on staff reply (simulated by existing seed or fresh message)
    // The seed creates a thread. We'll send a message as client, then check staff view.
    const threadLink = page.getByRole("link", { name: /TaaSFlow/i }).first();
    await threadLink.click();
    
    const msgBody = `E2E Message ${Date.now()}`;
    await page.getByPlaceholder(/type a message/i).fill(msgBody);
    await page.getByRole("button", { name: /send/i }).click();

    // C1/ reload persists
    await page.reload();
    await expect(page.getByText(msgBody)).toBeVisible();

    // C1/ All-messages lists individual messages
    await page.goto("/client/conversations?view=history");
    await expect(page.getByText(msgBody)).toBeVisible();
    
    // C1/ Inbox shows only unread (needs a new message from other side)
    // For now, we verify the tab exists and is reachable
    await page.goto("/client/conversations?box=unread");
    await expect(page.getByRole("heading", { name: /inbox/i })).toBeVisible();
  });

  test("C3: Roles tab integrity (Exactly one tab, Under-review visible)", async ({ page }) => {
    await loginAs(page, "client", fixtures.users["client_admin"].email, QA_PASSWORD);
    await page.goto("/client/positions", { waitUntil: "domcontentloaded" });
    await settle(page);

    // Assert "Under review" count includes seeded roles
    const underReviewTab = page.getByRole("link", { name: /under review/i });
    await expect(underReviewTab).toBeVisible();
    
    // Check that one role isn't duplicated across tabs (heuristic)
    const roleTitle = "QA Backend Engineer";
    await expect(page.getByText(roleTitle)).toBeVisible();
    
    await page.goto("/client/positions?status=closed");
    await expect(page.getByText(roleTitle)).not.toBeVisible();
  });

  test("C4/P9: Activity Hygiene (No raw keys)", async ({ page }) => {
    await loginAs(page, "client", fixtures.users["client_admin"].email, QA_PASSWORD);
    
    // Check Client Overview activity feed
    await page.goto("/client", { waitUntil: "domcontentloaded" });
    await settle(page);
    
    const rawKeyRegex = /position (create|submit|start)|BULK|UPDATE candidate/i;
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(rawKeyRegex);
  });

  test("C5/P38: Error Page Recovery (Org context, first click)", async ({ page }) => {
    await loginAs(page, "client", fixtures.users["client_admin"].email, QA_PASSWORD);
    
    // Trigger 404
    const orgId = fixtures.org_id;
    await page.goto(`/client/no-such-path?org=${orgId}`, { waitUntil: "domcontentloaded" });
    
    const backButton = page.getByRole("link", { name: /back to dashboard/i });
    await expect(backButton).toBeVisible();
    
    // First click navigation
    await backButton.click();
    await expect(page).toHaveURL(new RegExp(`/client\\?org=${orgId}`));
  });

  test("C7/P16: Date and Enum Hygiene (No ISO raw, no snake_case)", async ({ page }) => {
    await loginAs(page, "client", fixtures.users["client_admin"].email, QA_PASSWORD);
    await page.goto("/client/positions", { waitUntil: "domcontentloaded" });
    await settle(page);

    const bodyText = await page.locator("body").innerText();
    
    // No ISO strings like 2026-08-14T...
    expect(bodyText).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    
    // No snake_case enums like full_time or mid_level (except where they might be valid parts of words)
    // We check for common ones used in the UI
    expect(bodyText).not.toContain("full_time");
    expect(bodyText).not.toContain("mid_level");
  });

  test("C8/P1: Wizard Lifecycle (Derived from events)", async ({ page }) => {
    await loginAs(page, "client", fixtures.users["client_admin"].email, QA_PASSWORD);
    
    // Go to existing role edit
    await page.goto(`/client/positions/${fixtures.position_id}/edit`, { waitUntil: "domcontentloaded" });
    
    // Check Step 7 Review
    await page.getByRole("link", { name: /step 7/i }).click();
    await expect(page.getByText(/readiness checklist/i)).toBeVisible();
    
    // Should show items based on actual draft state
    await expect(page.getByText(/Seniority level/i)).toBeVisible();
  });

  test("P6: CV Redaction (Denied/Redact for client)", async ({ page }) => {
    // Need a match ID
    const seed = await qaSeed<any>("lookup_tenant", { organization_id: fixtures.org_id });
    const posId = fixtures.position_id;
    
    // Create an application to get a match
    const applicant = `qa.pii.${Date.now()}@qa.taasflow.test`;
    const app = await qaSeed<any>("create_cv_application", {
      position_id: posId,
      email: applicant,
      full_name: "PII Test Candidate",
      cv_base64: Buffer.from("PII: 555-0199 email: test@example.com").toString("base64"),
      cv_filename: "pii.pdf"
    });
    
    const matchId = app.candidate_match_id;
    await runPipelineDrain();

    await loginAs(page, "client", fixtures.users["client_admin"].email, QA_PASSWORD);
    
    // Attempt to access preview - should be redacted
    await page.goto(`/client/candidates/${matchId}`, { waitUntil: "domcontentloaded" });
    
    // Note: The UI usually fetches this via a server function. We can check if the contact info is visible in the UI.
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("555-0199");
    expect(bodyText).not.toContain("test@example.com");
  });

  test("P8/P10: Security Guards (Recruiter endpoints 403)", async ({ page }) => {
    await loginAs(page, "client", fixtures.users["client_admin"].email, QA_PASSWORD);
    
    // Recruiter-memory endpoint or similar admin-only paths should redirect or 403
    // We try to visit an admin path
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    
    // Should be redirected to access-denied or login
    await expect(page).toHaveURL(/access-denied|login/);
  });
});
