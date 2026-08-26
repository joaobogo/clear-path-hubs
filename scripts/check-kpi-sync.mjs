#!/usr/bin/env node
/**
 * CI guard: exactly one derivation per business figure.
 *
 * The recurring bug class on this platform is the same number computed in two
 * places. `src/lib/kpis/` now owns every business figure; this gate fails the
 * build when code outside it counts or aggregates over one of the core tables
 * (hire_records, positions, interviews, memberships, candidate_matches).
 *
 * Justified exceptions live in scripts/kpi-sync-allowlist.json with a reason.
 *
 * Usage:
 *   node scripts/check-kpi-sync.mjs           # verify (prebuild / CI)
 *   node scripts/check-kpi-sync.mjs --list    # print every offender found
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const ALLOWLIST = JSON.parse(
  readFileSync(join(ROOT, "scripts", "kpi-sync-allowlist.json"), "utf8"),
);
const allowed = new Set(ALLOWLIST.allow.map((e) => e.path));

const CORE_TABLES = [
  "hire_records",
  "positions",
  "interviews",
  "memberships",
  "candidate_matches",
];

/** Directories that own the shared figures, or never render one. */
const OWNED_PREFIXES = [
  "src/lib/kpis/",
  "src/lib/hires/",
  "supabase/",
  "scripts/",
  "tests/",
];

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".output",
  ".vinxi",
  ".nitro",
  ".tanstack",
  "coverage",
  "playwright-report",
  "test-results",
]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const tableGroup = CORE_TABLES.join("|");

/**
 * Counting or aggregating patterns. A shared business figure reads as a bare
 * count (`count: "exact", head: true`), a SQL aggregate, or a `.length` over
 * rows fetched only to be counted. A paginated list that also asks for a total,
 * and a write that checks how many rows it touched, are neither.
 */
const PATTERNS = [
  {
    name: "count select",
    re: new RegExp(
      `from\\(\\s*["'\`](${tableGroup})["'\`]\\s*\\)[\\s\\S]{0,400}?count\\s*:\\s*["'\`]exact["'\`]\\s*,\\s*head\\s*:\\s*true`,
      "g",
    ),
  },
  {
    name: "aggregate select",
    re: new RegExp(
      `from\\(\\s*["'\`](${tableGroup})["'\`]\\s*\\)[\\s\\S]{0,200}?select\\([^)]*(count\\(|sum\\(|avg\\()`,
      "g",
    ),
  },
  {
    name: "local length derivation",
    re: new RegExp(
      `from\\(\\s*["'\`](${tableGroup})["'\`]\\s*\\)(?:(?!\\.update\\(|\\.insert\\(|\\.delete\\(|\\.upsert\\()[\\s\\S]){0,600}?\\)\\s*\\?\\?\\s*\\[\\]\\s*\\)\\.length`,
      "g",
    ),
  },
];


/**
 * A shared business figure is always whole-account: it counts every row of a
 * core table for one organization. A probe scoped to a single role, member or
 * candidate ("does this role still have candidates?") is not one, so only
 * organization-scoped aggregates are gated.
 */
const ORG_SCOPED = /organization_id/;

const offenders = [];
for (const file of walk(join(ROOT, "src"))) {
  const rel = relative(ROOT, file).split("\\").join("/");
  if (OWNED_PREFIXES.some((p) => rel.startsWith(p))) continue;
  if (allowed.has(rel)) continue;
  const src = readFileSync(file, "utf8");
  for (const { name, re } of PATTERNS) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(src))) {
      if (!ORG_SCOPED.test(match[0])) continue;
      const line = src.slice(0, match.index).split("\n").length;
      offenders.push({ rel, line, table: match[1], name });
    }

  }
}

if (offenders.length) {
  console.error(
    `\n✖ KPI sync gate: ${offenders.length} derivation(s) of a business figure outside src/lib/kpis/:\n`,
  );
  for (const o of offenders) {
    console.error(`  ${o.rel}:${o.line}  ${o.name} over ${o.table}`);
  }
  console.error(
    "\nRead the figure from src/lib/kpis/ instead, or add the file to scripts/kpi-sync-allowlist.json with a reason.\n",
  );
  process.exit(1);
}

if (process.argv.includes("--list")) {
  console.log("Allowlisted exceptions:");
  for (const e of ALLOWLIST.allow) console.log(`  ${e.path} — ${e.reason}`);
}
console.log("✓ KPI sync gate: one derivation per business figure.");
