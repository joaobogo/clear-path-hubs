import { describe, expect, it } from "vitest";
import { qaGuardValues } from "@/lib/qa-guard";

/**
 * audit #6, A6-27 — the guard matched markers as substrings, so any value
 * merely containing the letters was rejected from a live role and told it
 * "looks like a test record". Real applicants are called Testa and Costa, and
 * real addresses live at protest.org.
 */
describe("qa guard marker matching", () => {
  describe("still catches our own fixtures", () => {
    it.each([
      "QA Test",
      "qa test",
      "browser-test",
      "Please ignore",
      "disregard this",
      "joaoluciano+qa@gmail.com",
      "someone+test@example.com",
      "test_user_01",
      "QA",
    ])("rejects %j", (value) => {
      expect(qaGuardValues([value]).ok).toBe(false);
    });
  });

  describe("does not reject real people", () => {
    it.each([
      "Beatriz Testa",
      "Ana Costa",
      "Vasco Santos",
      "ana.costa@protest.org",
      "Our latest platform release",
      "Quality Assurance Analyst",
      "Contestant coordinator",
      "Ignacio Ruiz",
    ])("accepts %j", (value) => {
      expect(qaGuardValues([value]).ok).toBe(true);
    });
  });

  it("names what it matched so a person can dispute it", () => {
    const out = qaGuardValues(["QA Test", "ana@example.com"]);
    expect(out.ok).toBe(false);
    expect(out.reason).toContain("QA Test");
    // Only the offending value is named, not every value supplied.
    expect(out.reason).not.toContain("ana@example.com");
  });

  it("passes a clean set through", () => {
    expect(qaGuardValues(["Ana Costa", "ana@example.com"])).toEqual({ ok: true, reason: null });
  });
});
