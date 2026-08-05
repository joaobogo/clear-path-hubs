import { describe, expect, it } from "vitest";
import {
  MIN_PERFORMANCE_SAMPLE,
  NOT_ENOUGH_SAMPLE,
  buildServiceExpectations,
  hoursLabel,
  performanceFor,
  spread,
  type CompletedRoleOutcome,
  type StoredRoleCommitment,
} from "../client-service-expectations";

const commitment = (over: Partial<StoredRoleCommitment> = {}): StoredRoleCommitment => ({
  positionId: "p1",
  firstShortlistDays: 10,
  shortlistSize: 5,
  interviewSlotsHours: 48,
  ...over,
});

const outcome = (over: Partial<CompletedRoleOutcome> = {}): CompletedRoleOutcome => ({
  positionId: "p1",
  promisedShortlistDays: 10,
  actualShortlistDays: 8,
  promisedShortlistSize: 5,
  actualShortlistSize: 5,
  ...over,
});

describe("spread", () => {
  it("states one value when every role carries the same term", () => {
    expect(spread([10, 10], (n) => `${n} days`)).toBe("10 days");
  });

  it("states a range rather than an average when terms differ", () => {
    expect(spread([8, 14], (n) => `${n} days`)).toBe("8–14 days");
  });

  it("returns null when nothing usable is stored", () => {
    expect(spread([], (n) => `${n} days`)).toBeNull();
    expect(spread([0, -3], (n) => `${n} days`)).toBeNull();
  });
});

describe("performanceFor", () => {
  it("suppresses a figure below two completed roles", () => {
    const one = performanceFor([8], (a, n) => `${a}/${n}`);
    expect(one.performance).toBeNull();
    expect(one.sampleNote).toBe(NOT_ENOUGH_SAMPLE);
    expect(MIN_PERFORMANCE_SAMPLE).toBe(2);
  });

  it("shows the figure with its sample size at two or more", () => {
    const two = performanceFor([8, 10], (avg, n) => `avg ${avg} over ${n}`);
    expect(two.performance).toBe("avg 9 over 2");
    expect(two.sampleNote).toBe("Measured across your last 2 completed roles");
  });
});

describe("buildServiceExpectations", () => {
  it("says the plan is being set up when nothing is stored", () => {
    const out = buildServiceExpectations({ plan: null, commitments: [], completed: [] });
    expect(out.hasPlan).toBe(false);
    expect(out.rows).toEqual([]);
  });

  it("shows only commitments backed by a stored row", () => {
    const out = buildServiceExpectations({
      plan: null,
      commitments: [commitment()],
      completed: [],
    });
    const keys = out.rows.map((r) => r.key);
    expect(keys).toEqual(["first_shortlist", "shortlist_size", "response_time"]);
    // Nothing invented for terms the plan does not record.
    expect(keys).not.toContain("included_roles");
  });

  it("pairs performance with the promise once two roles are complete", () => {
    const out = buildServiceExpectations({
      plan: null,
      commitments: [commitment(), commitment({ positionId: "p2" })],
      completed: [outcome(), outcome({ positionId: "p2", actualShortlistDays: 8 })],
    });
    const first = out.rows.find((r) => r.key === "first_shortlist")!;
    expect(first.promised).toContain("10 days");
    expect(first.performance).toContain("Delivered in 8 days");
    expect(first.sampleNote).toContain("2 completed roles");
  });

  it("never averages a single role", () => {
    const out = buildServiceExpectations({
      plan: null,
      commitments: [commitment()],
      completed: [outcome()],
    });
    for (const row of out.rows) expect(row.performance).toBeNull();
    expect(out.rows[0]!.sampleNote).toBe(NOT_ENOUGH_SAMPLE);
  });

  it("excludes completed roles with no recorded outcome from the sample", () => {
    const out = buildServiceExpectations({
      plan: null,
      commitments: [commitment()],
      completed: [
        outcome(),
        outcome({ positionId: "p2", actualShortlistDays: null, actualShortlistSize: null }),
      ],
    });
    expect(out.rows.find((r) => r.key === "first_shortlist")!.performance).toBeNull();
  });

  it("reports included roles and term from the stored plan", () => {
    const out = buildServiceExpectations({
      plan: {
        label: "Multi Position",
        rolesTotal: 5,
        rolesUsed: 2,
        source: "package",
        expiresAt: "2026-09-01T00:00:00.000Z",
      },
      commitments: [],
      completed: [],
    });
    expect(out.planLabel).toBe("Multi Position");
    expect(out.rows.find((r) => r.key === "included_roles")!.promised).toBe("5 roles included");
    expect(out.rows.find((r) => r.key === "included_roles")!.performance).toBe("2 of 5 used so far");
    expect(out.rows.find((r) => r.key === "plan_term")!.commitment).toBe("Allowance valid until");
  });

  it("describes a subscription allowance as concurrent, not cumulative", () => {
    const out = buildServiceExpectations({
      plan: { label: "Bronze", rolesTotal: 3, rolesUsed: 1, source: "subscription", expiresAt: null },
      commitments: [],
      completed: [],
    });
    expect(out.rows.find((r) => r.key === "included_roles")!.promised).toBe(
      "Up to 3 active roles at a time",
    );
  });
});

describe("hoursLabel", () => {
  it("speaks in working days when the term divides evenly", () => {
    expect(hoursLabel(48)).toBe("2 working days");
    expect(hoursLabel(24)).toBe("1 working day");
    expect(hoursLabel(36)).toBe("36 hours");
  });
});
