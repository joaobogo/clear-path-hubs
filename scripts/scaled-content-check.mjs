#!/usr/bin/env node
/**
 * CI guard against scaled-content signatures on the public marketing site.
 *
 * Google's scaled-content-abuse policy targets high page volume produced on a
 * compressed timeline with no unique first-hand value per page. This site has
 * 83 live blog posts (after the per-industry consolidation) and 57 industry pages, so the three signatures below
 * have to stay visible and reviewed rather than accumulating quietly:
 *
 *   1. FAIL — an illustrative "sample evidence" / example string used on an
 *      /industries/* page appears verbatim on more than one industry page,
 *      or an explorer component hard-codes an illustrative quote instead of
 *      drawing from the per-industry bank.
 *   2. WARN — more than MAX_POSTS_PER_DAY live posts share one publish date.
 *      A real editorial batch is legitimate; it should be a visible decision
 *      each time, not a silent default.
 *   3. FAIL — a live post has no distinct, registered author (the legacy
 *      "TaaSFlow" byline does not count).
 *
 * Usage:
 *   node scripts/scaled-content-check.mjs           # verify (prebuild / CI)
 *   node scripts/scaled-content-check.mjs --strict  # warnings fail too
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const MAX_POSTS_PER_DAY = 8;
const STRICT = process.argv.includes("--strict");

const errors = [];
const warnings = [];

const read = (p) => readFileSync(join(ROOT, p), "utf8");

/* ---------- 1. illustrative evidence must be unique per industry ---------- */

const bank = JSON.parse(read("src/content/industry-evidence-bank.json"));
const industries = bank.industries ?? {};
const industryCount = Object.keys(industries).length;

if (industryCount === 0) {
  errors.push(
    "src/content/industry-evidence-bank.json is empty — run: bun scripts/generate-industry-evidence-bank.mjs",
  );
}

const owners = new Map(); // string -> first industry slug that used it
let exampleCount = 0;
for (const [slug, entry] of Object.entries(industries)) {
  const strings = [
    ...Object.values(entry.roleEvidence ?? {}),
    ...Object.values(entry.signalFlags ?? {}).flatMap((f) => [f.good, f.bad]),
  ].filter(Boolean);
  for (const s of strings) {
    exampleCount += 1;
    const norm = s.replace(/\s+/g, " ").trim().toLowerCase();
    const prev = owners.get(norm);
    if (prev && prev !== slug) {
      errors.push(
        `Illustrative evidence reused across industries (/industries/${prev} and /industries/${slug}):\n    "${s.slice(0, 120)}…"`,
      );
    } else {
      owners.set(norm, slug);
    }
  }
}

// No illustrative quotes may be hard-coded back into the explorer components —
// that is how the same example ended up on several industry pages before.
for (const file of [
  "src/components/marketing/industry-role-explorer.tsx",
  "src/components/marketing/industry-signal-explorer.tsx",
]) {
  const src = read(file);
  const quoted = src.match(/[“”]/g);
  if (quoted) {
    errors.push(
      `${file} hard-codes ${quoted.length / 2 || 1} illustrative quote(s). Add the example to src/content/industry-evidence-bank.json (via the generator) instead.`,
    );
  }
}

/* ---------- live post set (mirrors blog-catalog.ts) ---------- */

const manifest = read("src/lib/marketing/blog-manifest.ts");
const includedBlock = manifest
  .split("export const INCLUDED_BLOG_SLUGS")[1]
  .split(/\n\]/)[0];
const included = [...includedBlock.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

const blogDir = "src/content/blog";
const files = readdirSync(join(ROOT, blogDir)).filter((f) => f.endsWith(".json"));
const posts = new Map();
for (const f of files) {
  const slug = f.replace(/\.json$/, "");
  posts.set(slug, JSON.parse(read(join(blogDir, f))));
}

// Industry posts are auto-included by blog-catalog.ts when they carry an
// `industry` field, so they count as live even without a manifest entry.
const live = new Set(included.filter((s) => posts.has(s)));
for (const [slug, post] of posts) {
  if (post.industry) live.add(slug);
}

/* ---------- 2. publish-date batching (warn) ---------- */

const byDate = new Map();
for (const slug of live) {
  const date = (posts.get(slug)?.meta?.["article:published_time"] ?? "").slice(0, 10);
  if (!date) {
    errors.push(`${slug}: live post has no article:published_time.`);
    continue;
  }
  byDate.set(date, [...(byDate.get(date) ?? []), slug]);
}
for (const [date, slugs] of [...byDate].sort((a, b) => b[1].length - a[1].length)) {
  if (slugs.length > MAX_POSTS_PER_DAY) {
    warnings.push(
      `${slugs.length} live posts share the publish date ${date} (limit ${MAX_POSTS_PER_DAY}). ` +
        `Batch publishing is allowed, but stagger the dates or confirm this batch was reviewed. e.g. ${slugs.slice(0, 3).join(", ")}…`,
    );
  }
}

/* ---------- 3. every live post needs a registered, distinct author ---------- */

const authorsSrc = read("src/content/blog-authors.ts");
const registered = new Set(
  [...authorsSrc.matchAll(/name:\s*"([^"]+)"/g)].map((m) => m[1].toLowerCase()),
);
const legacy = new Set(["", "taasflow", "taasflow team", "admin", "editor"]);

for (const slug of [...live].sort()) {
  const raw = (posts.get(slug)?.meta?.author ?? "").trim();
  const key = raw.toLowerCase();
  if (!raw || legacy.has(key)) {
    errors.push(
      `${slug}: byline "${raw || "(empty)"}" is not a real author. Set meta.author to a name registered in src/content/blog-authors.ts.`,
    );
  } else if (!registered.has(key)) {
    errors.push(
      `${slug}: author "${raw}" is not registered in src/content/blog-authors.ts (add them, with a role and an about-the-author note).`,
    );
  }
}

/* ---------- report ---------- */

console.log(
  `scaled-content-check: ${live.size} live posts, ${industryCount} industry pages, ${exampleCount} illustrative examples (${owners.size} unique).`,
);

for (const w of warnings) console.warn(`WARN  ${w}`);
for (const e of errors) console.error(`FAIL  ${e}`);

if (errors.length > 0 || (STRICT && warnings.length > 0)) {
  console.error(
    `\nscaled-content-check failed: ${errors.length} error(s), ${warnings.length} warning(s).`,
  );
  process.exit(1);
}
console.log(
  `scaled-content-check passed${warnings.length ? ` with ${warnings.length} warning(s)` : ""}.`,
);
