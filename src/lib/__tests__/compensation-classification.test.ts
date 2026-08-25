import { describe, it, expect } from "vitest";
import { classifyCompensation } from "@/lib/client-kpi.server";

describe("classifyCompensation", () => {
  const role = { min: 55000, max: 75000 };

  it("marks exact range boundaries as aligned", () => {
    expect(classifyCompensation(role, { amount: 55000 })).toBe("aligned");
    expect(classifyCompensation(role, { amount: 75000 })).toBe("aligned");
  });

  it("marks any amount above the max as over", () => {
    expect(classifyCompensation(role, { amount: 78000 })).toBe("over");
    expect(classifyCompensation(role, { amount: 85000 })).toBe("over");
  });

  it("marks any amount below the min as under", () => {
    expect(classifyCompensation(role, { amount: 50000 })).toBe("under");
  });

  it("marks in-range amounts as aligned", () => {
    expect(classifyCompensation(role, { amount: 65000 })).toBe("aligned");
  });

  it("returns unknown when candidate amount is missing", () => {
    expect(classifyCompensation(role, { amount: null })).toBe("unknown");
  });

  it("returns unknown when role range is missing", () => {
    expect(classifyCompensation({ min: null, max: null }, { amount: 65000 })).toBe("unknown");
  });
});
