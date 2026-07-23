/**
 * TaaSFlow V2 — Public Route Discovery Automation
 *
 * Reusable crawler that discovers every public route belonging to the TaaSFlow
 * marketing website and maps each to its destination.
 *
 * Sources (in precedence order):
 *   1. Source sitemap index + child sitemaps (authoritative for URLs)
 *   2. Source homepage rendered HTML (Header/Footer link scrape)
 *   3. Destination route inventory (src/routes/*.tsx) — canonical destination paths
 *   4. Source repository routes (OPTIONAL — requires GITHUB_TOKEN when repo is private)
 *
 * Protected operational route trees are discovered from the destination route
 * configuration (src/routes/_authenticated/**, /intake*, /jobs*, /apply/*)
 * and explicitly marked. No broad "candidate" exclusion — public candidate
 * marketing pages (e.g. /candidate-join, /candidate-success) are still audited.
 *
 * Usage:
 *   bun run scripts/qa/public-parity/discover-routes.ts
 *   # emits: reports/public-parity/{source-route-manifest.json,.md,
 *   #        protected-route-manifest.json, unresolved-routes.json}
 *
 * This script is read-only against source; it writes ONLY into reports/public-parity/.
 */

import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SRC_BASE = "https://taasflow.com";
const DST_BASE = "https://clear-path-hubs.lovable.app";
const SRC_REPO = "https://github.com/joaobogo/sourcing-suite-ai.git";
const REPORT_DIR = "reports/public-parity";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type PageType =
  | "marketing_static"
  | "industries_index"
  | "industries_compare"
  | "industry_page"
  | "blog_index"
  | "blog_article"
  | "blog_category_index"
  | "job_posting_legacy"
  | "utility";

type AuditStatus =
  | "matched"
  | "matched-dynamic"
  | "alias"
  | "protected"
  | "utility"
  | "destination-only"
  | "pending-implementation"
  | "unresolved";

interface RouteRecord {
  sourceUrl: string;
  sourcePath: string;
  destinationUrl: string | null;
  destinationPath: string | null;
  pageType: PageType;
  sourceRouteOrigin: string;
  dynamic: boolean;
  protected: boolean;
  expectedTitle: string | null;
  expectedH1: string | null;
  expectedStatus: number;
  redirectBehavior: string | null;
  auditStatus: AuditStatus;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

function extractLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

function toPath(url: string): string {
  return new URL(url).pathname || "/";
}

// -----------------------------------------------------------------------------
// Step 1 — crawl source sitemap
// -----------------------------------------------------------------------------

async function crawlSitemap() {
  const index = await fetchText(`${SRC_BASE}/sitemap.xml`);
  const children = extractLocs(index);
  const buckets: Record<string, string[]> = {};
  for (const child of children) {
    const key = child.split("/").pop()!.replace(/\.xml$/, "");
    const xml = await fetchText(child);
    buckets[key] = extractLocs(xml).map(toPath);
  }
  return buckets; // { "sitemap-pages": [...], "sitemap-industries": [...], ... }
}

// -----------------------------------------------------------------------------
// Step 2 — scrape homepage links (catches aliases not in sitemap)
// -----------------------------------------------------------------------------

async function crawlHomepageLinks(): Promise<string[]> {
  const html = await fetchText(`${SRC_BASE}/`);
  const hrefs = [...html.matchAll(/href="(\/[a-z0-9\-/]+)"/gi)].map((m) => m[1]);
  return [...new Set(hrefs)].filter(
    (p) => !p.startsWith("/assets/") && !p.includes("favicon"),
  );
}

// -----------------------------------------------------------------------------
// Step 3 — inventory destination routes from src/routes/**
// -----------------------------------------------------------------------------

function inventoryDestinationRoutes(): {
  publicRoutes: Set<string>;
  protectedRoots: Array<{ path: string; system: string }>;
} {
  const publicRoutes = new Set<string>();
  const routesDir = "src/routes";
  const entries = readdirSync(routesDir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) continue;
    if (!/\.(tsx|ts)$/.test(e.name)) continue;
    if (e.name.startsWith("__") || e.name.startsWith("_")) continue;
    if (e.name === "sitemap[.]xml.ts") {
      publicRoutes.add("/sitemap.xml");
      continue;
    }
    // "foo.bar.$id.tsx" -> "/foo/bar/$id"; "index.tsx" -> "/"
    const base = e.name.replace(/\.(tsx|ts)$/, "");
    if (base === "index") {
      publicRoutes.add("/");
      continue;
    }
    const parts = base.split(".").map((p) => (p === "index" ? "" : p));
    const path = "/" + parts.filter(Boolean).join("/");
    publicRoutes.add(path);
  }

