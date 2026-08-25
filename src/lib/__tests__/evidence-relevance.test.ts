import { describe, it, expect } from "vitest";
import { passageSupportsRequirement as ok } from "@/lib/client/evidence-relevance";
describe("relevance", () => {
  it("rejects the generic Lisbon passage", () => {
    expect(ok("…from database schema through API to interface, and working in a hybrid team based in Lisbon", "Experience in an early-stage or founder-led team")).toBe(false);
  });
  it("keeps real matches", () => {
    expect(ok("Implemented row-level security policies in Postgres", "Practical experience with row-level security")).toBe(true);
    expect(ok("Joined as founding engineer at a seed-stage startup", "Experience in an early-stage or founder-led team")).toBe(true);
    expect(ok("Led payroll systems migration", "Payroll systems")).toBe(true);
  });
});
