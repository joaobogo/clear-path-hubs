import { describe, expect, it } from "vitest";
import {
  computeCost,
  computeDropout,
  computeSpeed,
  makeWindow,
  median,
  type MatchRecord,
} from "@/lib/insights-metrics";

const NOW = new Date("2026-08-10T12:00:00.000Z").getTime();
const w30 = makeWindow(30, NOW);
const w7 = makeWindow(7, NOW);

function match(id: string, delivered: string, stage = "delivered"): MatchRecord {
  return { id, position_id: "p1", stage, delivered_at: delivered, created_at: delivered };
}

describe("median", () => {
  it("handles odd, even and empty inputs", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("computeDropout", () => {
  it("counts each candidate once per stage reached and reports the biggest drop", () => {
    const matches = [
      match("a", "2026-08-05T00:00:00Z", "hired"),
      match("b", "2026-08-05T00:00:00Z", "shortlisted"),
      match("c", "2026-08-05T00:00:00Z", "delivered"),
    ];
    const history = [
      { candidate_match_id: "a", to_stage: "shortlisted" },
      { candidate_match_id: "a", to_stage: "interview_process" },
      { candidate_match_id: "a", to_stage: "offer" },
      { candidate_match_id: "a", to_stage: "shortlisted" }, // duplicate move back
      { candidate_match_id: "b", to_stage: "shortlisted" },
    ];
    const out = computeDropout(matches, history, w30);
    expect(out.available).toBe(true);
    expect(out.total).toBe(3);
    const byKey = Object.fromEntries(out.steps.map((s) => [s.key, s.count]));
    expect(byKey).toEqual({ delivered: 3, shortlisted: 2, interview_process: 1, offer: 1, hired: 1 });
    expect(out.steps.find((s) => s.key === "shortlisted")!.dropped).toBe(1);
    expect(out.steps.find((s) => s.key === "shortlisted")!.continued_rate).toBeCloseTo(2 / 3);
    expect(out.biggest_drop).toEqual({ label: "Shortlisted", from: "Shown to you", dropped: 1 });
  });

  it("excludes records delivered outside the selected window", () => {
    const matches = [
      match("old", "2026-07-01T00:00:00Z"),
      match("recent", "2026-08-08T00:00:00Z"),
    ];
    expect(computeDropout(matches, [], w30).total).toBe(1);
    expect(computeDropout(matches, [], w7).total).toBe(1);
    expect(computeDropout([match("old", "2026-07-01T00:00:00Z")], [], w7).available).toBe(false);
  });

  it("says so plainly when no candidates were shown in the window", () => {
    const out = computeDropout([], [], w30);
    expect(out.available).toBe(false);
    expect(out.reason).toMatch(/No candidates/);
    expect(out.steps.every((s) => s.count === 0)).toBe(true);
    expect(out.biggest_drop).toBeNull();
  });

  it("never invents a rate when the previous step is empty", () => {
    const out = computeDropout([], [], w30);
    expect(out.steps.map((s) => s.continued_rate)).toEqual([null, null, null, null, null]);
  });
});

describe("computeSpeed", () => {
  const commitments = [
    { position_id: "p1", first_shortlist_days: 5, shortlist_size: 3, baseline_at: "2026-08-01T00:00:00Z" },
  ];

  it("measures actual days from role baseline, not from the window start", () => {
    const deliveries = [
      { position_id: "p1", delivered_at: "2026-08-04T00:00:00Z" },
      { position_id: "p1", delivered_at: "2026-08-06T00:00:00Z" },
      { position_id: "p1", delivered_at: "2026-08-09T00:00:00Z" },
    ];
    const out = computeSpeed(commitments, deliveries);
    expect(out.available).toBe(true);
    const first = out.rows.find((r) => r.key === "first_candidate")!;
    expect(first.promise_days).toBe(5);
    expect(first.actual_days).toBe(3);
    expect(first.variance_days).toBe(-2);
    const full = out.rows.find((r) => r.key === "full_shortlist")!;
    expect(full.actual_days).toBe(8);
    expect(full.variance_days).toBe(3);
  });

  it("omits the full-shortlist row until the shortlist size is met", () => {
    const out = computeSpeed(commitments, [{ position_id: "p1", delivered_at: "2026-08-04T00:00:00Z" }]);
    expect(out.rows.map((r) => r.key)).toEqual(["first_candidate"]);
  });

  it("reports no promise data instead of a zero", () => {
    const none = computeSpeed([], []);
    expect(none.available).toBe(false);
    expect(none.reason).toMatch(/No service commitments/);
    const pending = computeSpeed(commitments, []);
    expect(pending.available).toBe(false);
    expect(pending.rows).toHaveLength(0);
    expect(pending.reason).toMatch(/run its course/);
  });
});

describe("computeCost", () => {
  const spend = [
    { amount: 6000, currency: "EUR", category: "agency", period_start: "2026-07-20", period_end: "2026-08-05" },
    { amount: "2000", currency: "EUR", category: "ads", period_start: "2026-08-01", period_end: "2026-08-10" },
  ];
  const hires = [{ id: "h1", hired_at: "2026-08-07T00:00:00Z" }, { id: "h2", hired_at: "2026-08-09T00:00:00Z" }];

  it("divides recorded spend by confirmed hires in the window", () => {
    const out = computeCost(spend, hires, w30);
    expect(out.available).toBe(true);
    expect(out.total_spend).toBe(8000);
    expect(out.hires).toBe(2);
    expect(out.cost_per_hire).toBe(4000);
    expect(out.by_category).toEqual([
      { category: "agency", amount: 6000 },
      { category: "ads", amount: 2000 },
    ]);
  });

  it("drops spend periods and hires outside the window", () => {
    const out = computeCost(
      [{ amount: 999, currency: "EUR", category: "agency", period_start: "2026-05-01", period_end: "2026-05-31" }],
      [{ id: "old", hired_at: "2026-05-15T00:00:00Z" }],
      w30,
    );
    expect(out.entries_counted).toBe(0);
    expect(out.hires).toBe(0);
    expect(out.cost_per_hire).toBeNull();
    expect(out.available).toBe(false);
  });

  it("refuses a single figure across mixed currencies", () => {
    const out = computeCost(
      [...spend, { amount: 100, currency: "USD", category: "ads", period_start: "2026-08-01", period_end: "2026-08-09" }],
      hires,
      w30,
    );
    expect(out.available).toBe(false);
    expect(out.reason).toMatch(/more than one currency/);
  });

  it("explains a missing hire rather than showing zero cost per hire", () => {
    const out = computeCost(spend, [], w30);
    expect(out.available).toBe(false);
    expect(out.reason).toMatch(/No confirmed hire/);
  });
});
