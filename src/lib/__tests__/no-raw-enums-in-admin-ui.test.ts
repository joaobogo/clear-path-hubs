import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard: no internal snake_case token may reach a rendered text node in the
 * admin surfaces. Anything a person reads goes through the shared
 * enum-to-label map in src/lib/humanize-codes.ts.
 *
 * The scan is deliberately narrow — JSX text nodes only — so props, keys,
 * comparisons and query keys keep using the stored tokens.
 */
const ROOTS = ["src/components/admin", "src/routes/_authenticated"];

// Words that read as English even with an underscore-free lowercase shape are
// not enums; the pattern below only matches a_b style tokens, so allow the few
// legitimate ones (CSS/aria values live in props, not text nodes).
const ALLOW = new Set<string>([]);

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out = out.concat(walk(full));
    } else if (/\.tsx$/.test(full) && !/__tests__/.test(full)) {
      out.push(full);
    }
  }
  return out;
}

/** Extract JSX text nodes: `>text<` runs that are not inside braces or tags. */
function jsxTextNodes(source: string): string[] {
  const nodes: string[] = [];
  const re = />([^<>{}]+)</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const text = m[1]!.trim();
    if (text) nodes.push(text);
  }
  return nodes;
}

const ENUM_SHAPE = /^[a-z]+_[a-z_]+$/;

describe("admin UI renders labels, never internal enum tokens", () => {
  it("has no snake_case token in any admin JSX text node", () => {
    const offenders: string[] = [];

    for (const root of ROOTS) {
      for (const file of walk(root)) {
        const source = readFileSync(file, "utf8");
        for (const node of jsxTextNodes(source)) {
          for (const word of node.split(/[\s·,;:()[\]"']+/)) {
            const token = word.trim();
            if (!token || ALLOW.has(token)) continue;
            if (ENUM_SHAPE.test(token)) {
              offenders.push(`${file}: "${token}" (in "${node.slice(0, 80)}")`);
            }
          }
        }
      }
    }

    expect(offenders, `Route these through humanizeCode():\n${offenders.join("\n")}`).toEqual([]);
  });
});
