/**
 * The Offers tile and the Offer lane are one number.
 *
 * `hires.functions.ts` says this reader exists "so this strip can never
 * contradict the board underneath it, the Roles list, or the Candidates page",
 * and `client-pipeline-lane.test.ts` states the same rule from the other side:
 * "The lane count and the figure /client/offers shows must be one number."
 *
 * It was two numbers. `countOpenOffers` compared `stage === "offer"` as a
 * literal string and never called `laneFor`, so when `laneFor` started moving
 * a candidate parked in the `hired` stage with an unconfirmed offer into the
 * `offer` lane, this reader could not see them: not at stage `offer`, not a
 * confirmed hire, counted nowhere. The Roles card said "Offers 2" and linked
 * to an Offers board whose tile said 0 (audit 16 Sep, finding 2).
 *
 * These tests hold the two derivations together over identical rows.
 */
import { describe, expect, it } from "vitest";
import { selectOpenOffers } from "@/lib/kpis/candidates-in-play.server";
import { countLanes } from "@/lib/client-pipeline-lane";

type Row = {
  id: string;
  position_id: string;
  candidate_profile_id: string;
  stage: string;
  confirmed: boolean;
};

const row = (id: string, stage: string, confirmed = false): Row => ({
  id,
  position_id: "pos-1",
  candidate_profile_id: `cand-${id}`,
  stage,
  confirmed,
});

const isConfirmed = (r: Row) => r.confirmed;

/** The same rows as the lane derivation sees them. */
const asLaneRows = (rows: Row[]) =>
  rows.map((r) => ({
    stage: r.stage,
    interview_called_off: null,
    hire_confirmed: r.confirmed,
  }));

describe("open offers agree with the offer lane", () => {
  it("counts the Northwind shape the same way both derivations do", () => {
    // Three candidates at stage `hired`, one confirmed. The audit read
    // Hired 3 / Offer 0 on one surface and 1 confirmed hire on every other.
    const rows = [
      row("helena", "hired", true),
      row("tomas", "hired", false),
      row("mariana", "hired", false),
    ];
    expect(selectOpenOffers(rows, isConfirmed)).toHaveLength(2);
    expect(countLanes(asLaneRows(rows)).counts.offer).toBe(2);
  });

  it("agrees with countLanes across every stage, confirmed or not", () => {
    const rows = [
      row("a", "delivered"),
      row("b", "shortlisted"),
      row("c", "interview_process"),
      row("d", "offer"),
      row("e", "offer"),
      row("f", "hired", true),
      row("g", "hired", false),
      row("h", "not_moving_forward"),
    ];
    expect(selectOpenOffers(rows, isConfirmed).length).toBe(
      countLanes(asLaneRows(rows)).counts.offer,
    );
  });

  it("still counts a plain offer-stage candidate", () => {
    expect(selectOpenOffers([row("x", "offer")], isConfirmed).map((r) => r.id)).toEqual(["x"]);
  });

  it("never counts a confirmed hire, whatever stage the pipeline left them in", () => {
    // The undo case: the hire is confirmed on the offer record while the
    // stage was moved back. The offer record decides.
    for (const stage of ["offer", "hired"]) {
      expect(selectOpenOffers([row("y", stage, true)], isConfirmed), stage).toEqual([]);
    }
  });

  it("ignores candidates who never reached an offer", () => {
    const rows = [row("a", "delivered"), row("b", "shortlisted"), row("c", "interview_process")];
    expect(selectOpenOffers(rows, isConfirmed)).toEqual([]);
  });

  it("does not read the stage as a literal string", () => {
    // The regression guard: a `hired`-stage row with an unconfirmed offer is
    // the exact population a `stage === "offer"` comparison cannot see.
    expect(selectOpenOffers([row("z", "hired", false)], isConfirmed)).toHaveLength(1);
  });
});

describe("a hire recorded against the pair, not the match", () => {
  it("is not an open offer", () => {
    // `indexConfirmedHires` records both a match id and a position+profile
    // pair. Testing only the match id made a hire with a null
    // candidate_match_id a confirmed hire everywhere else and an open offer
    // here.
    const matchIds = new Set<string>();
    const pairs = new Set<string>(["pos-1:cand-p"]);
    const byEitherKey = (r: Row) =>
      matchIds.has(String(r.id)) || pairs.has(`${r.position_id}:${r.candidate_profile_id}`);

    expect(selectOpenOffers([row("p", "offer")], byEitherKey)).toEqual([]);
    expect(selectOpenOffers([row("q", "offer")], byEitherKey)).toHaveLength(1);
  });
});
