/**
 * Incremental ESLint gate for the existing repository.
 * The baseline has extensive pre-existing formatting debt; rewriting
 * unrelated files during a product release would be risky. Fail if any
 * non-formatting ESLint rule accumulates new errors in changed files.
 * TypeScript, build, unit and browser checks remain independent gates.
 */
import { execFileSync } from "node:child_process";
import { ESLint } from "eslint";

const runGit = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const ZERO = /^0+$/;
let base = process.env.LINT_BASE_SHA?.trim() || "";
if (!base || ZERO.test(base)) base = runGit("rev-parse", "HEAD^");
try {
  runGit("rev-parse", "--verify", base + "^{commit}");
} catch {
  throw new Error("Lint baseline commit is unavailable: " + base);
}

const raw = execFileSync("git", [
  "diff", "--name-only", "-z", "--diff-filter=ACMR", base, "HEAD", "--",
  "*.ts", "*.tsx", "*.js", "*.jsx",
], { encoding: "utf8" });
const paths = raw.split("\0").filter(Boolean);
const eslint = new ESLint();
const excluded = new Set(["prettier/prettier"]);

function summarize(messages) {
  const counts = new Map();
  for (const message of messages) {
    if (message.severity !== 2) continue;
    const key = message.ruleId || "parser";
    if (excluded.has(key)) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

const failures = [];
let touched = 0;
for (const path of paths) {
  if (await eslint.isPathIgnored(path)) continue;
  const after = await eslint.lintFiles([path]);
  let priorText = null;
  try {
    priorText = runGit("show", base + ":" + path);
  } catch {
    // Added file: no baseline violations.
  }
  const before = priorText === null ? [] : await eslint.lintText(priorText, { filePath: path });
  const previousCounts = summarize(before.flatMap((r) => r.messages));
  const currentCounts = summarize(after.flatMap((r) => r.messages));
  touched++;
  for (const [rule, count] of currentCounts) {
    const previous = previousCounts.get(rule) || 0;
    if (count > previous) {
      failures.push(path + ": " + rule + " grew from " + previous + " to " + count);
    }
  }
}
console.log("Incremental ESLint checked " + touched + " changed files against " + base.slice(0, 12));
console.log("Existing formatting debt does not count as an introduced regression.");
if (failures.length) {
  for (const issue of failures) console.error("NEW ESLINT ERROR: " + issue);
  process.exitCode = 1;
} else {
  console.log("No new semantic ESLint errors.");
}
