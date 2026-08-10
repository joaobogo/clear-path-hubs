/**
 * The calibration desk answers "what actually happened to the candidates we
 * scored". These tests pin the funnel arithmetic — approvals, interviews held,
 * offers, hires, declines and awaiting-decision — and the rule that test
 * organisations are excluded from every figure on the desk.
 *
 * Live data currently has no client decisions or hires, so the funnel is
 * exercised here against fixture rows rather than the production tables.
 */
import { describe, expect, it, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const excludeCalls: Array<{ includeTest: boolean }> = [];

vi.mock("@/lib/admin-test-scope.server", () => ({
  loadTestScope: async (_s: Any, includeTest: boolean) => ({
    includeTest,
    orgIds: includeTest ? [] : ["org-test"],
    positionIds: [],
  }),
  excludeTestOrgs: (q: Any, scope: Any) => {
    excludeCalls.push({ includeTest: scope.includeTest });
    return scope.includeTest ? q : q.__excludeOrgs(scope.orgIds);
  },
}));

const { loadCalibrationDesk } = await import("../calibration-desk.server");

type Fixture = {
  runs: Array<{ candidate_match_id: string; final_score: number; organization_id: string; completed_at: string }>;
  matches: Array<{ id: string; stage: string | null; position_id: string | null }>;
  decisions: Array<{ candidate_match_id: string; decision: string; reason_code?: string | null; created_at: string }>;
  hires: Array<{ candidate_match_id: string; status: string }>;
  interviews: Array<{ candidate_match_id: string; status: string }>;
};

function fakeAdmin(fx: Fixture) {
  const state = { excludedOrgs: [] as string[] };

  const runsChain = () => {
    const chain: Any = {
      eq: () => chain,
      not: () => chain,
      or: () => chain,
      order: () => chain,
      limit: () => chain,
      __excludeOrgs: (ids: string[]) => {
        state.excludedOrgs = ids;
        return chain;
      },
      then: (resolve: (v: Any) => Any) => {
        const rows = fx.runs.filter((r) => !state.excludedOrgs.includes(r.organization_id));
        return Promise.resolve(resolve({ data: rows, error: null }));
      },
    };
    return chain;
  };

  const listChain = (rows: Any[]) => {
    const chain: Any = {
      in: () => chain,
      eq: () => chain,
      is: () => chain,
      order: () => chain,
      then: (resolve: (v: Any) => Any) => Promise.resolve(resolve({ data: rows, error: null })),
    };
    return chain;
  };

  return {
    from: (table: string) => {
      if (table === "score_runs") return { select: () => runsChain() };
      if (table === "candidate_matches") return { select: () => listChain(fx.matches) };
      if (table === "client_decisions") return { select: () => listChain(fx.decisions) };
      if (table === "hire_records") return { select: () => listChain(fx.hires) };
      if (table === "interviews")
        return { select: () => listChain(fx.interviews.filter((i) => i.status === "completed")) };
      if (table === "v_position_time_to_submission")
        return {
          select: () =>
            listChain([{ position_id: "pos-1", position_title: "Support Lead", role_family: "support" }]),
        };
      return { select: () => listChain([]) };
    },
  };
}

const run = (id: string, score: number, org = "org-real") => ({
  candidate_match_id: id,
  final_score: score,
  organization_id: org,
  completed_at: "2026-08-01T00:00:00Z",
});

const fixture: Fixture = {
  runs: [
    run("m-hired", 91),
    run("m-offer", 84),
    run("m-interviewed", 77),
    run("m-shortlisted", 71),
    run("m-declined", 44),
    run("m-waiting", 58),
    run("m-test", 95, "org-test"),
  ],
  matches: [
    { id: "m-hired", stage: "hired", position_id: "pos-1" },
    { id: "m-offer", stage: "offer", position_id: "pos-1" },
    { id: "m-interviewed", stage: "interview_process", position_id: "pos-1" },
    { id: "m-shortlisted", stage: "shortlisted", position_id: "pos-1" },
    { id: "m-declined", stage: "not_moving_forward", position_id: "pos-1" },
    { id: "m-waiting", stage: "new", position_id: "pos-1" },
    { id: "m-test", stage: "hired", position_id: "pos-1" },
  ],
  decisions: [
    { candidate_match_id: "m-hired", decision: "hire", created_at: "2026-08-05T00:00:00Z" },
    { candidate_match_id: "m-offer", decision: "offer", created_at: "2026-08-04T00:00:00Z" },
    { candidate_match_id: "m-interviewed", decision: "request_interview", created_at: "2026-08-03T00:00:00Z" },
    { candidate_match_id: "m-shortlisted", decision: "shortlist", created_at: "2026-08-02T00:00:00Z" },
    {
      candidate_match_id: "m-declined",
      decision: "not_moving_forward",
      reason_code: "skills_gap",
      created_at: "2026-08-02T00:00:00Z",
    },
  ],
  hires: [
    { candidate_match_id: "m-hired", status: "hire_confirmed" },
    { candidate_match_id: "m-offer", status: "offer_sent" },
  ],
  interviews: [
    { candidate_match_id: "m-hired", status: "completed" },
    { candidate_match_id: "m-interviewed", status: "completed" },
    // Requested but never held: must NOT count as an interview.
    { candidate_match_id: "m-shortlisted", status: "scheduled" },
  ],
};

describe("calibration desk outcome funnel", () => {
  it("counts every outcome stage, excluding test organisations by default", async () => {
    const desk = await loadCalibrationDesk(fakeAdmin(fixture) as never, {});

    expect(desk.funnel).toEqual({
      scored: 6, // the org-test candidate is not counted
      approved: 4,
      interviews_held: 2,
      offered: 2,
      hired: 1,
      declined: 1,
      awaiting_decision: 1,
    });
    expect(desk.total_scored).toBe(6);
    expect(excludeCalls.at(-1)).toEqual({ includeTest: false });
  });

  it("counts only interviews that actually took place", async () => {
    const desk = await loadCalibrationDesk(fakeAdmin(fixture) as never, {});
    // m-shortlisted has a scheduled interview but no completed one.
    expect(desk.funnel.interviews_held).toBe(2);
    expect(desk.funnel.interviews_held).toBeLessThan(desk.funnel.approved);
  });

  it("reports structured decline reasons", async () => {
    const desk = await loadCalibrationDesk(fakeAdmin(fixture) as never, {});
    expect(desk.decline_reasons[0]).toMatchObject({ code: "skills_gap", count: 1, share: 1 });
  });

  it("includes test organisations only when explicitly asked", async () => {
    const desk = await loadCalibrationDesk(fakeAdmin(fixture) as never, { includeTest: true });
    expect(desk.funnel.scored).toBe(7);
    expect(desk.funnel.hired).toBe(2);
  });

  it("returns an empty desk rather than throwing when nothing is scored", async () => {
    const desk = await loadCalibrationDesk(
      fakeAdmin({ ...fixture, runs: [] }) as never,
      {},
    );
    expect(desk.funnel.scored).toBe(0);
    expect(desk.decline_reasons).toEqual([]);
  });
});
