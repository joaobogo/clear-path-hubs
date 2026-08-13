/**
 * The Candidates board is a VIEW of the candidates list, not a second surface.
 *
 * These assertions pin the three things that would silently break it:
 *   1. the six canonical columns render,
 *   2. the visible card count equals the list count for the same filters,
 *   3. a drag to an allowed column moves the card optimistically AND persists.
 *
 * Signed in as the demo client. Credentials come from the environment so no
 * secret is committed; the spec skips (loudly) when they are absent.
 */
import { test, expect, type Page } from "@playwright/test";
import { meaningfulConsoleErrors } from "./helpers/qa";

/** Demo workspace to land in when the account belongs to more than one. */
const WORKSPACE = process.env["DEMO_CLIENT_WORKSPACE"] ?? "Northwind Talent (Demo)";

/**
 * Signs the demo client in. Unlike the QA personas, this account is a member of
 * several workspaces, so /login shows a chooser after the password step.
 */
async function loginDemoClient(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill(EMAIL!);
  await page.locator("#password").fill(PASSWORD!);
  await page.getByRole("button", { name: /^sign in$/i }).click();

  const chooser = page.getByRole("button", { name: new RegExp(WORKSPACE.replace(/[()]/g, "\\$&")) });
  await Promise.race([
    chooser.waitFor({ state: "visible", timeout: 30_000 }).catch(() => null),
    expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).not.toMatch(/login/).catch(() => null),
  ]);
  if (await chooser.isVisible().catch(() => false)) await chooser.click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).not.toMatch(/login/);
}


const EMAIL = process.env["DEMO_CLIENT_EMAIL"];
const PASSWORD = process.env["DEMO_CLIENT_PASSWORD"];

const COLUMNS = [
  "delivered",
  "shortlisted",
  "interview_process",
  "offer",
  "hired",
  "not_moving_forward",
];

/** Board columns a card in `from` may legally be dropped on (mirrors STAGE_GRAPH). */
const ALLOWED: Record<string, string[]> = {
  delivered: ["shortlisted", "interview_process"],
  shortlisted: ["interview_process"],
  interview_process: ["offer", "shortlisted"],
  offer: ["hired"],
  hired: [],
  not_moving_forward: ["shortlisted"],
};

async function gotoBoard(page: Page, search = "") {
  await page.goto(`/client/candidates?view=board${search}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("region", { name: /pipeline/i })).toBeVisible({ timeout: 30_000 });
}

/** Number the list header reports for the current filters. */
async function listCount(page: Page): Promise<number> {
  const text = (await page.getByTestId("candidates-result-count").innerText()).trim();
  return Number(text.split(/\s+/)[0]);
}

/** HTML5 drag-and-drop: one shared DataTransfer across dragstart → drop. */
async function dragCardToColumn(page: Page, matchId: string, toStage: string) {
  await page.evaluate(
    ({ matchId, toStage }) => {
      const card = document.querySelector<HTMLElement>(`[data-match-id="${matchId}"]`);
      const column = document.querySelector<HTMLElement>(
        `[data-testid="pipeline-column"][data-stage="${toStage}"]`,
      );
      if (!card || !column) throw new Error("card or column not found");
      const dt = new DataTransfer();
      card.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
      column.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
      column.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
      card.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
    },
    { matchId, toStage },
  );
}

test.describe("candidates board view", () => {
  test.skip(
    !EMAIL || !PASSWORD,
    "Set DEMO_CLIENT_EMAIL and DEMO_CLIENT_PASSWORD to run the signed-in board tests",
  );

  test.beforeEach(async ({ page }) => {
    await loginDemoClient(page);
  });

  test("renders the six canonical columns", async ({ page }) => {
    await gotoBoard(page);
    const columns = page.getByTestId("pipeline-column");
    await expect(columns).toHaveCount(6);
    expect(await columns.evaluateAll((els) => els.map((e) => e.getAttribute("data-stage")))).toEqual(
      COLUMNS,
    );
  });

  test("card count equals the list count, unfiltered and filtered", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    await gotoBoard(page);
    const total = await listCount(page);
    await expect(page.getByTestId("pipeline-card")).toHaveCount(total);

    // Column tallies must sum to the same number — no row placed twice, none lost.
    const perColumn = await page
      .getByTestId("pipeline-column")
      .evaluateAll((els) =>
        els.map(
          (e) => e.querySelectorAll('[data-testid="pipeline-card"]').length,
        ),
      );
    expect(perColumn.reduce((a, b) => a + b, 0)).toBe(total);

    // Same query, narrower filter: the board must track the list exactly.
    await gotoBoard(page, "&fit=unicorn");
    const filtered = await listCount(page);
    expect(filtered).toBeLessThanOrEqual(total);
    await expect(page.getByTestId("pipeline-card")).toHaveCount(filtered);

    expect(meaningfulConsoleErrors(errors)).toEqual([]);
  });

  test("dragging to an allowed column moves optimistically and persists", async ({ page }) => {
    await gotoBoard(page);
    await expect(page.getByTestId("pipeline-card").first()).toBeVisible();

    // Pick any card whose current stage has at least one legal target.
    const candidates = await page
      .getByTestId("pipeline-card")
      .evaluateAll((els) =>
        els.map((e) => ({
          id: e.getAttribute("data-match-id")!,
          stage: e.getAttribute("data-stage")!,
        })),
      );
    const movable = candidates.find((c) => (ALLOWED[c.stage] ?? []).length > 0);
    test.skip(!movable, "demo workspace has no candidate in a movable stage");

    const from = movable!.stage;
    const to = ALLOWED[from]![0]!;
    const card = page.locator(`[data-match-id="${movable!.id}"]`);

    await dragCardToColumn(page, movable!.id, to);

    // Optimistic: the card sits in the target column before any refetch lands.
    await expect(card).toHaveAttribute("data-stage", to, { timeout: 5_000 });
    await expect(
      page.locator(`[data-testid="pipeline-column"][data-stage="${to}"] [data-match-id="${movable!.id}"]`),
    ).toBeVisible();

    // Persisted: a hard reload reads the stage back from the server.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("region", { name: /pipeline/i })).toBeVisible({ timeout: 30_000 });
    await expect(
      page.locator(`[data-testid="pipeline-column"][data-stage="${to}"] [data-match-id="${movable!.id}"]`),
    ).toBeVisible({ timeout: 15_000 });

    // Leave the demo pipeline as we found it when the reverse move is legal.
    if ((ALLOWED[to] ?? []).includes(from)) {
      await dragCardToColumn(page, movable!.id, from);
      await expect(card).toHaveAttribute("data-stage", from, { timeout: 5_000 });
    }
  });
});
