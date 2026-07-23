/**
 * TAASFLOW V2 — Public Page Parity Engine
 *
 * Compares every public marketing route from taasflow.com against its
 * destination on clear-path-hubs.lovable.app. Captures screenshots,
 * metadata, structure, and content at 3 viewports and emits a
 * per-route JSON report + aggregate JSON/Markdown summary.
 *
 * Scope guard:
 *  - Skips protected routes (Admin/Client/Candidate/Intake/Apply/Jobs internals).
 *  - Skips 304 blog articles unless --include-blog is passed (opt-in for full runs).
 *  - Does NOT modify any application code — read-only measurement.
 *
 * Usage:
 *   bun scripts/qa/public-parity/run-page-parity.ts               # marketing_static only
 *   bun scripts/qa/public-parity/run-page-parity.ts --limit 5     # smoke run
 *   bun scripts/qa/public-parity/run-page-parity.ts --page-types marketing_static,industry_page
 *   bun scripts/qa/public-parity/run-page-parity.ts --include-blog
 *
 * PASS = the automation ran end-to-end and produced comparable artifacts.
 * PASS does NOT mean the two sites currently match.
 */

import { chromium, type Browser, type Page, type Response } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";

const SOURCE_ORIGIN = "https://taasflow.com";
const DEST_ORIGIN = "https://clear-path-hubs.lovable.app";
const MANIFEST = "reports/public-parity/source-route-manifest.json";
const OUT_ROOT = "reports/public-parity";
const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

type Viewport = (typeof VIEWPORTS)[number];
type Verdict =
  | "PASS"
  | "MINOR_DIFFERENCE"
  | "MAJOR_DIFFERENCE"
  | "MISSING_ROUTE"
  | "BROKEN_ROUTE"
  | "APPROVED_DIFFERENCE"
  | "PROTECTED_ROUTE"
  | "REVIEW_REQUIRED";
type Severity = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface ManifestRecord {
  sourceUrl: string;
  sourcePath: string;
  destinationUrl: string;
  destinationPath: string;
  pageType: string;
  sourceRouteOrigin: string;
  dynamic: boolean;
  protected: boolean;
  expectedTitle: string | null;
  expectedH1: string | null;
  expectedStatus: number;
  redirectBehavior: string | null;
  auditStatus: string;
}

interface Capture {
  url: string;
  finalUrl: string;
  status: number | null;
  redirected: boolean;
  loadError: string | null;
  title: string;
  description: string | null;
  canonical: string | null;
  robots: string | null;
  openGraph: Record<string, string>;
  structuredData: unknown[];
  h1: string[];
  headings: { level: number; text: string }[];
  sections: string[];
  textBlocks: string[];
  buttons: string[];
  links: { text: string; href: string }[];
  images: { src: string; alt: string }[];
  forms: { action: string; fields: string[] }[];
  navLinks: string[];
  footerLinks: string[];
  consoleErrors: string[];
  failedRequests: { url: string; status: number | null; failure: string | null }[];
  horizontalOverflow: boolean;
  documentWidth: number;
  viewportWidth: number;
}

interface ViewportResult {
  viewport: Viewport["name"];
  source: Capture;
  destination: Capture;
  screenshots: {
    sourceFull: string;
    sourceVisible: string;
    destinationFull: string;
    destinationVisible: string;
  };
  differences: string[];
}

interface RouteResult {
  sourcePath: string;
  destinationPath: string;
  pageType: string;
  protected: boolean;
  verdict: Verdict;
  severity: Severity;
  viewports: ViewportResult[];
  summary: string;
  exclusions: string[];
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    limit: Number.POSITIVE_INFINITY,
    pageTypes: null as Set<string> | null,
    includeBlog: false,
    onlyPath: null as string | null,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--limit") opts.limit = Number(args[++i]);
    else if (a === "--page-types") opts.pageTypes = new Set(args[++i].split(","));
    else if (a === "--include-blog") opts.includeBlog = true;
    else if (a === "--only") opts.onlyPath = args[++i];
  }
  return opts;
}

