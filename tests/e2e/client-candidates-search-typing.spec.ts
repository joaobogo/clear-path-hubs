/**
 * The candidates search box must never drop keystrokes.
 *
 * It used to be controlled straight off the URL search params, so a debounced
 * navigation re-render overwrote in-flight characters: typing "rui" at normal
 * speed left "i" in the field. The input is now locally authoritative and only
 * the applied filter is debounced (see useDebouncedTextInput).
 *
 * Signed in as the demo client; skips loudly without credentials.
 */
import { test, expect, type Page } from "@playwright/test";

const EMAIL = process.env["DEMO_CLIENT_EMAIL"];
const PASSWORD = process.env["DEMO_CLIENT_PASSWORD"];
const WORKSPACE = process.env["DEMO_CLIENT_WORKSPACE"] ?? "Northwind Talent (Demo)";

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

async function resultCount(page: Page): Promise<number> {
  const text = (await page.getByTestId("candidates-result-count").innerText()).trim();
  return Number(text.split(/\s+/)[0]);
}

test.describe("candidates search typing", () => {
  test.skip(
    !EMAIL || !PASSWORD,
    "Set DEMO_CLIENT_EMAIL and DEMO_CLIENT_PASSWORD to run the signed-in search tests",
  );

  test("rapid typing keeps every character and filters the list", async ({ page }) => {
    await loginDemoClient(page);
    await page.goto("/client/candidates", { waitUntil: "domcontentloaded" });

    const box = page.getByLabel("Search candidates");
    await box.waitFor({ timeout: 30_000 });
    await expect.poll(() => resultCount(page), { timeout: 30_000 }).toBeGreaterThan(0);

    await box.click();
    // 5ms/char — far faster than a human, which is what used to break it.
    await page.keyboard.type("beatriz", { delay: 5 });

    await expect(box).toHaveValue("beatriz");
    await expect.poll(() => resultCount(page), { timeout: 15_000 }).toBe(1);
    // The value survives the debounced URL sync landing.
    await expect(box).toHaveValue("beatriz");
    expect(new URL(page.url()).searchParams.get("q")).toBe("beatriz");
  });
});
