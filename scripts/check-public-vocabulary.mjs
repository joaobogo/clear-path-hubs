#!/usr/bin/env node
/**
 * Public vocabulary guard.
 *
 * TaaSFlow ships as an AI hiring intelligence platform, so public routes and
 * marketing components must not describe the product as an agency staffed by
 * "our recruiters" working a "delivery cadence". This script scans exactly
 * those surfaces and exits non-zero when agency-dominant self-description
 * survives, which fails the build.
 *
 * Comparative language stays legal and honest: "unlike a traditional agency"
 * or a page written *for* staffing agencies is allowed, so each rule carries
 * context exemptions rather than a blunt substring ban.
 *
 * Usage:
 *   node scripts/check-public-vocabulary.mjs          # fail on violations
 *   node scripts/check-public-vocabulary.mjs --report # list, always exit 0
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const REPORT_ONLY = process.argv.includes("--report");

/** Surfaces a visitor can read before signing in. */
const SCAN_DIRS = [
  "src/routes",
  "src/components/home",
  "src/components/marketing",
  "src/components/pricing",
  "src/content/pages",
];

const SCAN_EXT = /\.(tsx?|json|md)$/;

/**
 * Files excluded from the scan, by path prefix.
 * - Authenticated product surfaces are internal vocabulary, not marketing.
 * - The language config and this script necessarily contain the banned terms.
 */
const EXCLUDE_PREFIXES = [
  "src/routes/_authenticated",
  "src/routes/admin",
  "src/routes/api",
  "src/routes/__root.tsx",
  "src/routes/routeTree.gen.ts",
];

/**
 * A rule fires when `pattern` matches and no `allow` pattern matches the same
 * line. `use` names the platform phrasing that should replace it.
 */
const RULES = [
  {
    id: "our-recruiters",
    // First-person self-description only. "your recruiter" on partner pages
    // means the reader's own recruiter and is left alone.
    pattern:
      /\bour\s+(recruiters?|sourcers?|consultants?)\b|\bour\s+team\s+of\s+recruiters\b|\brecruiters?\s+on\s+our\s+(team|bench)\b/i,
    use: "the TaaSFlow platform / sourcing agents / configurable expert oversight",
  },
  {
    id: "recruiter-delivers",
    pattern: /\brecruiters?\s+(delivers?|will deliver|sources?|screens?|hand-?picks?)\b/i,
    use: "the system produces / sourcing agents identify",
  },
  {
    id: "recruiting-pod",
    pattern: /\b(recruiting|delivery|dedicated|sourcing)\s+pods?\b|\bpod\s+of\s+recruiters\b/i,
    use: "agent capacity / dedicated agent capacity",
  },
  {
    id: "delivery-cadence",
    pattern: /\bdelivery\s+cadence\b|\bweekly\s+delivery\s+(call|sync|meeting)\b/i,
    use: "system operating cadence",
  },
  {
    id: "we-source-manually",
    pattern: /\bwe\s+(source|headhunt|shortlist|screen)\b|\bwe'?ll\s+(source|headhunt|screen)\b/i,
    use: "sourcing agents continuously identify / the platform screens",
  },
  {
    id: "sourcing-channels",
    pattern: /\bsourcing\s+channels\b/i,
    use: "talent signals",
  },
  {
    id: "recruiting-team",
    pattern: /\b(our|your|the)\s+(recruiting|recruitment|talent\s+acquisition)\s+team\s+(will|does|handles|manages|delivers)\b/i,
    use: "expert oversight (approval gate + escalation path)",
  },
  {
    id: "agency-self-description",
    // Only "we are an agency" style self-description, never comparison.
    pattern:
      /\b(we\s+are|we'?re|taasflow\s+is)\s+(an?\s+)?(recruiting|recruitment|staffing|talent)?\s*agency\b/i,
    use: "TaaSFlow is an AI hiring intelligence platform",
  },
  {
    id: "headcount-billing",
    pattern: /\b(per|by the)\s+(recruiter|consultant)\s+(seat|hour|day)\b/i,
    use: "subscription entitlements",
  },
];

/** Lines that never reach a visitor: imports, and pure code comments. */
const NON_COPY_LINE =
  /^\s*(import\s|export\s+\*|\/\/|\/\*|\*|#|\*\/)|from\s+["'][^"']+["'];?\s*$/;

/** Inline escape hatch for a deliberate, reviewed exception. */
const ALLOW_MARKER = /vocabulary-allow/i;

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SCAN_EXT.test(entry)) out.push(full);
  }
  return out;
}

function isExcluded(rel) {
  const posix = rel.split(sep).join("/");
  return EXCLUDE_PREFIXES.some((p) => posix === p || posix.startsWith(`${p}/`));
}

const violations = [];

/** Every rule match in one string, with the offending phrase captured. */
function matchesIn(text) {
  const hits = [];
  for (const rule of RULES) {
    const re = new RegExp(rule.pattern.source, "gi");
    let m;
    while ((m = re.exec(text)) !== null) {
      const from = Math.max(0, m.index - 45);
      const context = text.slice(from, m.index + m[0].length + 45).replace(/\s+/g, " ");
      if (rule.allow?.some((a) => a.test(context))) continue;
      hits.push({ rule: rule.id, use: rule.use, phrase: m[0], context: context.trim() });
    }
  }
  return hits;
}

/** JSON page snapshots ship into public routes, so walk their string values. */
function scanJson(rel, raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return;
  }
  const walkValue = (value, path) => {
    if (typeof value === "string") {
      if (ALLOW_MARKER.test(value)) return;
      for (const hit of matchesIn(value)) {
        violations.push({ file: rel, where: path || "(root)", ...hit });
      }
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => walkValue(v, `${path}[${i}]`));
    } else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        walkValue(v, path ? `${path}.${k}` : k);
      }
    }
  };
  walkValue(data, "");
}

function scanCode(rel, raw) {
  raw.split("\n").forEach((line, i) => {
    if (NON_COPY_LINE.test(line) || ALLOW_MARKER.test(line)) return;
    for (const hit of matchesIn(line)) {
      violations.push({ file: rel, where: `line ${i + 1}`, ...hit });
    }
  });
}

for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file).split(sep).join("/");
    if (isExcluded(rel)) continue;
    const raw = readFileSync(file, "utf8");
    if (rel.endsWith(".json")) scanJson(rel, raw);
    else scanCode(rel, raw);
  }
}

const scanned = SCAN_DIRS.join(", ");

if (violations.length === 0) {
  console.log(`✓ Public vocabulary check passed (${scanned}).`);
  process.exit(0);
}

console.error(
  `\n✗ Public vocabulary check found ${violations.length} agency-dominant phrase${
    violations.length === 1 ? "" : "s"
  } on public surfaces.\n`,
);
for (const v of violations) {
  console.error(`  ${v.file} ${v.where}  [${v.rule}] "${v.phrase}"`);
  console.error(`    …${v.context}…`);
  console.error(`    → use: ${v.use}\n`);
}
console.error(
  "Rewrite the copy as platform capability, or add a `vocabulary-allow` comment on\n" +
    "the line when the phrasing is a deliberate comparison to agencies.\n",
);

process.exit(REPORT_ONLY ? 0 : 1);
