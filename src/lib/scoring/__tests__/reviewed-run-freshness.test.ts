/**
 * A reviewed score is not "Being re-checked" just because the engine moved on
 * (owner report, 2 Nov 2026: four published Hughes candidates whose reviewed
 * runs sit on an earlier engine's base run were labelled "Being re-checked"
 * on the client page). Recorded invalidations still mark it stale.
 */
import { describe, expect, it } from "vitest";
import { assessFreshness, mergeStoredStaleness, recheckState } from "@/lib/scoring/score-freshness";
import { isHumanReviewedRun } from "@/lib/client-kpi.server";
import { ENGINE_VERSION } from "@/lib/scoring/engine-version";

function clientFreshness(run: { engine_version: string; evaluation_method: string }, stale = false) {
  return mergeStoredStaleness(
    assessFreshness({
      scored_at: "2026-11-02T11:30:00Z",
      scored_input_hash: null,
      scored_engine_version: run.engine_version,
      scored_calibration_version: null,
      current_engine_version: run.engine_version && !isHumanReviewedRun(run) ? ENGINE_VERSION : null,
      current_calibration_version: null,
      profile_updated_at: null,
      brief_updated_at: null,
      criteria_updated_at: null,
    }),
    { score_stale: stale, score_stale_reasons: stale ? ["new_cv"] : [], score_stale_at: null, rescore_queued_at: null },
  );
}

describe("reviewed runs and engine releases", () => {
  it("a reviewed run on an older engine is current for the client", () => {
    const f = clientFreshness({ engine_version: "taasflow-scoring-v1.5.4", evaluation_method: "human_adjusted" });
    expect(f.state).toBe("current");
    expect(recheckState(f).rechecking).toBe(false);
  });
  it("an engine run on an older engine is still re-checked", () => {
    const f = clientFreshness({ engine_version: "taasflow-scoring-v1.5.4", evaluation_method: "deterministic" });
    expect(recheckState(f).rechecking).toBe(true);
  });
  it("a recorded invalidation still marks a reviewed run as re-checked", () => {
    const f = clientFreshness({ engine_version: "taasflow-scoring-v1.5.4", evaluation_method: "human_adjusted" }, true);
    expect(recheckState(f, { score_stale: true }).rechecking).toBe(true);
  });
});
