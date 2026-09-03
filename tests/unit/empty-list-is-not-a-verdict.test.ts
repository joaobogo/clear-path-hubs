/**
 * An empty list is not a verdict about the search.
 *
 * A client whose candidate reads were being refused was shown:
 *
 *   "The search finished with nobody qualified — nobody cleared your must-have
 *    requirements. RIGHT NOW: No further searching until the requirements
 *    change."
 *
 * on a workspace holding 14 delivered candidates and a confirmed hire, while
 * the caption directly above the same panel still read "Adds up to 14
 * candidates" (audit #8, part 1b). The advice was to loosen requirements that
 * were never the problem.
 *
 * The mechanism: `hasCandidates` is derived from the candidate list query
 * itself, so it is false exactly when that query fails. Every branch after it
 * then reasons from OTHER queries — run counts, sourcing state — which had
 * loaded fine, and one of them concludes nobody qualified.
 *
 * The fix takes a delivered count from the workspace overview, a different
 * query that survives the list's failure. When the workspace is known to hold
 * candidates, none are on screen, and no filter explains it, the only honest
 * statement is that the list did not load.
 *
 * This is the fourth appearance of the same defect class in this codebase —
 * failure rendered as emptiness — and the most damaging, because it does not
 * merely hide work, it tells the client a falsehood about their pipeline and
 * recommends action on it.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveNoCandidatesState } from "@/lib/empty-states/empty-state-catalogue";

const component = readFileSync(
  join(process.cwd(), "src", "components", "client", "candidates", "candidates-empty-state.tsx"),
  "utf8",
);
const page = readFileSync(
  join(process.cwd(), "src", "routes", "_authenticated", "client.candidates.index.tsx"),
  "utf8",
);

describe("a known-non-empty workspace never gets a verdict", () => {
  it("the component takes a delivered count from a different query", () => {
    expect(component).toMatch(/workspaceDelivered\?: number/);
  });

  it("it refuses every verdict branch when that count is positive", () => {
    // Placed BEFORE resolveNoCandidatesState is consulted, or the verdict wins.
    const guard = component.indexOf("workspaceDelivered ?? 0) > 0");
    // The CALL, not the import at the top of the file.
    const verdict = component.indexOf("resolveNoCandidatesState({");
    expect(guard, "the guard is missing").toBeGreaterThan(-1);
    expect(
      guard,
      "the guard must come before the catalogue is consulted, or the verdict still renders",
    ).toBeLessThan(verdict);
  });

  it("the page feeds it from the overview, not from the list", () => {
    // Sourcing this from rowsRaw would reintroduce the bug exactly: the signal
    // would be zero precisely when the list failed.
    expect(page).toMatch(/workspaceDelivered=\{overview\?\.kpis\?\.delivered \?\? 0\}/);
    expect(page).not.toMatch(/workspaceDelivered=\{\(rowsRaw/);
  });
});

describe("the verdict itself still works when it is true", () => {
  const base = {
    activeRoles: 1,
    rolesInSetup: 0,
    discoveryStarted: true,
    inProcessing: 0,
    awaitingRelease: 0,
    runsCompleted: 12,
    runsRunning: 0,
  };

  it("still says nobody qualified when the search genuinely found nobody", () => {
    // The guard must not blunt a true verdict on an empty workspace.
    expect(resolveNoCandidatesState(base).id).toBe("candidates.no-qualifiers");
  });

  it("does not claim a finished search while runs are still going", () => {
    expect(resolveNoCandidatesState({ ...base, runsRunning: 2 }).id).not.toBe(
      "candidates.no-qualifiers",
    );
  });

  it("does not claim nobody qualified while candidates await release", () => {
    expect(resolveNoCandidatesState({ ...base, awaitingRelease: 8 }).id).not.toBe(
      "candidates.no-qualifiers",
    );
  });
});
