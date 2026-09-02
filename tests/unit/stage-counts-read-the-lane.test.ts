/**
 * A cancelled interview is counted the same way everywhere.
 *
 * `laneFor` holds one rule the raw stage cannot express: a candidate whose only
 * interview was called off is back where they were before it was arranged —
 * shortlisted. The stage column still reads `interview_process`, because a
 * cancellation does not move the stage.
 *
 * `computeCandidateKpis` switched on `row.stage` directly, so /client/candidates
 * counted that person as interviewing while the role page, the board column and
 * the candidate's own row label — all of which go through `laneFor` — read
 * shortlisted. On the launch test pass (2 Sep) that surfaced as SHORTLISTED 4 on
 * /client/positions against 3 on /client/candidates, with INTERVIEWING reading 2
 * when one person was interviewing. Client-facing, on two pages, from one row.
 *
 * The behavioural tests below pin the rule. The source check stops the next
 * counter being written against `row.stage` again — which is how this one got
 * here, since laneFor's own docstring already described the bug.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeCandidateKpis } from "@/lib/client/candidate-kpi";
import { laneFor } from "@/lib/client-pipeline-lane";

/** Minimal row: only the fields the counter and laneFor actually read. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const row = (over: Record<string, unknown> = {}): any => ({
  stage: "delivered",
  client_decided: false,
  hire_confirmed: false,
  interview_active: false,
  interview_called_off: false,
  fit: { band: "consider" },
  ...over,
});

const CALLED_OFF = row({
  stage: "interview_process",
  interview_called_off: true,
  interview_active: false,
});

describe("a called-off interview counts as shortlisted", () => {
  it("is shortlisted, not interviewing", () => {
    const k = computeCandidateKpis([CALLED_OFF]);
    expect(k.shortlisted, "the tile said interviewing while every other surface said shortlisted").toBe(1);
    expect(k.interviewing).toBe(0);
  });

  it("agrees with laneFor, which is where the rule lives", () => {
    expect(laneFor(CALLED_OFF)).toBe("shortlisted");
  });

  it("reproduces the launch-pass tally exactly", () => {
    // The 14 Northwind rows as observed: 5 awaiting, 3 stored shortlisted,
    // 1 interviewing, 1 interview cancelled, 2 offer, 1 hired, 1 closed.
    const rows = [
      ...Array.from({ length: 5 }, () => row({ stage: "delivered" })),
      ...Array.from({ length: 3 }, () => row({ stage: "shortlisted" })),
      row({ stage: "interview_process", interview_active: true }),
      CALLED_OFF,
      ...Array.from({ length: 2 }, () => row({ stage: "offer" })),
      row({ stage: "hired", hire_confirmed: true }),
      row({ stage: "not_moving_forward" }),
    ];
    const k = computeCandidateKpis(rows);
    expect(k.delivered).toBe(14);
    // 3 stored shortlisted + the cancelled one = 4, matching /client/positions.
    expect(k.shortlisted).toBe(4);
    expect(k.interviewing).toBe(1);
    expect(k.offers).toBe(2);
    // The partition must still sum to the list beneath the tiles.
    const p = k.stage_partition;
    expect(p.awaiting + p.shortlisted + p.interviewing + p.offer + p.hired + p.closed + p.elsewhere).toBe(14);
  });

  it("leaves a COMPLETED interview in the interview lane", () => {
    // Only a cancellation moves the lane back. Held interviews stay put.
    const held = row({ stage: "interview_process", interview_active: true, interview_called_off: false });
    expect(computeCandidateKpis([held]).interviewing).toBe(1);
    expect(computeCandidateKpis([held]).shortlisted).toBe(0);
  });
});

describe("the counter reads the lane, not the stage", () => {
  it("does not switch on row.stage", () => {
    const src = readFileSync(
      join(process.cwd(), "src", "lib", "client", "candidate-kpi.ts"),
      "utf8",
    );
    expect(src, "the counter must go through laneFor").toMatch(/switch \(laneFor\(row\)\)/);
    expect(
      src,
      "switching on the raw stage is what made two surfaces disagree",
    ).not.toMatch(/switch \(row\.stage\)/);
  });
});