function sanitizeSlug(p: string): string {
  const s = p.replace(/^\//, "").replace(/\/$/, "") || "index";
  return s.replace(/[^a-z0-9._-]+/gi, "_");
}

async function capturePage(
  browser: Browser,
  url: string,
  viewport: Viewport,
  screenshotFull: string,
  screenshotVisible: string,
): Promise<Capture> {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    userAgent:
      "Mozilla/5.0 (compatible; TaasflowParityBot/1.0; +https://clear-path-hubs.lovable.app)",
  });
  const page: Page = await context.newPage();

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 500));
  });
  const failedRequests: Capture["failedRequests"] = [];
  page.on("requestfailed", (req) => {
    failedRequests.push({
      url: req.url(),
      status: null,
      failure: req.failure()?.errorText ?? null,
    });
  });
  page.on("response", (res: Response) => {
    if (res.status() >= 400) {
      failedRequests.push({ url: res.url(), status: res.status(), failure: null });
    }
  });

  let status: number | null = null;
  let finalUrl = url;
  let redirected = false;
  let loadError: string | null = null;
  try {
    const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    status = resp?.status() ?? null;
    finalUrl = page.url();
    redirected = finalUrl.replace(/\/$/, "") !== url.replace(/\/$/, "");
  } catch (err) {
    loadError = String((err as Error).message ?? err).slice(0, 500);
  }

  let extracted: Omit<Capture,
    "url" | "finalUrl" | "status" | "redirected" | "loadError" | "consoleErrors" | "failedRequests"
  > = {
    title: "",
    description: null,
    canonical: null,
    robots: null,
    openGraph: {},
    structuredData: [],
    h1: [],
    headings: [],
    sections: [],
    textBlocks: [],
    buttons: [],
    links: [],
    images: [],
    forms: [],
    navLinks: [],
    footerLinks: [],
    horizontalOverflow: false,
    documentWidth: 0,
    viewportWidth: viewport.width,
  };

  if (!loadError) {
    try {
      extracted = await page.evaluate((vw) => {
        const getMeta = (sel: string) =>
          (document.querySelector(sel) as HTMLMetaElement | null)?.content ?? null;
        const og: Record<string, string> = {};
        document
          .querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]')
          .forEach((m) => {
            const el = m as HTMLMetaElement;
            const k = el.getAttribute("property") || el.getAttribute("name") || "";
            if (k) og[k] = el.content;
          });
        const jsonLd: unknown[] = [];
        document
          .querySelectorAll('script[type="application/ld+json"]')
          .forEach((s) => {
            try {
              jsonLd.push(JSON.parse(s.textContent || "null"));
            } catch {
              /* ignore */
            }
          });
        const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).map(
          (h) => ({
            level: Number(h.tagName.substring(1)),
            text: (h.textContent || "").trim().slice(0, 240),
          }),
        );
        const sections = Array.from(
          document.querySelectorAll("section, [data-section], main > div"),
        )
          .slice(0, 40)
          .map((s) => {
            const h = s.querySelector("h1,h2,h3");
            const id = s.id || s.getAttribute("data-section") || "";
            return (h?.textContent || id || s.tagName).trim().slice(0, 120);
          });
        const textBlocks = Array.from(document.querySelectorAll("p, li"))
          .slice(0, 200)
          .map((n) => (n.textContent || "").trim())
          .filter((t) => t.length > 0);
        const buttons = Array.from(
          document.querySelectorAll('button, [role="button"], a.btn, a.button'),
        )
          .map((b) => (b.textContent || "").trim())
          .filter(Boolean)
          .slice(0, 80);
        const links = Array.from(document.querySelectorAll("a[href]"))
          .slice(0, 200)
          .map((a) => ({
            text: (a.textContent || "").trim().slice(0, 120),
            href: (a as HTMLAnchorElement).href,
          }));
        const images = Array.from(document.querySelectorAll("img"))
          .slice(0, 120)
          .map((img) => ({
            src: (img as HTMLImageElement).src,
            alt: (img as HTMLImageElement).alt || "",
          }));
        const forms = Array.from(document.querySelectorAll("form")).map((f) => ({
          action: (f as HTMLFormElement).action || "",
          fields: Array.from(f.querySelectorAll("input,textarea,select"))
            .map(
              (el) =>
                (el as HTMLInputElement).name ||
                (el as HTMLInputElement).id ||
                el.tagName.toLowerCase(),
            )
            .filter(Boolean),
        }));
        const navLinks = Array.from(document.querySelectorAll("header a, nav a"))
          .map((a) => (a.textContent || "").trim())
          .filter(Boolean)
          .slice(0, 60);
        const footerLinks = Array.from(document.querySelectorAll("footer a"))
          .map((a) => (a.textContent || "").trim())
          .filter(Boolean)
          .slice(0, 80);
        const documentWidth = Math.max(
          document.documentElement.scrollWidth,
          document.body?.scrollWidth ?? 0,
        );
        return {
          title: document.title,
          description: getMeta('meta[name="description"]'),
          canonical:
            (document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null)
              ?.href ?? null,
          robots: getMeta('meta[name="robots"]'),
          openGraph: og,
          structuredData: jsonLd,
          h1: Array.from(document.querySelectorAll("h1")).map((h) =>
            (h.textContent || "").trim(),
          ),
          headings,
          sections,
          textBlocks,
          buttons,
          links,
          images,
          forms,
          navLinks,
          footerLinks,
          horizontalOverflow: documentWidth > vw + 1,
          documentWidth,
          viewportWidth: vw,
        };
      }, viewport.width);
    } catch (err) {
      loadError = `evaluate failed: ${(err as Error).message}`.slice(0, 500);
    }

    try {
      await page.screenshot({ path: screenshotVisible, fullPage: false });
      await page.screenshot({ path: screenshotFull, fullPage: true });
    } catch (err) {
      loadError = (loadError ?? "") + ` | screenshot failed: ${(err as Error).message}`;
    }
  }

  await context.close();
  return {
    url,
    finalUrl,
    status,
    redirected,
    loadError,
    consoleErrors,
    failedRequests,
    ...extracted,
  };
}

