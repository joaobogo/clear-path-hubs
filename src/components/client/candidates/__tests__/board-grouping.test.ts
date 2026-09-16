import { describe, expect, it } from "vitest";
import {
  allowedTargets,
  boardColumnKeys,
  groupRowsByStage,
  isAllowedTransition,
} from "@/components/client/candidates/board-grouping";
import { KANBAN_COLUMNS, STAGE_GRAPH } from "@/components/client/position-detail/constants";
import type { MatchStage } from "@/lib/client-match-stage";

/**
 * `interview_called_off` is required by groupRowsByStage rather than optional,
 * because the board's row mapper silently omitted it while it was optional —
 * laneFor then read undefined and bucketed by raw stage, so a cancelled
 * interview stayed in Interviewing while every other surface moved it back to
 * Shortlisted. These rows carry it explicitly for the same reason.
 */
const row = (
  id: string,
  stage: string,
  interviewCalledOff = false,
  hireConfirmed: boolean | null = true,
) => ({
  id,
  stage,
  interview_active: false,
  interview_called_off: interviewCalledOff,
  hire_confirmed: hireConfirmed,
});

describe("groupRowsByStage", () => {
  it("keeps every filtered row and never invents a column", () => {
    const rows = [
      row("a", "delivered"),
      row("b", "shortlisted"),
      row("c", "shortlisted"),
      row("d", "interview_process"),
      row("e", "offer"),
      row("f", "hired"),
      row("g", "not_moving_forward"),
    ];
    const { byStage, unplaced } = groupRowsByStage(rows);

    expect(Object.keys(byStage).sort()).toEqual(KANBAN_COLUMNS.map((c) => c.key).sort());
    expect(unplaced).toEqual([]);

    const placed = Object.values(byStage).flat();
    expect(placed).toHaveLength(rows.length);
    expect(placed.map((r) => r.id).sort()).toEqual(rows.map((r) => r.id).sort());
    // Every row sits in the bucket matching its own stage.
    for (const [stage, bucket] of Object.entries(byStage)) {
      for (const r of bucket) expect(r.stage).toBe(stage);
    }
  });

  it("preserves the incoming order inside a column (list sort is respected)", () => {
    const { byStage } = groupRowsByStage([
      row("1", "shortlisted"),
      row("2", "shortlisted"),
      row("3", "shortlisted"),
    ]);
    expect(byStage["shortlisted"]!.map((r) => r.id)).toEqual(["1", "2", "3"]);
  });

  it("puts a cancelled interview in Shortlisted, not Interviewing", () => {
    // The stage still reads interview_process after a cancellation, so the
    // board must apply laneFor rather than the raw stage. It called laneFor all
    // along, but its row mapper dropped the flag, so the call did nothing.
    const { byStage } = groupRowsByStage([row("cancelled", "interview_process", true)]);
    expect(byStage["shortlisted"]!.map((r) => r.id)).toEqual(["cancelled"]);
    expect(byStage["interview_process"]).toEqual([]);
  });

  it("puts an unconfirmed hire in Offer, not Hired", () => {
    // Same class as the cancelled interview one column along: the stage reads
    // `hired` while the offer record is still drafted or merely sent, so the
    // Hired column counted three people the Offers page counted as one
    // (audit 16 Sep, CLI-001).
    const { byStage } = groupRowsByStage([row("open-offer", "hired", false, false)]);
    expect(byStage["offer"]!.map((r) => r.id)).toEqual(["open-offer"]);
    expect(byStage["hired"]).toEqual([]);
  });

  it("reports rows with an unknown stage instead of dropping them silently", () => {
    const { byStage, unplaced } = groupRowsByStage([row("x", "sourced_but_unmapped")]);
    expect(unplaced.map((r) => r.id)).toEqual(["x"]);
    expect(Object.values(byStage).flat()).toEqual([]);
  });

  it("returns all six empty columns for an empty result set", () => {
    const { byStage } = groupRowsByStage([]);
    expect(Object.keys(byStage)).toHaveLength(6);
    expect(Object.values(byStage).every((b) => b.length === 0)).toBe(true);
  });
});

describe("transition offering", () => {
  it("offers only transitions allowed by STAGE_GRAPH", () => {
    for (const from of boardColumnKeys()) {
      const offered = allowedTargets(from);
      for (const to of offered) expect(STAGE_GRAPH[from]).toContain(to);
      for (const to of boardColumnKeys()) {
        const legal = STAGE_GRAPH[from]!.includes(to);
        expect(offered.includes(to)).toBe(legal);
      }
    }
  });

  it("never offers a target outside the board columns", () => {
    const cols = boardColumnKeys();
    for (const from of cols) {
      for (const to of allowedTargets(from)) expect(cols).toContain(to);
    }
  });

  it("rejects same-stage and forbidden moves", () => {
    expect(isAllowedTransition("shortlisted", "shortlisted")).toBe(false);
    expect(isAllowedTransition("hired", "offer")).toBe(false);
    expect(isAllowedTransition("delivered", "offer")).toBe(false);
    expect(isAllowedTransition("delivered", "hired")).toBe(false);
    expect(isAllowedTransition("offer", "shortlisted")).toBe(false);
  });

  it("accepts the canonical forward and reverse moves", () => {
    expect(isAllowedTransition("delivered", "shortlisted")).toBe(true);
    expect(isAllowedTransition("shortlisted", "interview_process")).toBe(true);
    expect(isAllowedTransition("interview_process", "offer")).toBe(true);
    expect(isAllowedTransition("interview_process", "shortlisted")).toBe(true);
    expect(isAllowedTransition("offer", "hired")).toBe(true);
    expect(isAllowedTransition("not_moving_forward", "shortlisted")).toBe(true);
  });

  it("leaves hired as a terminal column", () => {
    expect(allowedTargets("hired" as MatchStage)).toEqual([]);
  });
});
