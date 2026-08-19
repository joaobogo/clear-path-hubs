import { describe, expect, it } from "vitest";
import { computeHiringHealth } from "@/lib/client-hiring-health";

const base = {
  openRoles: 3,
  awaitingDecision: 2,
  rolesWithoutShortlist: 1,
  overdueDecisions: 0,
  behindScheduleRoles: 0,
  blocks: 0,
};

describe("computeHiringHealth", () => {
  it("says hiring is on track when nothing needs the client", () => {
    const h = computeHiringHealth({ ...base, awaitingDecision: 0 });
    expect(h.sentence).toBe("Hiring is on track.");
    expect(h.reason).toBe("on_track");
    expect(h.tone).toBe("on_track");
  });

  it("reports routine review ahead of the on-track sentence", () => {
    const h = computeHiringHealth(base);
    expect(h.sentence).toBe("Two candidates need review.");
  });

  it("puts blocks and overdue decisions ahead of behind-schedule roles", () => {
    const h = computeHiringHealth({ ...base, overdueDecisions: 2, behindScheduleRoles: 1 });
    expect(h.sentence).toBe("Two things need you.");
    expect(h.reason).toBe("overdue_decisions");
  });

  it("groups blocks and overdue decisions into 'things need you'", () => {
    const h = computeHiringHealth({ ...base, overdueDecisions: 1, blocks: 2 });
    expect(h.sentence).toBe("Three things need you.");
    expect(h.reason).toBe("blocks");
  });

  it("reports behind-schedule roles when no decision is overdue or blocked", () => {
    const h = computeHiringHealth({ ...base, behindScheduleRoles: 1 });
    expect(h.sentence).toBe("One role is behind schedule.");
    expect(h.reason).toBe("behind_schedule");
  });

  it("uses singular wording for one thing needing attention", () => {
    expect(computeHiringHealth({ ...base, overdueDecisions: 1 }).sentence).toBe(
      "One thing needs you.",
    );
  });

  it("always returns the same three figures, in order", () => {
    const h = computeHiringHealth(base);
    expect(h.figures.map((f) => f.key)).toEqual([
      "open_roles",
      "awaiting_decision",
      "roles_without_shortlist",
    ]);
    expect(h.figures.map((f) => f.value)).toEqual([3, 2, 1]);
    expect(h.figures[2]!.label).toBe("role with no shortlist yet");
  });

  it("pluralises role figures", () => {
    const h = computeHiringHealth({ ...base, openRoles: 1, rolesWithoutShortlist: 2 });
    expect(h.figures[0]!.label).toBe("open role");
    expect(h.figures[2]!.label).toBe("roles with no shortlist yet");
  });
});
