/**
 * A readiness check can only be as good as the columns it fetched.
 *
 * The publish desk computes `evidenceRun = approved ?? current` and then asks
 * whether that run carries evidence. The `current_run` embed did not SELECT
 * the evidence column — only `approved_run` did — so for every unapproved
 * candidate the check read undefined and reported "✗ Evidence · Blocked — 1
 * reason" against records holding plenty of it.
 *
 * Two OMNIFLOW candidates, including the second-strongest in the roster at 77,
 * sat unpublished behind a blocker that did not exist. Both went straight
 * through Approve → Publish with no override when someone finally tried
 * (audit 1 Sep, F17). "Ready to publish 0" was partly this.
 *
 * The TF7-05 fix changed WHICH run the check consults and did not notice the
 * column was never fetched for it — which is exactly the failure this guard
 * exists to catch: a consumer reading a field its own query does not select.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = readFileSync(join(process.cwd(), "src", "lib", "admin.functions.ts"), "utf8");

/** The embed strings for the publish desk's two score-run joins. */
function embedFor(alias: "current_run" | "approved_run"): string {
  const re = new RegExp(`"${alias}:score_runs![^"]*"`, "g");
  const hits = [...SOURCE.matchAll(re)].map((m) => m[0]);
  expect(hits.length, `no ${alias} embed found`).toBeGreaterThan(0);
  return hits.join(" ");
}

describe("publish desk readiness embeds", () => {
  it("fetches evidence on the run the check actually reads", () => {
    // `approved ?? current` means BOTH runs must carry the column, or the
    // check silently fails for whichever one was not fetched.
    expect(embedFor("current_run")).toContain("evidence");
    expect(embedFor("approved_run")).toContain("evidence");
  });

  it("keeps the check reading approved-then-current", () => {
    // If this fallback changes, the embeds above have to change with it.
    expect(SOURCE).toContain("const evidenceRun = approved ?? current;");
  });

  it("still requires the APPROVED run to carry evidence before publishing", () => {
    // Publishing is stricter than the readiness chip on purpose: a client sees
    // the approved run, so that is the one whose evidence must exist.
    expect(SOURCE).toContain("approvedEvidenceOk");
    expect(SOURCE).toMatch(/The approved run carries no evidence/);
  });
});
