#!/usr/bin/env node
// Prompt 46 — Accessibility & Visual Regression sweep
// Heuristic axe-free WCAG checks + pixel baselines across 6 viewports.
import { chromium } from "playwright";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const BASE = process.env.BASE_URL ?? "http://localhost:8080";
const ROUTES = [
  "/",
  "/platform",
  "/how-it-works",
  "/pricing",
  "/industries",
  "/industries/hospitality",
  "/jobs",
  "/faq",
  "/contact",
  "/trust",
  "/system",
];
const VIEWPORTS = [
  { name: "vp320", width: 320, height: 720 },
  { name: "vp375", width: 375, height: 812 },
  { name: "vp768", width: 768, height: 1024 },
  { name: "vp1024", width: 1024, height: 900 },
  { name: "vp1440", width: 1440, height: 900 },
  { name: "vp1920", width: 1920, height: 1080 },
];

const OUT = "docs/audit/prompt-46-artifacts";
await mkdir(`${OUT}/screens`, { recursive: true });
await mkdir(`${OUT}/baseline`, { recursive: true });

const a11yScript = `
() => {
  const findings = { critical: [], serious: [], moderate: [] };
  // images missing alt
  document.querySelectorAll('img').forEach(img => {
    if (!img.hasAttribute('alt')) findings.serious.push({ rule:'image-alt', el: img.outerHTML.slice(0,120) });
  });
  // buttons/links without accessible name
  document.querySelectorAll('button, a').forEach(el => {
    const label = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim();
    const hasImgAlt = [...el.querySelectorAll('img')].some(i => i.getAttribute('alt'));
    if (!label && !hasImgAlt) findings.critical.push({ rule:'name-missing', tag: el.tagName, html: el.outerHTML.slice(0,120) });
  });
  // form controls without label
  document.querySelectorAll('input, select, textarea').forEach(el => {
    const type = el.getAttribute('type');
    if (type === 'hidden' || type === 'submit' || type === 'button') return;
    const id = el.id;
    const ariaLabel = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
    const hasLabel = id && document.querySelector('label[for="'+id+'"]');
    if (!ariaLabel && !hasLabel) findings.serious.push({ rule:'form-label', html: el.outerHTML.slice(0,120) });
  });
  // landmarks
  const mains = document.querySelectorAll('main').length;
  if (mains !== 1) findings.serious.push({ rule:'landmark-main', count: mains });
  // headings: h1 count
  const h1s = document.querySelectorAll('h1').length;
  if (h1s !== 1) findings.moderate.push({ rule:'heading-h1', count: h1s });
  // skip link
  const skip = document.querySelector('a[href^="#"][class*="sr-only"], a[href="#main"]');
  if (!skip) findings.moderate.push({ rule:'skip-link' });
  return findings;
}`;

const report = { generatedAt: new Date().toISOString(), routes: [], summary: { critical: 0, serious: 0, moderate: 0, visualDiffs: 0 } };
const browser = await chromium.launch();
try {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: "reduce" });
    for (const route of ROUTES) {
      const page = await context.newPage();
      const url = `${BASE}${route}`;
      const routeSlug = route === "/" ? "home" : route.replace(/^\//, "").replace(/[\/]/g, "_");
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(400);
        const a11y = await page.evaluate(a11yScript);
        const shotPath = `${OUT}/screens/${vp.name}_${routeSlug}.png`;
        const buf = await page.screenshot({ path: shotPath, clip: { x: 0, y: 0, width: vp.width, height: Math.min(vp.height, 1200) } });
        const hash = createHash("sha256").update(buf).digest("hex").slice(0, 16);
        const baselinePath = `${OUT}/baseline/${vp.name}_${routeSlug}.hash`;
        let baseline = null;
        try { baseline = (await readFile(baselinePath, "utf8")).trim(); } catch {}
        if (!baseline) await writeFile(baselinePath, hash);
        const drift = baseline && baseline !== hash;
        if (drift) report.summary.visualDiffs++;
        report.summary.critical += a11y.critical.length;
        report.summary.serious += a11y.serious.length;
        report.summary.moderate += a11y.moderate.length;
        report.routes.push({ vp: vp.name, route, url, a11y, hash, baseline: baseline ?? hash, drift: Boolean(drift) });
      } catch (err) {
        report.routes.push({ vp: vp.name, route, url, error: String(err.message ?? err) });
      } finally {
        await page.close();
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log("A11y + visual sweep complete →", `${OUT}/report.json`);
console.log("summary", report.summary);
