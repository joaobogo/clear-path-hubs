import { describe, expect, it } from "vitest";
import { computeCalibrationDesk, type DeskRow } from "./calibration-desk";

function row(overrides: Partial<DeskRow> & { final_score: number }): DeskRow {
  return {
    match_id: Math.random().toString(36).slice(2),
    position_id: "p1",
    position_title: "Front Desk Manager",
    role_family: "hospitality_operations",
    approved: false,
    interview_held: false,
    offered: false,
    hired: false,
    declined: false,
    decline_reason_code: null,
    ...overrides,
  };
}

describe("computeCalibrationDesk", () => {
  it("reports nothing to calibrate with no rows", () => {
    const desk = computeCalibrationDesk([]);
    expect(desk.total_scored).toBe(0);
    expect(desk.range.observed_min).toBeNull();
    expect(desk.range.compressed).toBe(false);
    expect(desk.band_performance.every((b) => b.never_produced)).toBe(true);
  });

  it("flags a compressed live range and unreachable bands", () => {
    const desk = computeCalibrationDesk([40, 48, 52, 57, 57].map((s) => row({ final_score: s })));
    expect(desk.range.observed_min).toBe(40);
    expect(desk.range.observed_max).toBe(57);
    expect(desk.range.compressed).toBe(true);
    expect(desk.range.unreachable_bands.length).toBeGreaterThan(0);
  });

  it("marks a band that is produced but never converts", () => {
    const desk = computeCalibrationDesk(
      [52, 54, 56].map((s) => row({ final_score: s, declined: true, decline_reason_code: "missing_critical" })),
    );
    const consider = desk.band_performance.find((b) => b.band === "consider");
    expect(consider?.produced_count).toBe(3);
    expect(consider?.never_converts).toBe(true);
    expect(desk.decline_reasons[0]?.code).toBe("missing_critical");
    expect(desk.decline_reasons[0]?.share).toBe(1);
  });

  it("counts the outcome funnel without double-counting stages", () => {
    const desk = computeCalibrationDesk([
      row({ final_score: 80, approved: true, interview_held: true, offered: true, hired: true }),
      row({ final_score: 60, approved: true, interview_held: true }),
      row({ final_score: 45, declined: true, decline_reason_code: "too_junior" }),
      row({ final_score: 50 }),
    ]);
    expect(desk.funnel).toMatchObject({
      scored: 4,
      approved: 2,
      interviews_held: 2,
      offered: 1,
      hired: 1,
      declined: 1,
      awaiting_decision: 1,
    });
  });

  it("hides segments below the minimum sample and reports drift for the rest", () => {
    const rows = [
      ...[40, 42, 44].map((s) => row({ final_score: s, position_id: "low", position_title: "Low role" })),
      ...[70, 72, 74].map((s) => row({ final_score: s, position_id: "high", position_title: "High role" })),
      row({ final_score: 90, position_id: "tiny", position_title: "Tiny role" }),
    ];
    const desk = computeCalibrationDesk(rows);
    expect(desk.hidden_positions).toBe(1);
    expect(desk.by_position.map((p) => p.key).sort()).toEqual(["high", "low"]);
    const low = desk.by_position.find((p) => p.key === "low");
    expect(low?.drift).toBeLessThan(0);
  });
});