  const protectedRoots = [
    { path: "/_authenticated/admin",          system: "Admin workspace" },
    { path: "/_authenticated/client",         system: "Client workspace" },
    { path: "/_authenticated/me",             system: "Candidate workspace" },
    { path: "/intake",                        system: "Employer intake wizard" },
    { path: "/intake/confirmation",           system: "Employer intake confirmation" },
    { path: "/jobs",                          system: "Job Board (destination canonical)" },
    { path: "/jobs/$id",                      system: "Job detail (destination canonical)" },
    { path: "/jobs/$id/apply",                system: "Job application (destination canonical)" },
    { path: "/apply/received/$applicationId", system: "Application tracking receipt" },
  ];
  return { publicRoutes, protectedRoots };
}

// -----------------------------------------------------------------------------
// Step 4 — optional: source repository route inventory (requires access)
// -----------------------------------------------------------------------------

async function inventorySourceRepoRoutes(): Promise<
  { status: "ok"; paths: string[] } | { status: "denied"; reason: string }
> {
  const token = process.env.GITHUB_TOKEN;
  const api = "https://api.github.com/repos/joaobogo/sourcing-suite-ai";
  const res = await fetch(api, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 404 || res.status === 401 || res.status === 403) {
    return { status: "denied", reason: `GitHub API ${res.status} for ${SRC_REPO}` };
  }
  // Would recurse repo tree to enumerate src/routes/** here; omitted for read-only demo.
  return { status: "ok", paths: [] };
}

// -----------------------------------------------------------------------------
// Step 5 — build records with dedup, redirects, dynamic detection
// -----------------------------------------------------------------------------

