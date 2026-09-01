/**
 * Source scanning for guard tests, without a shell.
 *
 * Several guards shelled out to `grep`/`rg` with `|| true` and, in one case,
 * `shell: "/bin/bash"`. On Windows they do not run at all — they throw
 * `spawnSync /bin/bash ENOENT`, or fail because execSync without a shell hands
 * `||` and `true` to grep as filenames. Three source-reading guards that could
 * never fire on a developer machine, reported as three failing tests that
 * everyone had learned to call environmental.
 *
 * That is exactly the defect class these guards exist to catch: a check written
 * for a case it cannot reach. The vitest config comment above them already
 * conceded the shell-out was causing trouble and raised the timeout, which
 * treated the symptom.
 *
 * This walks the tree with node:fs instead. No shell, no ripgrep dependency,
 * same answer on every platform — and a scan that finds nothing is now
 * distinguishable from a scan that never ran, because `sourceFiles` throws on
 * an empty tree.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SKIP_DIRS = new Set(["node_modules", "dist", ".output", ".git", ".claude"]);

export type ScanOptions = {
  /** Extensions to read. Defaults to TypeScript sources. */
  extensions?: string[];
  /** Skip files whose repo-relative path matches any of these. */
  exclude?: RegExp[];
};

const DEFAULT_EXTENSIONS = [".ts", ".tsx"];

/** Every source file under `dir`, as repo-relative POSIX paths. */
export function sourceFiles(dir: string, opts: ScanOptions = {}): string[] {
  const extensions = opts.extensions ?? DEFAULT_EXTENSIONS;
  const root = process.cwd();
  const out: string[] = [];

  const walk = (current: string) => {
    for (const entry of readdirSync(current)) {
      if (SKIP_DIRS.has(entry)) continue;
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!extensions.some((e) => entry.endsWith(e))) continue;
      const rel = relative(root, full).split(sep).join("/");
      if (opts.exclude?.some((re) => re.test(rel))) continue;
      out.push(rel);
    }
  };

  walk(dir);
  // A guard that scans nothing passes silently, which is how the shell-out
  // versions of these checks went unnoticed. Refuse to be that.
  if (out.length === 0) {
    throw new Error(`scan-source: no files under ${dir} — the guard would pass without checking`);
  }
  return out.sort();
}

export type SourceHit = { file: string; line: number; text: string };

/** Every line under `dir` matching `pattern`, with its file and line number. */
export function grepSource(
  dir: string,
  pattern: RegExp,
  opts: ScanOptions = {},
): SourceHit[] {
  const hits: SourceHit[] = [];
  for (const file of sourceFiles(dir, opts)) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((text, i) => {
      // Fresh lastIndex per line: a /g pattern is stateful across .test calls.
      const re = new RegExp(pattern.source, pattern.flags.replace("g", ""));
      if (re.test(text)) hits.push({ file, line: i + 1, text: text.trim() });
    });
  }
  return hits;
}

/** Files containing at least one match. */
export function filesMatching(dir: string, pattern: RegExp, opts: ScanOptions = {}): string[] {
  return [...new Set(grepSource(dir, pattern, opts).map((h) => h.file))];
}

/** `file:line  text` — readable in an assertion failure. */
export function formatHits(hits: SourceHit[]): string {
  return hits.map((h) => `${h.file}:${h.line}  ${h.text}`).join("\n");
}
