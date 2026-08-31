/**
 * Paginated queries must have a total order.
 *
 * Every sort key we page on is non-unique — several positions share an
 * updated_at, several audit rows share a created_at, messages share a second.
 * Postgres may order ties differently between queries, and each page IS a
 * separate query, so a tied row could land on page 1 and again on page 2 while
 * another was skipped: the positions list showed the same role twice
 * (audit #6, A6-29).
 *
 * The rule: any `.range(` must be preceded by at least two `.order(` calls, the
 * last of which is on a unique column. This reads the source rather than
 * hitting the database, so it fails on the PR that introduces the next one.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const UNIQUE_KEYS = ["id", "match_id", "candidate_match_id"];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * The order/range calls of one query, in source order. Chains are written
 * across many lines and sometimes split across statements (`q = q.order(...)`),
 * so this scans a window of preceding lines rather than parsing expressions.
 */
function orderKeysBefore(lines: string[], rangeLine: number): string[] {
  const keys: string[] = [];
  for (let i = rangeLine - 1; i >= 0 && i >= rangeLine - 25; i--) {
    const line = lines[i]!;
    const m = line.match(/\.order\(\s*["'`]([a-z_]+)["'`]/i);
    if (m) keys.unshift(m[1]!);
    // A blank line inside a chain is fine; a closing brace means we walked out
    // of the query being built.
    if (/^\s*\}/.test(line) && keys.length > 0) break;
  }
  return keys;
}

describe("paginated queries have a total order", () => {
  const files = sourceFiles(join(process.cwd(), "src", "lib"));

  it("finds the queries it is meant to be guarding", () => {
    const total = files.filter((f) => readFileSync(f, "utf8").includes(".range(")).length;
    expect(total).toBeGreaterThan(3);
  });

  it("every .range() is ordered by a unique key last", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      if (!src.includes(".range(")) continue;
      const lines = src.split(/\r?\n/);

      lines.forEach((line, i) => {
        if (!line.includes(".range(")) return;
        // Dynamic sorts assign the range separately; both forms are covered
        // because we look at the order calls that precede the range.
        const keys = orderKeysBefore(lines, i);
        if (keys.length === 0) return; // unordered fetch, not pagination
        const last = keys[keys.length - 1]!;
        if (!UNIQUE_KEYS.includes(last)) {
          offenders.push(`${file.replace(process.cwd(), "")}:${i + 1} orders by [${keys.join(", ")}]`);
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});
