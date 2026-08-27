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

describe("F12 — a Met quote must evidence that requirement", () => {
  const tests = "Comfortable writing and maintaining automated tests (unit and end-to-end)";
  it("rejects a seniority passage that only shares attitude words", () => {
    expect(
      ok(
        "Comfortable being the most senior engineer in the room and still writing the difficult parts myself",
        tests,
      ),
    ).toBe(false);
  });
  it("rejects a multi-tenancy passage", () => {
    expect(ok("180 multi-tenant merchant books apart with row-level security", tests)).toBe(false);
  });
  it("keeps passages that really talk about testing", () => {
    expect(ok("Built the end-to-end Playwright suite and unit tests in Vitest", tests)).toBe(true);
    expect(ok("Raised automated test coverage from 20% to 80%", tests)).toBe(true);
  });
});
