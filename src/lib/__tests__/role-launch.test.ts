import { describe, expect, it } from "vitest";
import { addBusinessDays, formatExpected } from "@/lib/role-launch";
import { computeRoleLaunchState } from "@/lib/role-launch.server";

const base = {
  position: { status: "draft", created_at: "2026-01-05T10:00:00.000Z" },
  campaigns: [],
  matchCount: 0,
  deliveredAt: null,
  applicationCount: 0,
};

describe("addBusinessDays", () => {
  it("skips weekends", () => {
    // Friday 2026-01-02 + 3 business days => Wednesday 2026-01-07
    const out = addBusinessDays(new Date("2026-01-02T00:00:00.000Z"), 3);
    expect(out?.toISOString().slice(0, 10)).toBe("2026-01-07");
  });

  it("returns null for an unparseable date instead of an Invalid Date", () => {
    expect(addBusinessDays(new Date("not-a-date"), 3)).toBeNull();
  });
});

describe("formatExpected", () => {
  it("falls back for null and for garbage input", () => {
    expect(formatExpected(null)).toMatch(/goes live/);
    expect(formatExpected("garbage")).toMatch(/goes live/);
  });
});

describe("computeRoleLaunchState", () => {
  it("never throws on a malformed published_at", () => {
    const state = computeRoleLaunchState({
      ...base,
      position: { ...base.position, status: "active", published_at: "not-a-date" },
    });
    expect(state.firstCandidatesExpected).toBeNull();
    expect(state.delayed).toBe(false);
  });

  it("keeps every stage pending until there is evidence", () => {
    const state = computeRoleLaunchState(base);
    const byKey = Object.fromEntries(state.stages.map((s) => [s.key, s.state]));
    expect(byKey.received).toBe("done");
    expect(byKey.live).toBe("pending");
    expect(byKey.candidates).toBe("pending");
    expect(state.channels.every((c) => c.state === "planned")).toBe(true);
  });

  it("marks the search live and projects a first-batch date", () => {
    const state = computeRoleLaunchState({
      ...base,
      position: {
        ...base.position,
        status: "active",
        visibility: "public",
        approved_at: "2026-01-05T10:00:00.000Z",
        published_at: "2026-01-05T10:00:00.000Z",
      },
    });
    const byKey = Object.fromEntries(state.stages.map((s) => [s.key, s.state]));
    expect(byKey.live).toBe("done");
    expect(byKey.discovery).toBe("active");
    expect(state.firstCandidatesExpected).not.toBeNull();
    expect(state.channels.find((c) => c.key === "job_board")?.state).toBe("active");
  });

  it("flags an overdue first batch that never arrived", () => {
    const state = computeRoleLaunchState({
      ...base,
      position: { ...base.position, status: "active", published_at: "2020-01-06T10:00:00.000Z" },
    });
    expect(state.delayed).toBe(true);
    expect(state.stages.find((s) => s.key === "first_expected")?.state).toBe("attention");
  });

  it("reports paused searches instead of pretending sourcing runs", () => {
    const state = computeRoleLaunchState({
      ...base,
      position: { ...base.position, status: "paused", published_at: "2026-01-05T10:00:00.000Z" },
    });
    expect(state.headline).toMatch(/paused/i);
    expect(state.stages.find((s) => s.key === "discovery")?.state).toBe("attention");
    expect(state.channels.find((c) => c.key === "talent_database")?.state).toBe("paused");
  });

  it("surfaces a failed blueprint as needing attention, not as progress", () => {
    const state = computeRoleLaunchState({
      ...base,
      position: { ...base.position, blueprint_status: "failed" },
    });
    const analyzing = state.stages.find((s) => s.key === "analyzing");
    expect(analyzing?.state).toBe("attention");
    expect(analyzing?.detail).not.toMatch(/error|exception|stack/i);
  });

  it("derives channels from real campaign rows", () => {
    const state = computeRoleLaunchState({
      ...base,
      position: { ...base.position, status: "active", published_at: "2026-01-05T10:00:00.000Z" },
      campaigns: [{ id: "c1", name: "LinkedIn sweep", channel: "linkedin", status: "active" }],
    });
    const c = state.channels.find((x) => x.key === "campaign:c1");
    expect(c?.state).toBe("active");
    expect(c?.label).toBe("LinkedIn sweep");
  });
});
