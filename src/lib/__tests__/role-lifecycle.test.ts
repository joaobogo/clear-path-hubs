import { describe, expect, it } from "vitest";
import {
  computeRoleLifecycle,
  LIFECYCLE_STAGES,
  type LifecycleSignals,
} from "@/lib/role-lifecycle/role-lifecycle";

const base: LifecycleSignals = {
  positionId: "00000000-0000-0000-0000-000000000001",
  title: "Head of Rooms",
  status: "draft",
  statusLabel: "Draft",
  createdAt: "2026-07-01T10:00:00.000Z",
};

const byKey = (s: LifecycleSignals) => {
  const lc = computeRoleLifecycle(s, new Date("2026-08-04T10:00:00.000Z"));
  return Object.fromEntries(lc.stages.map((st) => [st.key, st]));
};

describe("computeRoleLifecycle", () => {
  it("always returns the nine canonical stages in order", () => {
    const lc = computeRoleLifecycle(base);
    expect(lc.stages.map((s) => s.key)).toEqual([...LIFECYCLE_STAGES]);
  });

  it("never invents progress when there is no data", () => {
    const stages = byKey(base);
    expect(stages.intake!.state).toBe("active");
    for (const key of ["discovery", "evidence", "scoring", "review", "interview", "decision", "hire"]) {
      expect(stages[key]!.state).toBe("not_started");
    }
  });

  it("blocks intake when clarification is outstanding", () => {
    const stages = byKey({
      ...base,
      status: "needs_clarification",
      clarificationRequestedAt: "2026-07-02T10:00:00.000Z",
    });
    expect(stages.intake!.state).toBe("blocked");
    expect(stages.intake!.blockers.length).toBe(1);
  });

  it("marks blueprint as waiting on client sign-off", () => {
    const lc = computeRoleLifecycle({
      ...base,
      status: "approved",
      statusLabel: "Active search",
      submittedAt: "2026-07-02T10:00:00.000Z",
      approvedAt: "2026-07-03T10:00:00.000Z",
      blueprintStatus: "ready",
      blueprintGeneratedAt: "2026-07-03T12:00:00.000Z",
    });
    const bp = lc.stages.find((s) => s.key === "blueprint")!;
    expect(bp.state).toBe("waiting");
    expect(bp.pendingApprovals).toHaveLength(1);
    expect(lc.attentionCount).toBe(1);
  });

  it("reports a failed blueprint honestly", () => {
    const stages = byKey({ ...base, blueprintStatus: "failed", approvedAt: "2026-07-03T10:00:00.000Z" });
    expect(stages.blueprint!.state).toBe("failed");
  });

  it("flags review as waiting when candidates await a decision", () => {
    const lc = computeRoleLifecycle({
      ...base,
      status: "active",
      statusLabel: "Active search",
      approvedAt: "2026-07-03T10:00:00.000Z",
      blueprintConfirmedAt: "2026-07-04T10:00:00.000Z",
      publishedAt: "2026-07-05T10:00:00.000Z",
      candidateCount: 4,
      firstCandidateAt: "2026-07-06T10:00:00.000Z",
      assessedCount: 4,
      firstAssessmentAt: "2026-07-07T10:00:00.000Z",
      awaitingReview: 2,
      firstDeliveredAt: "2026-07-08T10:00:00.000Z",
    });
    const review = lc.stages.find((s) => s.key === "review")!;
    expect(review.state).toBe("waiting");
    expect(review.pendingApprovals[0]).toContain("2 candidates");
    expect(lc.stages[lc.currentIndex]!.key).toBe("review");
  });

  it("completes the hire stage only when every opening is filled", () => {
    const partial = byKey({
      ...base,
      status: "active",
      openings: 2,
      hires: 1,
      offerCount: 0,
      firstHireAt: "2026-08-01T10:00:00.000Z",
    });
    expect(partial.hire!.state).toBe("active");

    const done = byKey({
      ...base,
      status: "filled",
      openings: 1,
      hires: 1,
      firstHireAt: "2026-08-01T10:00:00.000Z",
    });
    expect(done.hire!.state).toBe("completed");
  });

  it("marks earlier untouched stages as skipped once later work exists", () => {
    const stages = byKey({
      ...base,
      status: "active",
      approvedAt: "2026-07-03T10:00:00.000Z",
      candidateCount: 1,
      firstCandidateAt: "2026-07-06T10:00:00.000Z",
      assessedCount: 1,
      firstAssessmentAt: "2026-07-07T10:00:00.000Z",
    });
    expect(stages.blueprint!.state).toBe("skipped");
  });

  it("freezes the caption for paused roles", () => {
    const lc = computeRoleLifecycle({ ...base, status: "paused", statusLabel: "Paused" });
    expect(lc.caption).toContain("Paused");
    expect(lc.inactive).toBe(true);
  });
});
