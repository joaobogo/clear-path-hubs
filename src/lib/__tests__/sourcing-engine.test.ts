import { describe, expect, it } from "vitest";
import { computeRoleLaunchState } from "@/lib/role-launch.server";

const base = {
  position: { id: "p1", status: "draft", created_at: "2026-07-01T00:00:00Z" },
  campaigns: [],
  matchCount: 0,
  deliveredAt: null,
  applicationCount: 0,
};

describe("sourcing engine metrics", () => {
  it("reports no verified data before the role is live", () => {
    const m = computeRoleLaunchState(base).metrics!;
    expect(m.identified).toBeNull();
    expect(m.contacted).toBeNull();
    expect(m.lastUpdate).toBeNull();
    expect(m.attribution).toEqual([]);
    expect(m.nextAction).toMatch(/finalising the sourcing strategy/i);
  });

  it("counts only real outreach rows, never test records", () => {
    const m = computeRoleLaunchState({
      ...base,
      position: {
        ...base.position,
        status: "active",
        published_at: "2026-07-02T00:00:00Z",
      },
      touches: [
        {
          candidate_profile_id: "c1",
          sent_at: "2026-07-03T00:00:00Z",
          delivered_at: "2026-07-03T01:00:00Z",
          replied_at: null,
          is_test_record: false,
        },
        {
          candidate_profile_id: "c2",
          sent_at: "2026-07-04T00:00:00Z",
          replied_at: "2026-07-05T00:00:00Z",
          is_test_record: false,
        },
        {
          candidate_profile_id: "c3",
          sent_at: "2026-07-06T00:00:00Z",
          is_test_record: true,
        },
      ],
      applicationCount: 2,
      matchCount: 1,
      attribution: [{ label: "job_board", count: 2 }],
    }).metrics!;

    expect(m.identified).toBe(2);
    expect(m.contacted).toBe(2);
    expect(m.replied).toBe(1);
    expect(m.applicants).toBe(2);
    expect(m.qualified).toBe(1);
    expect(m.lastUpdate).toBe("2026-07-05T00:00:00Z");
    expect(m.attribution).toEqual([{ label: "job_board", count: 2 }]);
  });

  it("uses honest paused and closed next actions", () => {
    const paused = computeRoleLaunchState({
      ...base,
      position: { ...base.position, status: "paused" },
    }).metrics!;
    expect(paused.nextAction).toMatch(/paused/i);

    const closed = computeRoleLaunchState({
      ...base,
      position: { ...base.position, status: "closed" },
    }).metrics!;
    expect(closed.nextAction).toMatch(/closed/i);
  });

  it("never exposes recruiter-agency language in stage copy", () => {
    const state = computeRoleLaunchState({
      ...base,
      position: { ...base.position, status: "active", published_at: "2026-07-02T00:00:00Z" },
    });
    const text = JSON.stringify(state).toLowerCase();
    expect(text).not.toContain("your recruiter");
    expect(text).not.toContain("specialist is doing it");
  });
});
