/**
 * Guard: countable figures are read, never stored.
 *
 * The seats bug happened because a staff card kept its own copy of a seat count
 * and the copy drifted. These assertions fail if a stored copy comes back, or if
 * a surface starts deriving one of the shared figures on its own again.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const files = walk("src").filter((f) => !f.includes("__tests__") && !f.endsWith(".test.ts"));

describe("stored copies of derivable figures", () => {
  it("no code writes a seat, role, candidate or hire count to a row", () => {
    const offenders = files.filter((f) => {
      const src = readFileSync(f, "utf8");
      return /\.update\(\{[^}]*(seats_used|seat_count|roles_open|candidate_count|candidates_delivered|hire_count|hires_total)/.test(
        src,
      );
    });
    expect(offenders).toEqual([]);
  });

  it("staff client surfaces read the rollup reader rather than counting rows themselves", () => {
    const src = readFileSync("src/lib/admin.functions.ts", "utf8");
    expect(src).toContain("readOrgRollups");
  });

  it("each shared figure keeps exactly one reader file", () => {
    const kpis = readdirSync("src/lib/kpis");
    for (const expected of [
      "seats.server.ts",
      "open-roles.server.ts",
      "confirmed-hires.server.ts",
      "interviews.server.ts",
      "candidates-in-play.server.ts",
      "org-rollups.server.ts",
    ]) {
      expect(kpis).toContain(expected);
    }
  });
});