function compare(src: Capture, dst: Capture): { differences: string[] } {
  const diffs: string[] = [];
  if (src.title.trim() !== dst.title.trim())
    diffs.push(`title: "${src.title}" vs "${dst.title}"`);
  if ((src.description || "") !== (dst.description || ""))
    diffs.push(`meta description mismatch`);
  if ((src.canonical || "") && (dst.canonical || "")) {
    const sp = new URL(src.canonical!).pathname;
    const dp = new URL(dst.canonical!).pathname;
    if (sp !== dp) diffs.push(`canonical path: ${sp} vs ${dp}`);
  }
  if (src.h1.join("|") !== dst.h1.join("|"))
    diffs.push(`H1 differs: [${src.h1.join(" / ")}] vs [${dst.h1.join(" / ")}]`);
  const sHeads = src.headings.map((h) => `${h.level}:${h.text}`).slice(0, 30);
  const dHeads = dst.headings.map((h) => `${h.level}:${h.text}`).slice(0, 30);
  const headingOverlap = sHeads.filter((h) => dHeads.includes(h)).length;
  const headingRatio = sHeads.length ? headingOverlap / sHeads.length : 1;
  if (headingRatio < 0.5)
    diffs.push(
      `heading overlap ${(headingRatio * 100).toFixed(0)}% (${headingOverlap}/${sHeads.length})`,
    );
  if (Math.abs(src.sections.length - dst.sections.length) > 3)
    diffs.push(`section count ${src.sections.length} vs ${dst.sections.length}`);
  if (src.forms.length !== dst.forms.length)
    diffs.push(`form count ${src.forms.length} vs ${dst.forms.length}`);
  if (dst.horizontalOverflow && !src.horizontalOverflow)
    diffs.push(`destination horizontal overflow @${dst.viewportWidth}px`);
  if (dst.consoleErrors.length > 0)
    diffs.push(`destination console errors: ${dst.consoleErrors.length}`);
  if (dst.failedRequests.length > src.failedRequests.length + 2)
    diffs.push(
      `destination failed requests ${dst.failedRequests.length} vs ${src.failedRequests.length}`,
    );
  const imgsMissingAlt = dst.images.filter((i) => !i.alt).length;
  if (imgsMissingAlt > 0) diffs.push(`destination images missing alt: ${imgsMissingAlt}`);
  return { differences: diffs };
}

