#!/usr/bin/env node
/**
 * Client-workspace vocabulary guard.
 *
 * Hiring managers say "role", "candidate", "requirements", "search". They do
 * not say "position", "match", "rubric", "score run", "engine", "canonical
 * state" or "processing state" — that is our internal vocabulary. This script
 * reads only user-visible text (string/template literals and JSX text) on the
 * client workspace surfaces and exits non-zero when internal wording survives.
 *
 * Route paths, query keys, data fields and code comments are not copy, so they
 * are skipped: `/client/positions` stays a URL, `match_id` stays a column.
 *
 * Usage:
 *   node scripts/check-client-vocabulary.mjs           # fail on violations
 *   node scripts/check-client-vocabulary.mjs --report  # list, always exit 0
 *   node scripts/check-client-vocabulary.mjs <dir…>    # scan fixtures instead
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";

const ROOT = process.cwd();
const ARGS = process.argv.slice(2);
const REPORT_ONLY = ARGS.includes("--report");
const DIR_OVERRIDE = ARGS.filter((a) => !a.startsWith("--"));

/** Surfaces the client workspace actually renders. */
const DEFAULT_SCAN_DIRS = [
  "src/components/client",
  "src/components/workspace",
  "src/lib/empty-states",
];

/** Individual files (client routes live beside staff routes). */
const DEFAULT_SCAN_FILES = readdirSync(join(ROOT, "src/routes/_authenticated"))
  .filter((n) => /^client([.].*)?\.tsx$/.test(n))
  .map((n) => `src/routes/_authenticated/${n}`);

const SCAN_EXT = /\.tsx?$/;

/** Rules: `pattern` is the internal wording, `use` the hiring-manager wording. */
const RULES = [
  {
    id: "position",
    pattern: /\bpositions?\b/i,
    use: "role / roles",
  },
  {
    id: "match-as-candidate",
    // "match" used as a thing we deliver, not the verb "matches this role".
    pattern:
      /\b(top|approved|new|delivered|best|qualified)\s+matches\b|\bmatch(es)?\s+(land|appear|arrive)\b|\bsend you (better|more) matches\b|\bthe match\b/i,
    use: "candidate / candidates",
  },
  {
    id: "rubric",
    pattern: /\brubrics?\b/i,
    use: "requirements / what the role asks for",
  },
  {
    id: "score-run",
    pattern: /\bscore runs?\b|\bscoring runs?\b/i,
    use: "assessment",
  },
  {
    id: "run-as-noun",
    pattern:
      /\b(a|the|this|that|first|each|every|next|last|another|sourcing|discovery|agent|completed|further|no)\s+runs?\b|\bruns?\s+(is|are)\s+(in progress|running|executing|queued)\b|\bstart the run\b/i,
    use: "search / candidate search",
    allow: [/runs? (to the end|interviews|on)/i, /vocabulary-allow/i],
  },
  {
    id: "engine",
    pattern: /\bengines?\b/i,
    use: "the platform / how we assess",
  },
  {
    id: "canonical",
    pattern: /\bcanonical\b/i,
    use: "plain description of the thing",
  },
  {
    id: "processing-state",
    pattern:
      /\bprocessing\b|\bbeing processed\b|\bin processing\b|\bprocessing state\b|\bstate machine\b|\bpayload\b|\bupsert\w*\b|\bingest(ion|ed|ing)?\b/i,
    use: "being reviewed / under review",
  },
];

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

/**
 * Extracts only what a user can read: string/template literals and JSX text.
 * Identifiers, route paths, class names and query keys are excluded because
 * they contain no prose (no whitespace, or no sentence punctuation).
 */
function copyStrings(source) {
  const out = [];
  const lines = source.split("\n");
  lines.forEach((line, i) => {
    if (/^\s*(import\s|export\s+\*|\/\/|\/\*|\*|\*\/)/.test(line)) return;
    if (ALLOW_MARKER.test(line)) return;
    const literals = line.match(/"[^"\n]{4,}"|'[^'\n]{4,}'|`[^`\n]{4,}`/g) ?? [];
    for (const raw of literals) {
      // Inside a template literal, `${expr}` is code — keep only any copy
      // strings written inside the expression.
      const text = raw
        .slice(1, -1)
        .replace(/\$\{([^}]*)\}/g, (_m, expr) =>
          (expr.match(/"[^"]*"|'[^']*'/g) ?? []).map((q) => ` ${q.slice(1, -1)} `).join(" "),
        );
      if (!/\s/.test(text)) continue; // identifier / path / class token
      if (/^[a-z0-9:_\-/ .]+$/.test(text) && !/[.?!]/.test(text)) continue;
      if (/^[-a-z0-9 :_/[\]()]+$/i.test(text) && /^[a-z-]+ /.test(text) && !/[.?!]/.test(text) && /(\bflex\b|\btext-|\bgrid\b|\bmt-|\bpx-|\brounded)/.test(text)) continue;
      out.push({ line: i + 1, text });
    }
    // JSX text nodes: >Some words<
    for (const m of line.matchAll(/>([^<>{}\n]{4,})</g)) {
      const text = m[1].trim();
      if (text && /\s|[A-Za-z]{4,}/.test(text)) out.push({ line: i + 1, text });
    }
  });
  return out;
}

const violations = [];

function scan(rel, raw) {
  for (const { line, text } of copyStrings(raw)) {
    // Tailwind class strings are not copy.
    if (/(^|\s)(flex|grid|text-|bg-|border|rounded|px-|py-|mt-|gap-|w-|h-)\S*/.test(text) && !/[.?!]/.test(text) && text.split(" ").length > 2 && !/[A-Z]/.test(text)) continue;
    for (const rule of RULES) {
      const re = new RegExp(rule.pattern.source, "gi");
      let m;
      while ((m = re.exec(text)) !== null) {
        if (rule.allow?.some((a) => a.test(text))) continue;
        violations.push({
          file: rel,
          where: `line ${line}`,
          rule: rule.id,
          use: rule.use,
          phrase: m[0],
          context: text.slice(0, 140),
        });
      }
    }
  }
}

const targets = [];
if (DIR_OVERRIDE.length > 0) {
  for (const dir of DIR_OVERRIDE) {
    const abs = isAbsolute(dir) ? dir : join(ROOT, dir);
    if (statSync(abs).isDirectory()) targets.push(...walk(abs));
    else targets.push(abs);
  }
} else {
  for (const dir of DEFAULT_SCAN_DIRS) targets.push(...walk(join(ROOT, dir)));
  for (const file of DEFAULT_SCAN_FILES) targets.push(join(ROOT, file));
}

for (const file of targets) {
  const rel = relative(ROOT, file).split(sep).join("/");
  scan(rel, readFileSync(file, "utf8"));
}

if (violations.length === 0) {
  console.log(`✓ Client vocabulary check passed (${targets.length} files).`);
  process.exit(0);
}

console.error(
  `\n✗ Client vocabulary check found ${violations.length} internal term${
    violations.length === 1 ? "" : "s"
  } in client-facing copy.\n`,
);
for (const v of violations) {
  console.error(`  ${v.file} ${v.where}  [${v.rule}] "${v.phrase}"`);
  console.error(`    …${v.context}…`);
  console.error(`    → use: ${v.use}\n`);
}
console.error(
  "Rewrite the copy in hiring-manager language, or add a `vocabulary-allow`\n" +
    "comment on the line when the internal term is deliberate and reviewed.\n",
);

process.exit(REPORT_ONLY ? 0 : 1);
