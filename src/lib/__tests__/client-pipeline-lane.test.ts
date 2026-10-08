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

/**
 * `hire_confirmed` defaults to true so that every pre-existing assertion below
 * still describes a genuine hire. The rows that exercise the new rule pass it
 * explicitly.
 */
const row = (
  stage: string,
  interview_active = false,
  interview_called_off = false,
  hire_confirmed: boolean | null = true,
) => ({
  stage,
  interview_active,
  interview_called_off,
  hire_confirmed,
});

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

describe("historical interview cancellations never override a Kanban move", () => {
  // The rule "the stored stage decides the lane" is right for ENTERING an
  // interview and wrong for leaving one. A cancellation does not move the
  // stage, so the INTERVIEWING tile counted 2 while only one candidate was
  // interviewing and the row label beside it read "Interview cancelled"
  // (audit 1 Sep, F6).
  it("keeps a manually advanced candidate in Interviewing after an old cancellation", () => {
    expect(laneFor(row("interview_process", false, true))).toBe("interview_process");
  });

  it("keeps a candidate whose interview was HELD in the interview lane", () => {
    // interview_called_off is false for a completed interview: that candidate
    // is still interviewing, awaiting feedback or a decision.
    expect(laneFor(row("interview_process", false, false))).toBe("interview_process");
  });

  it("keeps a candidate with a live interview in the interview lane", () => {
    expect(laneFor(row("interview_process", true, true))).toBe("interview_process");
  });

  it("does not move a cancellation out of any other stage", () => {
    expect(laneFor(row("offer", false, true))).toBe("offer");
    expect(laneFor(row("hired", false, true))).toBe("hired");
  });

  it("keeps the tile and the lane count in agreement", () => {
    const rows = [row("interview_process", true), row("interview_process", false, true)];
    expect(countLanes(rows).counts.interview_process).toBe(2);
    expect(countLanes(rows).counts.shortlisted).toBe(0);
  });
});

describe("the offer record decides a hire, never the stage", () => {
  // /client/candidates reported HIRED 3 while /client/positions,
  // /client/executive and /client/offers all reported 1: two of the three had
  // offers that were merely drafted or sent, and the lane derivation was the
  // one counting layer that never read the offer record (audit 16 Sep,
  // CLI-001).
  it("keeps a candidate with an unconfirmed offer out of the hired lane", () => {
    expect(laneFor(row("hired", false, false, false))).toBe("offer");
  });

  it("leaves a confirmed hire in the hired lane", () => {
    expect(laneFor(row("hired", false, false, true))).toBe("hired");
  });

  it("does not un-hire anyone when the offer record could not be read", () => {
    // `null` is "we do not know", and a failed read must not silently reduce a
    // client's hire count.
    expect(laneFor(row("hired", false, false, null))).toBe("hired");
  });

  it("touches no other stage", () => {
    for (const stage of [
      "delivered",
      "shortlisted",
      "interview_process",
      "offer",
      "not_moving_forward",
    ]) {
      expect(laneFor(row(stage, false, false, false)), stage).toBe(stage);
    }
  });

  it("still places everyone exactly once — the partition holds", () => {
    const rows = [
      row("hired", false, false, true),
      row("hired", false, false, false),
      row("hired", false, false, false),
    ];
    const { counts, unplaced, excluded } = countLanes(rows);
    expect(unplaced).toEqual([]);
    expect(excluded).toEqual([]);
    expect(counts.hired).toBe(1);
    expect(counts.offer).toBe(2);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(rows.length);
  });

  it("agrees with the confirmed-hire count the other client surfaces read", () => {
    // The exact Northwind shape: three in the hired stage, one confirmed offer.
    // The lane count and the figure /client/offers shows must be one number.
    const rows = [
      row("hired", false, false, true),
      row("hired", false, false, false),
      row("hired", false, false, false),
    ];
    const confirmedHires = rows.filter((r) => r.hire_confirmed).length;
    expect(countLanes(rows).counts.hired).toBe(confirmedHires);
  });
});
