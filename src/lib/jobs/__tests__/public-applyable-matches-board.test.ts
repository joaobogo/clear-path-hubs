/**
 * The apply endpoint and the job board ask the same question.
 *
 * A demo tenant's role was listed on /jobs and accepting real applications
 * from real candidates who would never hear back, because the board had an
 * organisation gate and the apply endpoint had none at all
 * (audit 17 Sep, item 5).
 *
 * The RULE is not duplicated — it lives in the SQL function
 * `public_publishable_position_ids`, and both callers ask it, so they cannot
 * reach different conclusions about the same role. What IS restated is the
 * small `qa_e2e` cookie bypass, because the gate lives in a server-only module
 * (`jobs.functions.ts` is in the client graph, so exporting a plain function
 * that touched `getRequestHeader` pulled a server import into the browser
 * bundle and the build rejected it).
 *
 * These tests hold the two copies of that bypass in step. If they drift, the
 * end-to-end apply suites start failing closed against their own fixture, or
 * worse, the apply path opens up where the board stays shut.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

/**
 * Source with comments removed.
 *
 * The notes explaining this fix name the very identifiers the checks below
 * forbid, so a prose mention would otherwise read as an implementation.
 */
const code = (rel: string) =>
  src(rel)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
const GATE = "src/lib/jobs/public-applyable.server.ts";
const BOARD = "src/lib/jobs.functions.ts";

describe("both gates ask the same database function", () => {
  it("neither invents its own rule", () => {
    for (const file of [GATE, BOARD]) {
      expect(src(file), `${file} must ask the SQL gate`).toContain(
        "public_publishable_position_ids",
      );
    }
  });

  it("the apply endpoint goes through the gate before writing", () => {
    // Order matters: the check has to happen before the write path is even
    // imported, or a refused application still creates a record. Read from
    // stripped source so the note explaining that does not count as code.
    const apply = code("src/lib/apply.functions.ts");
    expect(apply).toContain("isPubliclyApplyable");
    expect(apply.indexOf("isPubliclyApplyable")).toBeLessThan(
      apply.indexOf("submitApplicationImpl"),
    );
  });

  it("the gate is server-only, so it cannot reach the browser bundle", () => {
    // The `.server` suffix is what keeps `@tanstack/react-start/server` out of
    // the client graph. Renaming this file without that suffix breaks the
    // build, which is a slow way to learn it.
    expect(GATE.endsWith(".server.ts")).toBe(true);
    expect(src("src/lib/apply.functions.ts")).toContain("public-applyable.server");
  });

  it("the board does not export a plain function that touches server APIs", () => {
    // This is the mistake that broke the build: a non-handler export in a
    // client-reachable module reaching getRequestHeader.
    expect(src(BOARD)).not.toMatch(/export\s+async\s+function\s+isPubliclyApplyable/);
  });
});

describe("the QA cookie bypass stays in step", () => {
  const bypassOf = (file: string) => {
    const code = src(file);
    const start = code.indexOf("function testRecordsVisible()");
    expect(start, `${file} has no testRecordsVisible`).toBeGreaterThan(-1);
    let depth = 0;
    for (let i = code.indexOf("{", start); i < code.length; i += 1) {
      if (code[i] === "{") depth += 1;
      else if (code[i] === "}") {
        depth -= 1;
        if (depth === 0) return code.slice(start, i + 1);
      }
    }
    return "";
  };

  it("both copies read the same cookie, gate and token", () => {
    const gate = bypassOf(GATE);
    const board = bypassOf(BOARD);
    for (const token of ["qaEndpointsEnabled()", "QA_E2E_COOKIE", "QA_SEED_TOKEN", "cookie"]) {
      expect(gate, `apply gate lost ${token}`).toContain(token);
      expect(board, `board gate lost ${token}`).toContain(token);
    }
  });

  it("both fail closed when the header cannot be read", () => {
    for (const file of [GATE, BOARD]) {
      expect(bypassOf(file), `${file} must return false on a throw`).toMatch(
        /catch\s*\{\s*return false;/,
      );
    }
  });

  it("the bypass is the only thing restated — the rule itself is not", () => {
    // If the apply gate ever grows its own list of organisation flags, it can
    // disagree with the board. The flags belong in the migration.
    for (const flag of ["is_demo", "is_qa", "is_internal", "is_test_record"]) {
      expect(code(GATE), `${GATE} should not re-implement ${flag}`).not.toContain(flag);
    }
  });
});
