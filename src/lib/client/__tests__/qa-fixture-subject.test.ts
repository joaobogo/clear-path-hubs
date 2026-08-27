import { describe, expect, it } from "vitest";
import { isQaFixtureSubject } from "../test-record-filter";

describe("isQaFixtureSubject", () => {
  it("catches internal QA thread names", () => {
    for (const s of [
      "History Integrity Test",
      "QA thread",
      "Smoke run",
      "E2E check",
      "Fixture data",
      "[QA test — ignore] thread",
    ]) {
      expect(isQaFixtureSubject(s), s).toBe(true);
    }
  });

  it("leaves real subjects alone", () => {
    for (const s of [
      "Senior Full-Stack Engineer",
      "Testing Engineer shortlist",
      "Quality Assurance Lead",
      "General",
      "Offer for Maria",
    ]) {
      expect(isQaFixtureSubject(s), s).toBe(false);
    }
  });
});