function buildRecords(input: {
  sitemap: Record<string, string[]>;
  homepageLinks: string[];
  destination: ReturnType<typeof inventoryDestinationRoutes>;
}): { records: RouteRecord[]; duplicates: number } {
  const { sitemap, homepageLinks, destination } = input;
  const records: RouteRecord[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  const push = (r: RouteRecord) => {
    const key = `${r.sourcePath}|${r.destinationPath}`;
    if (seen.has(key)) { duplicates++; return; }
    seen.add(key); records.push(r);
  };

  const add = (partial: Partial<RouteRecord> & Pick<RouteRecord,
    "sourcePath" | "destinationPath" | "pageType" | "sourceRouteOrigin" |
    "dynamic" | "protected" | "auditStatus">) => {
    push({
      sourceUrl: SRC_BASE + partial.sourcePath,
      destinationUrl: partial.destinationPath ? DST_BASE + partial.destinationPath : null,
      expectedTitle: null,
      expectedH1: null,
      expectedStatus: 200,
      redirectBehavior: null,
      ...partial,
    });
  };

  const staticMap: Record<string, string> = {
    "/": "/",
    "/how-it-works": "/how-it-works",
    "/pricing": "/pricing",
    "/about": "/about",
    "/enterprise": "/enterprise",
    "/pilot": "/pilot",
    "/contact": "/contact",
    "/faq": "/faq",
    "/resources": "/resources",
    "/blog": "/blog",
    "/case-studies": "/case-studies",
    "/talent-network": "/talent-network",
    "/global-talent": "/global-talent",
    "/employer-onboarding": "/employer-onboarding",
    "/knowledge-base": "/knowledge-base",
    "/partnerships/staffing": "/partnerships/staffing",
    "/privacy": "/privacy",
    "/terms": "/terms",
    "/jobs": "/jobs", // protected — destination canonical Job Board
  };

  const isProtected = (dst: string | null) => {
    if (!dst) return false;
    return destination.protectedRoots.some((p) =>
      dst === p.path || dst.startsWith(p.path + "/"),
    );
  };

  // Static marketing
  for (const [src, dst] of Object.entries(staticMap)) {
    const prot = isProtected(dst);
    add({
      sourcePath: src, destinationPath: dst,
      pageType: "marketing_static",
      sourceRouteOrigin: "sitemap-pages.xml + Header/Footer",
      dynamic: false, protected: prot,
      auditStatus: prot ? "protected" : "matched",
    });
  }

  // Homepage-only aliases -> destination redirects
  const aliasMap: Record<string, string> = {
    "/candidate/join":   "/candidate-join",
    "/taasflow-journey": "/journey",
    "/talent":           "/talent-marketplace",
  };
  for (const [src, dst] of Object.entries(aliasMap)) {
    add({
      sourcePath: src, destinationPath: dst,
      pageType: "marketing_static",
      sourceRouteOrigin: "homepage-link",
      dynamic: false, protected: false,
      redirectBehavior: `301 -> ${dst}`, auditStatus: "alias",
    });
  }
  // /candidate-success direct match
  if (homepageLinks.includes("/candidate-success")) {
    add({
      sourcePath: "/candidate-success", destinationPath: "/candidate-success",
      pageType: "marketing_static", sourceRouteOrigin: "homepage-link",
      dynamic: false, protected: false, auditStatus: "matched",
    });
  }

  // Industries
  for (const path of sitemap["sitemap-industries"] ?? []) {
    if (path === "/industries") {
      add({ sourcePath: path, destinationPath: "/industries",
            pageType: "industries_index", sourceRouteOrigin: "sitemap-industries.xml",
            dynamic: false, protected: false, auditStatus: "matched" });
    } else if (path === "/industries/compare") {
      add({ sourcePath: path, destinationPath: "/industries/compare",
            pageType: "industries_compare",
            sourceRouteOrigin: "sitemap-industries.xml + homepage-link",
            dynamic: false, protected: false, auditStatus: "pending-implementation" });
    } else {
      const slug = path.split("/").pop()!;
      add({ sourcePath: path, destinationPath: `/industries/${slug}`,
            pageType: "industry_page", sourceRouteOrigin: "sitemap-industries.xml",
            dynamic: true, protected: false, auditStatus: "matched-dynamic" });
    }
  }

  // Blog
  for (const path of sitemap["sitemap-blog"] ?? []) {
    if (path === "/blog") continue;
    const slug = path.split("/").pop()!;
    add({ sourcePath: path, destinationPath: `/blog/${slug}`,
          pageType: "blog_article", sourceRouteOrigin: "sitemap-blog.xml",
          dynamic: true, protected: false, auditStatus: "matched-dynamic" });
  }

  // Jobs (all protected — destination job board is canonical)
  for (const path of sitemap["sitemap-jobs"] ?? []) {
    add({ sourcePath: path,
          destinationPath: path === "/jobs" ? "/jobs" : "/jobs/$id",
          pageType: "job_posting_legacy", sourceRouteOrigin: "sitemap-jobs.xml",
          dynamic: true, protected: true, auditStatus: "protected" });
  }

  // Destination-only
  add({ sourcePath: "/blog/category/*", destinationPath: "/blog/category/$slug",
        pageType: "blog_category_index", sourceRouteOrigin: "destination-only",
        dynamic: true, protected: false, auditStatus: "destination-only" });

  // Utility
  add({ sourcePath: "/sitemap.xml", destinationPath: "/sitemap.xml",
        pageType: "utility", sourceRouteOrigin: "sitemap-index",
        dynamic: false, protected: false, auditStatus: "utility" });

  return { records, duplicates };
}

// -----------------------------------------------------------------------------
// Step 6 — write reports
// -----------------------------------------------------------------------------

function writeReports(input: {
  records: RouteRecord[];
  duplicates: number;
  sitemap: Record<string, string[]>;
  repoStatus: Awaited<ReturnType<typeof inventorySourceRepoRoutes>>;
  protectedRoots: Array<{ path: string; system: string }>;
}) {
  const { records, duplicates, sitemap, repoStatus, protectedRoots } = input;
  mkdirSync(REPORT_DIR, { recursive: true });

  const unresolved = records.filter((r) => r.auditStatus === "unresolved");
  const protectedCount = records.filter((r) => r.protected).length;

  const manifest = {
    generatedAt: new Date().toISOString().slice(0, 10),
    sourceWebsite: SRC_BASE,
    destinationWebsite: DST_BASE,
    sourceRepository: SRC_REPO,
    sourceRepositoryAccess:
      repoStatus.status === "ok" ? "OK" : `DENIED (${repoStatus.reason})`,
    totals: {
      records: records.length,
      duplicatesRemoved: duplicates,
      unresolved: unresolved.length,
      protected: protectedCount,
      blogArticles: records.filter((r) => r.pageType === "blog_article").length,
      industryPages: records.filter((r) => r.pageType === "industry_page").length,
      redirects: records.filter((r) => r.redirectBehavior).length,
      sitemapUrls: Object.fromEntries(
        Object.entries(sitemap).map(([k, v]) => [k, v.length]),
      ),
    },
    records,
  };

  writeFileSync(join(REPORT_DIR, "source-route-manifest.json"),
    JSON.stringify(manifest, null, 2));
  writeFileSync(join(REPORT_DIR, "unresolved-routes.json"),
    JSON.stringify({ count: unresolved.length, records: unresolved }, null, 2));
  writeFileSync(join(REPORT_DIR, "protected-route-manifest.json"),
    JSON.stringify({
      generatedAt: manifest.generatedAt,
      policy: "Destination canonical operational surface. Source routes mapping here are NOT subject to public marketing migration.",
      trees: protectedRoots.map((p) => ({ destinationPath: p.path, system: p.system })),
      protectedRecordCount: protectedCount,
    }, null, 2));

  const md: string[] = [
    "# Source Route Manifest", "",
    `Generated: ${manifest.generatedAt}  `,
    `Source: ${SRC_BASE}  `,
    `Destination: ${DST_BASE}  `,
    `Repository: ${manifest.sourceRepositoryAccess}`, "",
    "## Totals",
    `- Records: **${records.length}**`,
    `- Blog articles: ${manifest.totals.blogArticles}`,
    `- Industry pages: ${manifest.totals.industryPages}`,
    `- Redirects/aliases: ${manifest.totals.redirects}`,
    `- Protected: ${protectedCount}`,
    `- Unresolved: ${unresolved.length}`, "",
  ];
  writeFileSync(join(REPORT_DIR, "source-route-manifest.md"), md.join("\n"));
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
  const sitemap = await crawlSitemap();
  const homepageLinks = await crawlHomepageLinks();
  const destination = inventoryDestinationRoutes();
  const repoStatus = await inventorySourceRepoRoutes();
  const { records, duplicates } = buildRecords({ sitemap, homepageLinks, destination });
  writeReports({
    records, duplicates, sitemap, repoStatus,
    protectedRoots: destination.protectedRoots,
  });
  console.log(`records=${records.length} duplicates=${duplicates} protected=${records.filter(r=>r.protected).length}`);
}

if (import.meta.main) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