function verdictFor(
  record: ManifestRecord,
  viewportResults: ViewportResult[],
): { verdict: Verdict; severity: Severity; summary: string } {
  if (record.protected) {
    return { verdict: "PROTECTED_ROUTE", severity: "NONE", summary: "Skipped: protected." };
  }
  const dst = viewportResults[0]?.destination;
  const src = viewportResults[0]?.source;
  if (!dst || dst.loadError || (dst.status !== null && dst.status >= 500)) {
    return {
      verdict: "BROKEN_ROUTE",
      severity: "CRITICAL",
      summary: `destination load error: ${dst?.loadError ?? "status " + dst?.status}`,
    };
  }
  if (dst.status === 404) {
    return {
      verdict: "MISSING_ROUTE",
      severity: "CRITICAL",
      summary: "destination returned 404",
    };
  }
  if (src && src.loadError == null && src.status && src.status >= 500) {
    return {
      verdict: "REVIEW_REQUIRED",
      severity: "MEDIUM",
      summary: `source unreachable (${src.status}); cannot compare`,
    };
  }
  const allDiffs = viewportResults.flatMap((v) => v.differences);
  if (allDiffs.length === 0) {
    return { verdict: "PASS", severity: "NONE", summary: "all checks matched" };
  }
  const critical = allDiffs.some((d) => /H1 differs|form count|missing/i.test(d));
  const high = allDiffs.some((d) => /heading overlap|section count|canonical/i.test(d));
  const medium = allDiffs.some((d) =>
    /title|meta description|console errors|failed requests|overflow/i.test(d),
  );
  const severity: Severity = critical ? "HIGH" : high ? "MEDIUM" : medium ? "LOW" : "LOW";
  const verdict: Verdict = critical
    ? "MAJOR_DIFFERENCE"
    : high || medium
      ? "MINOR_DIFFERENCE"
      : "MINOR_DIFFERENCE";
  return { verdict, severity, summary: `${allDiffs.length} differences detected` };
}

