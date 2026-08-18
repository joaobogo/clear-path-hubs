import { describe, it, expect } from "vitest";
import { computeRoleProgress, formatStageDate } from "@/lib/client-role-progress";

describe("computeRoleProgress", () => {
  it("keeps draft roles on Briefed", () => {
    const p = computeRoleProgress({ status: "draft", briefedAt: "2026-03-01T00:00:00Z" });
    expect(p.currentLabel).toBe("Briefed");
    expect(p.caption).toBe("Brief in progress");
  });

  it("highlights the furthest stage with a real date", () => {
    const p = computeRoleProgress({
      status: "active",
      briefedAt: "2026-03-01T10:00:00Z",
      sourcingStartedAt: "2026-03-03T10:00:00Z",
      screeningStartedAt: "2026-03-06T10:00:00Z",
    });
    expect(p.currentLabel).toBe("Screening");
    expect(p.steps.map((s) => s.state)).toEqual([
      "done",
      "done",
      "current",
      "upcoming",
      "upcoming",
    ]);
    expect(p.steps[3].enteredAt).toBeNull();
  });

  it("shows missing earlier stage dates as unknown rather than borrowing a later one", () => {
    const p = computeRoleProgress({
      status: "active",
      briefedAt: null,
      offerStartedAt: "2026-02-10T00:00:00Z",
    });
    expect(p.currentLabel).toBe("Offer");
    expect(p.steps[0].enteredAt).toBeNull();
    expect(p.lastUpdateAt).toBe("2026-02-10T00:00:00Z");
  });

  it("flags an out-of-order date and withholds its derived duration", () => {
    const p = computeRoleProgress({
      status: "active",
      briefedAt: "2026-02-12T00:00:00Z",
      sourcingStartedAt: "2026-02-08T00:00:00Z",
    });
    expect(p.anomalies).toContain("sourcing");
    expect(p.steps[1].dateAnomaly).toBe(true);
    expect(p.steps[1].daysInStage).toBeNull();
    // The recorded date is still shown — surfaced, not silently corrected.
    expect(p.steps[1].enteredAt).toBe("2026-02-08T00:00:00Z");
  });

  it("gives each stage exactly one state", () => {
    const p = computeRoleProgress({
      status: "active",
      briefedAt: "2026-02-01T00:00:00Z",
      sourcingStartedAt: "2026-02-03T00:00:00Z",
    });
    expect(p.steps.filter((s) => s.state === "current")).toHaveLength(1);
    expect(p.steps[0].state).toBe("done");
    expect(p.steps[1].state).toBe("current");
  });


  it("freezes paused and closed roles", () => {
    expect(
      computeRoleProgress({ status: "paused", briefedAt: "2026-01-01T00:00:00Z" }).caption,
    ).toBe("Paused at briefed");
    expect(computeRoleProgress({ status: "closed" }).caption).toBe("Role closed");
    expect(computeRoleProgress({ status: "archived" }).inactive).toBe(true);
  });

  it("captions with the date the current stage was entered", () => {
    const p = computeRoleProgress(
      { status: "active", briefedAt: "2026-03-12T00:00:00Z" },
      new Date("2026-04-01T00:00:00Z"),
    );
    expect(p.caption).toBe("Briefed since 12 Mar · 20 days in stage");
    expect(p.daysInCurrentStage).toBe(20);
  });

  it("formats dates from other years with the year", () => {
    expect(formatStageDate("2025-11-04T00:00:00Z", new Date("2026-01-01T00:00:00Z"))).toBe(
      "4 Nov 2025",
    );
    expect(formatStageDate(null)).toBe("");
  });
});
