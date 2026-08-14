import { describe, it, expect } from "vitest";
import { formatMoneyMajor, formatMoneyFromCents, formatSalaryLine } from "@/lib/money";
import { isOpenRoleStatus, isFilledRole } from "@/lib/client-role-open";

describe("money formatting", () => {
  it("renders major units at full scale (the €64,000 offer bug)", () => {
    expect(formatMoneyMajor(64000, "EUR")).toContain("64,000");
    expect(formatMoneyMajor(68000, "EUR")).toContain("68,000");
  });

  it("renders cents by dividing exactly once", () => {
    expect(formatMoneyFromCents(6400000, "EUR")).toContain("64,000");
  });

  it("returns a dash for missing amounts instead of NaN", () => {
    expect(formatMoneyMajor(null)).toBe("—");
    expect(formatMoneyFromCents(undefined)).toBe("—");
  });

  it("appends the period to a salary line", () => {
    expect(
      formatSalaryLine({ salary_amount: 64000, salary_currency: "EUR", salary_period: "year" }),
    ).toContain("/year");
    expect(formatSalaryLine({ salary_amount: null })).toBeNull();
  });
});

describe("role open/filled derivation", () => {
  it("counts only active and approved roles as open", () => {
    expect(isOpenRoleStatus("active")).toBe(true);
    expect(isOpenRoleStatus("approved")).toBe(true);
    expect(isOpenRoleStatus("under_review")).toBe(false);
    expect(isOpenRoleStatus("submitted")).toBe(false);
    expect(isOpenRoleStatus("filled")).toBe(false);
  });

  it("treats a role with a hired candidate as filled", () => {
    expect(isFilledRole({ id: "p1", status: "active" }, new Set(["p1"]))).toBe(true);
    expect(isFilledRole({ id: "p1", status: "active" }, new Set())).toBe(false);
    expect(isFilledRole({ id: "p2", status: "filled" }, new Set())).toBe(true);
  });
});
