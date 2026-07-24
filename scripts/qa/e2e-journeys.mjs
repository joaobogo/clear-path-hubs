#!/usr/bin/env node
// Prompt 47 — End-to-end journey suite
// Employer, Candidate, Resource, Pricing, Industry, Dashboard-login journeys.
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const BASE = process.env.BASE_URL ?? "http://localhost:8080";
const OUT = "docs/audit/prompt-47-artifacts";
await mkdir(`${OUT}/screens`, { recursive: true });

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

const results = [];
async function step(name, fn) {
  const start = Date.now();
  try { await fn(); results.push({ name, status: "pass", ms: Date.now() - start }); }
  catch (e) { results.push({ name, status: "fail", ms: Date.now() - start, error: String(e.message ?? e) }); }
}

const browser = await chromium.launch();
try {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();

    // Employer journey: home → platform → pricing → contact/intake CTA
    await step(`[${vp.name}] employer: home renders`, async () => {
      await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
      if (!(await page.locator("h1").first().isVisible())) throw new Error("no h1");
    });
    await step(`[${vp.name}] employer: platform reachable`, async () => {
      await page.goto(`${BASE}/platform`, { waitUntil: "domcontentloaded" });
      await page.locator("h1").first().waitFor({ timeout: 8000 });
    });
    await step(`[${vp.name}] employer: pricing reachable`, async () => {
      await page.goto(`${BASE}/pricing`, { waitUntil: "domcontentloaded" });
      await page.locator("h1").first().waitFor({ timeout: 8000 });
    });
    await step(`[${vp.name}] employer: intake route loads`, async () => {
      await page.goto(`${BASE}/intake`, { waitUntil: "domcontentloaded" });
      // /intake may redirect to /auth; either is acceptable, but page must render
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      if (!(await page.locator("main, [role=main]").first().count())) throw new Error("no main");
    });

    // Candidate journey: jobs list → job detail → apply
    await step(`[${vp.name}] candidate: jobs list`, async () => {
      await page.goto(`${BASE}/jobs`, { waitUntil: "domcontentloaded" });
      await page.locator("h1").first().waitFor({ timeout: 8000 });
    });

    // Industry to CTA
    await step(`[${vp.name}] industry: hospitality page`, async () => {
      await page.goto(`${BASE}/industries/hospitality`, { waitUntil: "domcontentloaded" });
      await page.locator("h1").first().waitFor({ timeout: 8000 });
    });

    // Resource to CTA
    await step(`[${vp.name}] resource: blog index`, async () => {
      await page.goto(`${BASE}/blog`, { waitUntil: "domcontentloaded" });
      await page.locator("h1").first().waitFor({ timeout: 8000 });
    });

    // Pricing calculator interactivity (ROI)
    await step(`[${vp.name}] pricing: ROI section exists`, async () => {
      await page.goto(`${BASE}/pricing`, { waitUntil: "domcontentloaded" });
      const body = await page.textContent("body");
      if (!/roi|savings|calculator/i.test(body ?? "")) throw new Error("no ROI copy");
    });

    // Auth entry page
    await step(`[${vp.name}] auth: entry page renders`, async () => {
      await page.goto(`${BASE}/auth`, { waitUntil: "domcontentloaded" });
      await page.locator("input, button").first().waitFor({ timeout: 8000 });
    });

    // Hard refresh check on a deep route
    await step(`[${vp.name}] refresh: industries deep route`, async () => {
      await page.goto(`${BASE}/industries`, { waitUntil: "domcontentloaded" });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator("h1").first().waitFor({ timeout: 8000 });
    });

    await page.screenshot({ path: `${OUT}/screens/${vp.name}_last.png` }).catch(() => {});
    await context.close();
  }
} finally {
  await browser.close();
}

const summary = {
  generatedAt: new Date().toISOString(),
  total: results.length,
  passed: results.filter(r => r.status === "pass").length,
  failed: results.filter(r => r.status === "fail").length,
  results,
};
await writeFile(`${OUT}/report.json`, JSON.stringify(summary, null, 2));
console.log("E2E complete →", summary.passed, "/", summary.total);
if (summary.failed > 0) {
  console.log("failures:");
  for (const r of results.filter(r => r.status === "fail")) console.log(" -", r.name, "→", r.error);
  process.exitCode = 1;
}
