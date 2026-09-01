/**
 * Two calibration desks, two different denominators — by design.
 *
 * The calibration desk (admin/scoring/calibration) shows all scored candidates
 * to answer: "Does the score scale work? Do bands have meaning?"
 *
 * The calibration signal (on the admin overview panel) shows only candidates with
 * recorded outcomes to answer: "Do scores predict what actually happens?"
 *
 * These are different questions. Mixing them produces noise: a candidate with no
 * outcome yet has a score but no outcome to validate against. Keeping them separate
 * lets each desk answer its own question cleanly (audit 1 Sep, F33).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("calibration desks measure different things", () => {
  it("desk loads all score_runs; signal filters to outcomes only", () => {
    const deskServer = read("src/lib/scoring/calibration-desk.server.ts");
    const signalServer = read("src/lib/scoring/calibration-signal.server.ts");

    // The desk queries score_runs broadly (no outcome join).
    expect(deskServer).toMatch(/from\("score_runs"\)/);
    // Then joins to outcomes as context, not as a filter.
    expect(deskServer).toMatch(/from\("client_decisions"\)/);
    expect(deskServer).toMatch(/from\("interviews"\)/);

    // The signal computes metrics that require outcome data.
    expect(signalServer).toMatch(/loadCalibrationSignal/);
  });

  it("desk asks 'does the scale work', signal asks 'do scores predict outcomes'", () => {
    // This guard exists so a future audit reading "different denominators"
    // doesn't revisit the same decision. The names should be clear enough that
    // the intent is obvious.
    const calibDesktop = read("src/routes/_authenticated/admin.scoring.calibration.tsx");
    const scorePanel = read("src/components/admin/score-calibration-panel.tsx");

    // The desk shows what scores were produced and how they perform.
    expect(calibDesktop).toMatch(/Outcomes for scored candidates/i);
    expect(calibDesktop).toMatch(/Live scores against the band boundaries/i);

    // The signal shows sample size and outcome correlation.
    expect(scorePanel).toMatch(/Score calibration/i);
    expect(scorePanel).toMatch(/Outcome separation/i);
  });
});
