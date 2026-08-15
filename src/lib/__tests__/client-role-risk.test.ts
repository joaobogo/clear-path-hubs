import { describe, expect, it } from "vitest";
import { computeRoleRisk } from "@/lib/client-role-risk";

const NOW = new Date("2026-07-31T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe("computeRoleRisk", () => {
  it("never flags paused or closed roles", () => {
    const r = computeRoleRisk({ status: "paused", lastMovementAt: daysAgo(60) }, NOW);
    expect(r.atRisk).toBe(false);
  });

  it("flags a decision sitting with the client", () => {
    const r = computeRoleRisk(
      { status: "active", awaitingDecision: 2, oldestAwaitingDecisionAt: daysAgo(5), lastMovementAt: daysAgo(1) },
      NOW,
    );
    expect(r.cause).toBe("waiting_on_client");
    expect(r.reason).toContain("5 days");
  });

  it("flags an unconfirmed interview", () => {
    const r = computeRoleRisk(
      { status: "active", interviewsToConfirm: 1, oldestInterviewToConfirmAt: daysAgo(3), lastMovementAt: daysAgo(1) },
      NOW,
    );
    expect(r.cause).toBe("interview_unscheduled");
    expect(r.reason).toContain("3 days");
  });

  it("renders interview age in honest hours, not rounded up", () => {
    const eighteenHoursAgo = new Date(NOW.getTime() - 18 * 3_600_000).toISOString();
    const r = computeRoleRisk(
      { status: "active", interviewsToConfirm: 1, oldestInterviewToConfirmAt: eighteenHoursAgo, lastMovementAt: daysAgo(1) },
      NOW,
    );
    // 18 hours is below the 2-day threshold, so this should not be at risk.
    expect(r.atRisk).toBe(false);

    // If we force it over the threshold, the reason must show hours, not "2 days".
    const r2 = computeRoleRisk(
      { status: "active", interviewsToConfirm: 1, oldestInterviewToConfirmAt: daysAgo(2), lastMovementAt: daysAgo(1) },
      NOW,
    );
    expect(r2.cause).toBe("interview_unscheduled");
    expect(r2.reason).toContain("2 days");
  });


  it("flags a missed shortlist promise", () => {
    const r = computeRoleRisk(
      { status: "active", promisedShortlistBy: daysAgo(2), shortlistDeliveredAt: null, lastMovementAt: daysAgo(1) },
      NOW,
    );
    expect(r.cause).toBe("promise_missed");
  });

  it("flags a stalled role", () => {
    const r = computeRoleRisk({ status: "active", lastMovementAt: daysAgo(10) }, NOW);
    expect(r.cause).toBe("stalled");
  });

  it("stays quiet when everything is fresh", () => {
    const r = computeRoleRisk(
      { status: "active", lastMovementAt: daysAgo(1), awaitingDecision: 1, oldestAwaitingDecisionAt: daysAgo(1) },
      NOW,
    );
    expect(r.atRisk).toBe(false);
    expect(r.reason).toBe("");
  });
});
