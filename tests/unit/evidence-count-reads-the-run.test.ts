/**
 * The evidence count reads the passages a client can actually see.
 *
 * "Your data advantage" told Northwind — the workspace shown to prospects —
 * that it held ZERO evidence items, while its own candidate pages quoted
 * passages against every requirement. The tile counted
 * candidate_evidence_items, a table populated by a step separate from scoring
 * that had never run for that workspace (audit 1 Sep, F22).
 *
 * Two tables answering one question, which is the defect class behind F3, F8,
 * F17 and F38. The tile now counts score_runs.evidence — the same source the
 * evidence graph, the Score tab and the client candidate card read — so the
 * number agrees with the pages a client would check it against. The items
 * table is still populated by scripts/backfill-evidence-items.mjs for the
 * surfaces that index it, but nothing user-facing depends on that step.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const src = read("src/lib/data-system.functions.ts");

/** The getDataAdvantage handler only — other functions here may index the table. */
const handler = (() => {
  const start = src.indexOf("export const getDataAdvantage");
  const end = src.indexOf("export const", start + 20);
  return src.slice(start, end === -1 ? src.length : end);
})();

describe("the data-advantage evidence count", () => {
  it("reads the runs, not the separately-populated items table", () => {
    expect(handler).toMatch(/from\("score_runs"\)/);
    expect(
      handler,
      "counting candidate_evidence_items here is what reported zero for a workspace full of evidence",
    ).not.toMatch(/from\("candidate_evidence_items"\)/);
  });

  it("names the source it actually used", () => {
    // A provenance panel that names a table the figure did not come from is
    // worse than no panel.
    expect(handler).toMatch(/sources: \["score_runs"\]/);
    expect(handler).not.toMatch(/sources: \["candidate_evidence_items"\]/);
  });

  it("discloses its scan limit like the talent-graph count does", () => {
    // A truncated total reported as a complete one is the same defect wearing
    // different clothes.
    expect(handler).toMatch(/capped_at: runRows\.length >= RUN_EVIDENCE_SCAN_LIMIT/);
  });

  it("counts passages, not runs, in the record count", () => {
    // The panel previously reported the number of rows READ ("Records: 1,000")
    // beside a tile reading 32.
    expect(handler).toMatch(/record_count: evidenceCount/);
  });

  it("keeps a backfill so the table and the runs cannot diverge silently", () => {
    const script = read("scripts/backfill-evidence-items.mjs");
    expect(script).toMatch(/candidate_evidence_items/);
    expect(script).toMatch(/score_runs/);
    // Re-runnable: a backfill that duplicates on a second pass will not be run.
    expect(script).toMatch(/upsert\(/);
    expect(script).toMatch(/--dry-run/);
  });
});
