/**
 * Every candidate is counted somewhere, or excluded on purpose.
 *
 * countLanes is the one derivation behind the Overview KPI tiles, the board
 * columns, the Roles roll-ups and the Offers page. It returned an `unplaced`
 * array for rows whose stage matched no lane, and its own docstring promised
 * "callers surface unknown rows rather than dropping them silently" — but
 * every caller destructured `{ counts }` alone. loadKpiRows selects on
 * client_visibility only, so a visible candidate at a laneless stage really
 * did reach this function and really did vanish from every count.
 *
 * The module had no tests at all.
 */
import { describe, expect, it } from "vitest";
import {
  PIPELINE_LANES,
  STAGES_WITHOUT_LANE,
  countLanes,
  laneFor,
  rowsInLane,
} from "@/lib/client-pipeline-lane";
import { PIPELINE_STAGE_VOCABULARY } from "@/lib/vocabulary";

const row = (stage: string, interview_active = false) => ({ stage, interview_active });

describe("lane coverage", () => {
  it("accounts for every stage in the vocabulary", () => {
    // The invariant that matters: a stage added to the pipeline cannot quietly
    // stop being counted. It is either a lane or an explicit exclusion.
    const unaccounted = Object.keys(PIPELINE_STAGE_VOCABULARY).filter(
      (stage) =>
        !(PIPELINE_LANES as readonly string[]).includes(stage) &&
        !(STAGES_WITHOUT_LANE as readonly string[]).includes(stage),
    );
    expect(unaccounted).toEqual([]);
  });

  it("never lists a stage as both a lane and an exclusion", () => {
    const both = (STAGES_WITHOUT_LANE as readonly string[]).filter((s) =>
      (PIPELINE_LANES as readonly string[]).includes(s),
    );
    expect(both).toEqual([]);
  });

  it("only names stages that exist", () => {
    for (const stage of [...PIPELINE_LANES, ...STAGES_WITHOUT_LANE]) {
      expect(PIPELINE_STAGE_VOCABULARY, `"${stage}" is not a pipeline stage`).toHaveProperty(stage);
    }
  });
});

describe("countLanes", () => {
  it("places every row in exactly one lane", () => {
    const rows = PIPELINE_LANES.map((l) => row(l));
    const { counts, unplaced, excluded } = countLanes(rows);

    expect(unplaced).toEqual([]);
    expect(excluded).toEqual([]);
    for (const lane of PIPELINE_LANES) expect(counts[lane]).toBe(1);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(rows.length);
  });

  it("reports a deliberately excluded stage as excluded, not unknown", () => {
    // A withdrawn candidate is not work in any lane, but "not counted on
    // purpose" and "we do not recognise this stage" are different facts and
    // were reported identically.
    const { unplaced, excluded } = countLanes([row("withdrawn"), row("on_hold")]);
    expect(unplaced).toEqual([]);
    expect(excluded.map((r) => r.stage)).toEqual(["withdrawn", "on_hold"]);
  });

  it("reports a genuinely unknown stage as unplaced", () => {
    const { unplaced, excluded } = countLanes([row("teleported")]);
    expect(excluded).toEqual([]);
    expect(unplaced.map((r) => r.stage)).toEqual(["teleported"]);
  });

  it("loses nobody: lanes plus excluded plus unplaced is the whole list", () => {
    const rows = [
      row("delivered"),
      row("shortlisted"),
      row("withdrawn"),
      row("teleported"),
      row("hired"),
    ];
    const { counts, unplaced, excluded } = countLanes(rows);
    const inLanes = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(inLanes + excluded.length + unplaced.length).toBe(rows.length);
  });
});

describe("an interview is a milestone, not a lane move", () => {
  it("keeps a shortlisted candidate with a live interview in shortlisted", () => {
    // The disagreement this module was built to end: the tiles counted an
    // active interview as "interviewing" while the board kept the same person
    // in Shortlisted, so one said 4 and the other 2 for identical data.
    expect(laneFor(row("shortlisted", true))).toBe("shortlisted");
    expect(laneFor(row("delivered", true))).toBe("delivered");
  });

  it("agrees with rowsInLane for the same rows", () => {
    const rows = [row("shortlisted", true), row("shortlisted"), row("interview_process")];
    const { counts } = countLanes(rows);
    for (const lane of PIPELINE_LANES) {
      expect(rowsInLane(rows, lane).length, `${lane} disagreed`).toBe(counts[lane]);
    }
  });
});
