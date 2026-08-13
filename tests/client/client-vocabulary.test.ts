import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Client-workspace vocabulary guard.
 *
 * Hiring managers say role, candidate, requirements, search. Internal words
 * (position, match, rubric, score run, engine, canonical, processing) must not
 * come back into client-facing copy, so this test scans the real surfaces.
 */

const SCRIPT = "scripts/check-client-vocabulary.mjs";

function run(args: string[] = []) {
  return spawnSync("node", [SCRIPT, ...args], { encoding: "utf8" });
}

function scanFixture(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "client-vocab-"));
  try {
    for (const [name, body] of Object.entries(files)) {
      writeFileSync(join(dir, name), body, "utf8");
    }
    return run([dir]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("client workspace vocabulary", () => {
  it("passes on the current client surfaces", () => {
    const result = run();
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it("fails when internal vocabulary reaches client copy", () => {
    const result = scanFixture({
      "bad.tsx": [
        `export const copy = [`,
        `  "Search positions",`,
        `  "Top matches for this role",`,
        `  "Approved rubric v3",`,
        `  "Every score run records these numbers.",`,
        `  "Candidates are being processed",`,
        `  "Start the run",`,
        `  "The canonical state of the engine",`,
        `];`,
      ].join("\n"),
    });
    expect(result.status).toBe(1);
    for (const rule of [
      "position",
      "match-as-candidate",
      "rubric",
      "score-run",
      "run-as-noun",
      "processing-state",
      "canonical",
      "engine",
    ]) {
      expect(result.stderr).toContain(`[${rule}]`);
    }
  });

  it("leaves route paths, data fields and comments alone", () => {
    const result = scanFixture({
      "ok.tsx": [
        `import { positions } from "@/lib/positions";`,
        `// the canonical position row drives the scoring engine`,
        `const link = "/client/positions";`,
        `const key = ["client", "positions", orgId];`,
        `const title = row.position?.title ?? "Role";`,
        `const copy = "Cancel any time — it runs to the end of the period.";`,
        `const also = "Your team runs interviews.";`,
      ].join("\n"),
    });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it("honours a reviewed vocabulary-allow exception", () => {
    const result = scanFixture({
      "exception.tsx": `const legacy = "Search positions"; // vocabulary-allow: legacy label under review`,
    });
    expect(result.status).toBe(0);
  });
});
