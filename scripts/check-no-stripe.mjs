#!/usr/bin/env node
/**
 * CI guard: fails the build when a Stripe-related string appears anywhere in the
 * repository outside the recorded technical baseline.
 *
 * Visitor-facing copy must never mention the payment vendor. A handful of files
 * legitimately reference the SDK / provider internals (server clients, webhook
 * plumbing, historical migrations, internal runbooks). Those are pinned in
 * scripts/stripe-allowlist.json with an exact match count, so any NEW mention —
 * even inside an allowlisted file — fails the gate.
 *
 * Usage:
 *   node scripts/check-no-stripe.mjs            # verify (CI)
 *   node scripts/check-no-stripe.mjs --update   # re-record the baseline
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const BASELINE_PATH = join(ROOT, "scripts", "stripe-allowlist.json");

const PATTERN = /stripe/i;

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
  ".vercel",
  ".wrangler",
]);

const SKIP_FILES = new Set([
  "bun.lock",
  "bun.lockb",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "tsconfig.tsbuildinfo",
  join("scripts", "check-no-stripe.mjs"),
  join("scripts", "stripe-allowlist.json"),
]);

const TEXT_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".mdx",
  ".css", ".scss", ".html", ".sql", ".txt", ".yml", ".yaml", ".toml", ".svg", ".env.example",
]);

/** Surfaces that must always be free of vendor mentions, allowlist or not. */
const NEVER_ALLOWED = [];

function isTextFile(path) {
  const dot = path.lastIndexOf(".");
  return dot !== -1 && TEXT_EXT.has(path.slice(dot).toLowerCase());
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const rel = relative(ROOT, abs);
    if (SKIP_DIRS.has(entry)) continue;
    let st;
    try {
      st = statSync(abs);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walk(abs, out);
    } else if (isTextFile(abs) && !SKIP_FILES.has(rel) && !SKIP_FILES.has(entry)) {
      out.push(rel.split(sep).join("/"));
    }
  }
  return out;
}

function scan() {
  const found = new Map();
  for (const rel of walk(ROOT)) {
    let text;
    try {
      text = readFileSync(join(ROOT, rel), "utf8");
    } catch {
      continue;
    }
    if (!PATTERN.test(text)) continue;
    const hits = text
      .split("\n")
      .map((line, i) => ({ line: i + 1, text: line.trim() }))
      .filter((l) => PATTERN.test(l.text));
    if (hits.length) found.set(rel, hits);
  }
  return found;
}

const found = scan();

if (process.argv.includes("--update")) {
  const baseline = {};
  for (const [file, hits] of [...found.entries()].sort()) baseline[file] = hits.length;
  writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify({ note: "Pinned technical vendor references. Never add visitor-facing copy here.", files: baseline }, null, 2)}\n`,
  );
  console.log(`Recorded ${Object.keys(baseline).length} allowlisted files in scripts/stripe-allowlist.json`);
  process.exit(0);
}

const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, "utf8")).files ?? {}
  : {};

const failures = [];

for (const [file, hits] of found) {
  const allowed = baseline[file];
  if (NEVER_ALLOWED.some((rx) => rx.test(file))) {
    failures.push({ file, hits, reason: "visitor-facing surface — vendor name is never allowed here" });
    continue;
  }
  if (allowed === undefined) {
    failures.push({ file, hits, reason: "new file with a payment-vendor reference" });
  } else if (hits.length > allowed) {
    failures.push({
      file,
      hits,
      reason: `${hits.length} references, baseline allows ${allowed}`,
    });
  }
}

const removed = Object.keys(baseline).filter((f) => !found.has(f));

if (failures.length === 0) {
  console.log(
    `No new payment-vendor references. ${found.size} allowlisted file(s) checked.${
      removed.length ? ` ${removed.length} baseline entr(y/ies) now clean — run with --update to shrink the baseline.` : ""
    }`,
  );
  process.exit(0);
}

console.error("Payment-vendor reference check FAILED.\n");
for (const failure of failures) {
  console.error(`  ${failure.file} — ${failure.reason}`);
  for (const hit of failure.hits.slice(0, 5)) {
    console.error(`    ${hit.line}: ${hit.text.slice(0, 160)}`);
  }
  console.error("");
}
console.error(
  "Remove the vendor name from user-visible copy. If the reference is strictly technical\n" +
    "(server SDK, webhook plumbing, historical migration), re-record the baseline with:\n" +
    "  bun run check:no-stripe -- --update\n",
);
process.exit(1);