async function main() {
  const opts = parseArgs();
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as {
    records: ManifestRecord[];
  };

  let records = manifest.records.filter((r) => !r.protected);
  if (!opts.includeBlog) records = records.filter((r) => r.pageType !== "blog_article");
  if (opts.pageTypes) records = records.filter((r) => opts.pageTypes!.has(r.pageType));
  if (opts.onlyPath) records = records.filter((r) => r.sourcePath === opts.onlyPath);
  if (Number.isFinite(opts.limit)) records = records.slice(0, opts.limit);

  console.log(`[parity] comparing ${records.length} routes across ${VIEWPORTS.length} viewports`);

  await mkdir(`${OUT_ROOT}/routes`, { recursive: true });
  await mkdir(`${OUT_ROOT}/screenshots/source`, { recursive: true });
  await mkdir(`${OUT_ROOT}/screenshots/destination`, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE || "/bin/chromium",
  });
  const results: RouteResult[] = [];
  let screenshotCount = 0;

  for (const rec of records) {
    const slug = sanitizeSlug(rec.sourcePath);
    console.log(`[parity] ${rec.sourcePath} → ${rec.destinationPath}`);
    const viewportResults: ViewportResult[] = [];

    for (const vp of VIEWPORTS) {
      const srcFull = `${OUT_ROOT}/screenshots/source/${slug}__${vp.name}__full.png`;
      const srcVis = `${OUT_ROOT}/screenshots/source/${slug}__${vp.name}__visible.png`;
      const dstFull = `${OUT_ROOT}/screenshots/destination/${slug}__${vp.name}__full.png`;
      const dstVis = `${OUT_ROOT}/screenshots/destination/${slug}__${vp.name}__visible.png`;

      const [source, destination] = await Promise.all([
        capturePage(browser, rec.sourceUrl, vp, srcFull, srcVis),
        capturePage(browser, rec.destinationUrl, vp, dstFull, dstVis),
      ]);
      screenshotCount += 4;
      const { differences } = compare(source, destination);
      viewportResults.push({
        viewport: vp.name,
        source,
        destination,
        screenshots: {
          sourceFull: srcFull,
          sourceVisible: srcVis,
          destinationFull: dstFull,
          destinationVisible: dstVis,
        },
        differences,
      });
    }

    const { verdict, severity, summary } = verdictFor(rec, viewportResults);
    const routeResult: RouteResult = {
      sourcePath: rec.sourcePath,
      destinationPath: rec.destinationPath,
      pageType: rec.pageType,
      protected: rec.protected,
      verdict,
      severity,
      viewports: viewportResults,
      summary,
      exclusions: [],
    };
    results.push(routeResult);
    await writeFile(
      path.join(OUT_ROOT, "routes", `${slug}.json`),
      JSON.stringify(routeResult, null, 2),
    );
  }

  await browser.close();

  const counts = {
    routesCompared: results.length,
    screenshotsCreated: screenshotCount,
    passing: results.filter((r) => r.verdict === "PASS").length,
    critical: results.filter((r) => r.severity === "CRITICAL").length,
    high: results.filter((r) => r.severity === "HIGH").length,
    medium: results.filter((r) => r.severity === "MEDIUM").length,
    low: results.filter((r) => r.severity === "LOW").length,
    approved: results.filter((r) => r.verdict === "APPROVED_DIFFERENCE").length,
    protectedModified: 0,
  };

  const aggregate = {
    generatedAt: new Date().toISOString(),
    sourceOrigin: SOURCE_ORIGIN,
    destinationOrigin: DEST_ORIGIN,
    viewports: VIEWPORTS,
    counts,
    verdict: "PASS",
    verdictMeaning:
      "PASS means the comparison automation ran end-to-end. It does NOT assert the two websites match.",
    results: results.map((r) => ({
      sourcePath: r.sourcePath,
      destinationPath: r.destinationPath,
      pageType: r.pageType,
      verdict: r.verdict,
      severity: r.severity,
      summary: r.summary,
      viewportDiffCounts: r.viewports.map((v) => ({
        viewport: v.viewport,
        diffs: v.differences.length,
      })),
    })),
  };

  await writeFile(
    `${OUT_ROOT}/page-parity-results.json`,
    JSON.stringify(aggregate, null, 2),
  );

  const md: string[] = [];
  md.push(`# Public Page Parity Results`);
  md.push(`Generated ${aggregate.generatedAt}`);
  md.push(``);
  md.push(`Source: ${SOURCE_ORIGIN}`);
  md.push(`Destination: ${DEST_ORIGIN}`);
  md.push(``);
  md.push(`## Totals`);
  md.push(`- Routes compared: ${counts.routesCompared}`);
  md.push(`- Screenshots created: ${counts.screenshotsCreated}`);
  md.push(`- Passing routes: ${counts.passing}`);
  md.push(`- Critical failures: ${counts.critical}`);
  md.push(`- High failures: ${counts.high}`);
  md.push(`- Medium failures: ${counts.medium}`);
  md.push(`- Low failures: ${counts.low}`);
  md.push(`- Approved differences: ${counts.approved}`);
  md.push(`- Protected routes modified: ${counts.protectedModified}`);
  md.push(``);
  md.push(`**Automation verdict: PASS** — the parity engine ran end-to-end.`);
  md.push(`PASS does not mean the websites currently match.`);
  md.push(``);
  md.push(`## Per-route`);
  md.push(`| Source | Destination | Verdict | Severity | Summary |`);
  md.push(`| --- | --- | --- | --- | --- |`);
  for (const r of results) {
    md.push(
      `| \`${r.sourcePath}\` | \`${r.destinationPath}\` | ${r.verdict} | ${r.severity} | ${r.summary.replace(/\|/g, "\\|")} |`,
    );
  }
  await writeFile(`${OUT_ROOT}/page-parity-results.md`, md.join("\n"));

  console.log(`[parity] done. ${counts.routesCompared} routes, ${counts.screenshotsCreated} screenshots.`);
  console.log(JSON.stringify(counts, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
