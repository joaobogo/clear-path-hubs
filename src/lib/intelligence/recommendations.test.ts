import { describe, expect, it } from "vitest";
import { deriveRecommendations, RECOMMENDATION_THRESHOLDS } from "./recommendations";

const NOW = new Date("2026-03-01T12:00:00.000Z");
const DAY = 86_400_000;
const ago = (d: number) => new Date(NOW.getTime() - d * DAY).toISOString();

const WINDOW = {
  days: 90,
  from: ago(90),
  priorFrom: ago(180),
  to: NOW.toISOString(),
};

function base(overrides: Partial<Parameters<typeof deriveRecommendations>[0]> = {}) {
  return deriveRecommendations({
    positions: [],
    matches: [],
    history: [],
    scoreRuns: [],
    evidenceItems: [],
    agentRuns: [],
    signals: { tasks: [], outreachTouches: [] },
    window: WINDOW,
    positionId: null,
    now: NOW,
    ...overrides,
  });
}

describe("deriveRecommendations", () => {
  it("returns nothing when there are no records", () => {
    expect(base()).toEqual([]);
  });

  it("stays silent on thin samples (restrictive requirements)", () => {
    const scoreRuns = Array.from({ length: RECOMMENDATION_THRESHOLDS.minScoredForCoverage - 1 }, () => ({
      must_have_coverage: 0.2,
      score: 40,
    }));
    expect(base({ scoreRuns }).some((r) => r.key === "requirement_too_restrictive")).toBe(false);
  });

  it("flags restrictive requirements once the sample clears the threshold", () => {
    const scoreRuns = Array.from({ length: 6 }, () => ({ must_have_coverage: 0.3, score: 40 }));
    const rec = base({ scoreRuns }).find((r) => r.key === "requirement_too_restrictive");
    expect(rec).toBeTruthy();
    expect(rec?.link.to).toBe("/client/positions");
    expect(rec?.evidence.length).toBeGreaterThan(0);
    expect(rec?.expectedImpact).toMatch(/may|not guaranteed/i);
  });

  it("normalises percentage-shaped coverage values", () => {
    const scoreRuns = Array.from({ length: 6 }, () => ({ must_have_coverage: 90, score: 40 }));
    expect(base({ scoreRuns }).some((r) => r.key === "requirement_too_restrictive")).toBe(false);
  });

  it("flags a narrow pool only for live roles", () => {
    const draft = base({ positions: [{ id: "p1", status: "draft" }] });
    expect(draft.some((r) => r.key === "pool_too_narrow")).toBe(false);
    const live = base({ positions: [{ id: "p1", status: "published" }] });
    expect(live.some((r) => r.key === "pool_too_narrow")).toBe(true);
  });

  it("flags a stalled stage and makes the decision queue urgent and non-dismissible", () => {
    const matches = [
      { id: "m1", position_id: "p1", stage: "delivered", updated_at: ago(20) },
      { id: "m2", position_id: "p1", stage: "delivered", updated_at: ago(9) },
    ];
    const rec = base({ matches }).find((r) => r.key === "stage_stalled");
    expect(rec?.severity).toBe("act_now");
    expect(rec?.dismissible).toBe(false);
    expect(rec?.snoozable).toBe(true);
    expect(rec?.link.to).toBe("/client");
    expect(rec?.observed).toContain("20 days");
  });

  it("does not call a stage stalled below the day threshold", () => {
    const matches = [
      { id: "m1", stage: "delivered", updated_at: ago(2) },
      { id: "m2", stage: "delivered", updated_at: ago(3) },
    ];
    expect(base({ matches }).some((r) => r.key === "stage_stalled")).toBe(false);
  });

  it("flags incomplete evidence when quoted share falls below the threshold", () => {
    const evidenceItems = [
      { source_passage: "quote" },
      {},
      {},
      {},
      { validation_need: "manual" },
      {},
    ];
    const rec = base({ evidenceItems }).find((r) => r.key === "evidence_incomplete");
    expect(rec).toBeTruthy();
    expect(rec?.link.to).toBe("/client/candidates");
  });

  it("flags an overdue queue item even below the queue-size threshold", () => {
    const rec = base({
      signals: { tasks: [{ status: "open", due_at: ago(3), blocking: false }], outreachTouches: [] },
    }).find((r) => r.key === "approval_queue_growing");
    expect(rec?.severity).toBe("act_now");
    expect(rec?.link.to).toBe("/client/approvals");
  });

  it("ignores completed queue items", () => {
    const rec = base({
      signals: { tasks: [{ status: "done", due_at: ago(9) }], outreachTouches: [] },
    });
    expect(rec.some((r) => r.key === "approval_queue_growing")).toBe(false);
  });

  it("flags a declining reply rate only with enough touches in both windows", () => {
    const mk = (dayAgo: number, replied: boolean) => ({
      direction: "outbound",
      state: "sent",
      sent_at: ago(dayAgo),
      ...(replied ? { replied_at: ago(dayAgo - 1) } : {}),
    });
    const prior = Array.from({ length: 20 }, (_, i) => mk(120, i < 8)); // 40%
    const current = Array.from({ length: 20 }, (_, i) => mk(30, i < 2)); // 10%
    const rec = base({ signals: { tasks: [], outreachTouches: [...prior, ...current] } }).find(
      (r) => r.key === "response_rate_declining",
    );
    expect(rec).toBeTruthy();
    expect(rec?.link.to).toBe("/client/outreach");

    const thin = base({
      signals: {
        tasks: [],
        outreachTouches: [...prior.slice(0, 4), ...current.slice(0, 4)],
      },
    });
    expect(thin.some((r) => r.key === "response_rate_declining")).toBe(false);
  });

  it("flags a compressed score spread but not a wide one", () => {
    const tight = Array.from({ length: 10 }, (_, i) => ({ final_score: 70 + (i % 3) }));
    expect(base({ scoreRuns: tight }).some((r) => r.key === "score_distribution_compressed")).toBe(
      true,
    );
    const wide = Array.from({ length: 10 }, (_, i) => ({ final_score: 20 + i * 7 }));
    expect(base({ scoreRuns: wide }).some((r) => r.key === "score_distribution_compressed")).toBe(
      false,
    );
  });

  it("only counts failed agent runs inside the window", () => {
    const outside = base({ agentRuns: [{ outcome: "failed", occurred_at: ago(150) }] });
    expect(outside.some((r) => r.key === "agent_runs_failing")).toBe(false);
    const inside = base({ agentRuns: [{ outcome: "failed", occurred_at: ago(5) }] });
    expect(inside.some((r) => r.key === "agent_runs_failing")).toBe(true);
  });

  it("orders act-now conditions first and produces stable scoped ids", () => {
    const recs = base({
      matches: [
        { id: "m1", stage: "delivered", updated_at: ago(20) },
        { id: "m2", stage: "delivered", updated_at: ago(19) },
      ],
      agentRuns: [{ outcome: "failed", occurred_at: ago(5) }],
      positionId: "p9",
    });
    expect(recs[0]?.severity).toBe("act_now");
    expect(recs.every((r) => r.id.includes("p9"))).toBe(true);
  });
});
