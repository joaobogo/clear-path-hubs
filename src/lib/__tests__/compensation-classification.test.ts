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

  // audit #4, M12 — a candidate range used to be folded to its minimum, so an
  // overlapping range read as "below range" and showed as a dealbreaker.
  describe("candidate gave a range", () => {
    it("counts any overlap with the role range as aligned", () => {
      // Candidate 45k–60k against a 55k–75k role: they meet at 55k–60k.
      expect(classifyCompensation(role, { amount: 45000, min: 45000, max: 60000 })).toBe("aligned");
      // Candidate 70k–90k: they meet at 70k–75k.
      expect(classifyCompensation(role, { amount: 70000, min: 70000, max: 90000 })).toBe("aligned");
    });

    it("touching at a single figure is still aligned", () => {
      expect(classifyCompensation(role, { amount: 40000, min: 40000, max: 55000 })).toBe("aligned");
      expect(classifyCompensation(role, { amount: 75000, min: 75000, max: 99000 })).toBe("aligned");
    });

    it("only a band entirely outside the role range is over or under", () => {
      expect(classifyCompensation(role, { amount: 30000, min: 30000, max: 54999 })).toBe("under");
      expect(classifyCompensation(role, { amount: 75001, min: 75001, max: 90000 })).toBe("over");
    });

    it("still handles an open-ended role range", () => {
      expect(classifyCompensation({ min: 55000, max: null }, { amount: 40000, min: 40000, max: 60000 }))
        .toBe("aligned");
      expect(classifyCompensation({ min: 55000, max: null }, { amount: 10000, min: 10000, max: 20000 }))
        .toBe("under");
    });
  });
});
