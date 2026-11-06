import { describe, expect, it } from "vitest";
import { readinessFromPositionRow, roleGaps } from "@/lib/position-readiness";

const base = {
  title: "Legal Billing Manager",
  description: "Own the full monthly billing cycle for a fast-growing business law firm.",
  location: "Woodbridge, NJ, USA",
  work_model: "hybrid",
  employment_type: "full_time",
  seniority: "Senior",
  requirements: [{ label: "5+ years of legal billing experience" }],
  intake_context: { experience: "5+ years", responsibilities: "Run the billing cycle." },
};

const keys = (row: Record<string, unknown>) =>
  roleGaps(readinessFromPositionRow(row)).map((g) => g.key);

describe("role readiness: salary range", () => {
  it("counts a range saved as compensation.min/max (intake and role editor)", () => {
    expect(keys({ ...base, compensation: { min: 110000, max: 135000, currency: "USD" } })).toEqual(
      [],
    );
  });

  it("still reads the older budget_min/budget_max keys", () => {
    expect(keys({ ...base, compensation: { budget_min: 110000, budget_max: 135000 } })).toEqual([]);
  });

  it("falls back to the intake brief's budget when compensation is empty", () => {
    expect(
      keys({
        ...base,
        compensation: {},
        intake_context: { ...base.intake_context, budget_min: 110000, budget_max: 135000 },
      }),
    ).toEqual([]);
  });

  it("asks for the range when none is set, or only zeros", () => {
    expect(keys({ ...base, compensation: {} })).toEqual(["budget"]);
    expect(keys({ ...base, compensation: { min: 0, max: 0 } })).toEqual(["budget"]);
    expect(keys({ ...base, compensation: { min: 110000 } })).toEqual(["budget"]);
  });
});
