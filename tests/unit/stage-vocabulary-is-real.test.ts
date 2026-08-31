/**
 * A guard compared against a value that does not exist can never fire.
 *
 * The codebase compared `stage` against "interview", "shortlist", "reviewing"
 * and "archived" — none of which are pipeline stages. Every one of those
 * comparisons was dead, silently:
 *
 *   - the client weekly update reported 0 open roles and 0 interviewing
 *   - stalledInterviews always returned nothing
 *   - a withdrawn candidate was never treated as closed, so the platform
 *     handed someone a next action for a person who had left the process
 *
 * Nothing failed. The numbers were simply wrong. This reads the source so the
 * next one fails a build instead of a client email.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PIPELINE_STAGE_VOCABULARY } from "@/lib/vocabulary";

const STAGES = new Set(Object.keys(PIPELINE_STAGE_VOCABULARY));

/** Entities whose own `stage` column is unrelated to the candidate pipeline. */
const UNRELATED_STAGE_OWNERS = [
  "checkout_started", // payment attempt lifecycle
];

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

describe("every stage comparison names a real stage", () => {
  const files = sourceFiles(join(process.cwd(), "src"));

  it("has stages to check against", () => {
    expect(STAGES.size).toBeGreaterThan(5);
    expect(STAGES.has("interview_process")).toBe(true);
    expect(STAGES.has("interview")).toBe(false);
  });

  it("finds no comparison against a non-existent stage", () => {
    const offenders: string[] = [];

    for (const file of files) {
      // The vocabulary module defines the stages; it is not comparing to them.
      if (file.endsWith(join("lib", "vocabulary.ts"))) continue;
      const lines = readFileSync(file, "utf8").split(/\r?\n/);

      lines.forEach((line, i) => {
        if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) return;
        const patterns = [
          /\bstage\s*===?\s*"([a-z_]+)"/g,
          /\.eq\(\s*"stage"\s*,\s*"([a-z_]+)"/g,
        ];
        for (const re of patterns) {
          for (const m of line.matchAll(re)) {
            const value = m[1]!;
            if (STAGES.has(value)) continue;
            if (UNRELATED_STAGE_OWNERS.includes(value)) continue;
            offenders.push(
              `${file.replace(process.cwd(), "")}:${i + 1} compares stage to "${value}"`,
            );
          }
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});
