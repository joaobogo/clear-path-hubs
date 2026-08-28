import { describe, expect, it } from "vitest";
import { resolveNoCandidatesState } from "@/lib/empty-states/empty-state-catalogue";

/**
 * Regression pin for the client Candidates empty state.
 *
 * A live production client with 8 candidates sitting between scoring and
 * publication was shown "The search finished with nobody qualified" — the
 * resolver only knew about pre-scoring states, so an entire pipeline waiting
 * on admin approval read as a failed search. The "nobody qualified" verdict
 * is the single most alarming thing this page can say; it must be unreachable
 * while anything is still in flight or awaiting release.
 */

const base = {
  activeRoles: 1,
  rolesInSetup: 0,
  discoveryStarted: true,
  inProcessing: 0,
  awaitingRelease: 0,
  runsCompleted: 8,
  runsRunning: 0,
  sourcing: null,
};

describe("resolveNoCandidatesState", () => {
  it("scored-but-unpublished candidates read as in review, never as a failed search", () => {
    const state = resolveNoCandidatesState({ ...base, awaitingRelease: 8 });
    expect(state.id).toBe("candidates.awaiting-release");
    expect(state.tone).toBe("waiting");
    expect(state.title).not.toMatch(/nobody qualified/i);
    expect(state.why).toContain("8 candidates");
  });

  it("a single awaiting candidate is phrased in the singular", () => {
    const state = resolveNoCandidatesState({ ...base, awaitingRelease: 1 });
    expect(state.why).toContain("1 candidate has");
  });

  it("the nobody-qualified verdict requires everything to be drained", () => {
    // Only when runs finished AND nothing is processing AND nothing awaits
    // release may the resolver declare the search over.
    expect(resolveNoCandidatesState(base).id).toBe("candidates.no-qualifiers");
    expect(resolveNoCandidatesState({ ...base, awaitingRelease: 1 }).id).not.toBe(
      "candidates.no-qualifiers",
    );
    expect(resolveNoCandidatesState({ ...base, inProcessing: 1 }).id).not.toBe(
      "candidates.no-qualifiers",
    );
    expect(resolveNoCandidatesState({ ...base, runsRunning: 1 }).id).not.toBe(
      "candidates.no-qualifiers",
    );
  });

  it("an unfinished scoped sourcing run also blocks the verdict", () => {
    const state = resolveNoCandidatesState({
      ...base,
      sourcing: { stageLabel: "Sourcing and review", startedAt: null, finished: false },
    });
    expect(state.id).toBe("candidates.sourcing-in-progress");
  });

  it("callers that do not pass awaitingRelease keep their old behaviour", () => {
    const { awaitingRelease: _omitted, ...legacy } = base;
    expect(resolveNoCandidatesState(legacy).id).toBe("candidates.no-qualifiers");
  });
});
