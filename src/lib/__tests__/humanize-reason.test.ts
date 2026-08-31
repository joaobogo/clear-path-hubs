import { describe, expect, it } from "vitest";
import { humanizeReason, humanizeTechnicalError } from "@/lib/humanize-codes";

/**
 * audit #6, A6-26 — raw codes reached human copy across the admin console:
 * "Why: position_status:archived.", "Blocked: position_status:archived",
 * "match_not_found.", 'Processing stopped in state "ocr_required"'.
 */
describe("humanizeReason", () => {
  it("turns a key:value code into a sentence", () => {
    expect(humanizeReason("position_status:archived")).toBe(
      "The role is archived, so this candidate cannot be scored or published.",
    );
  });

  it("turns a bare code into a sentence", () => {
    expect(humanizeReason("match_not_found")).toBe("That candidate record no longer exists.");
    expect(humanizeReason("cv_unreadable")).toContain("could not be read as text");
  });

  it("never returns a bare token", () => {
    for (const code of [
      "position_status:archived",
      "match_not_found",
      "ocr_required",
      "provider_error",
      "some_unmapped_code",
    ]) {
      const out = humanizeReason(code);
      expect(out).not.toBe(code);
      expect(out.endsWith(".")).toBe(true);
    }
  });

  it("leaves a written sentence alone", () => {
    const sentence = "The provider rejected the request because the mailbox is full.";
    expect(humanizeReason(sentence)).toBe(sentence);
  });

  it("says something for a missing reason", () => {
    expect(humanizeReason(null)).toBe("No reason recorded.");
    expect(humanizeReason("")).toBe("No reason recorded.");
  });
});

describe("humanizeTechnicalError handles bare reason codes", () => {
  it("no longer prints position_status:archived verbatim", () => {
    expect(humanizeTechnicalError("position_status:archived")).toBe(
      "The role is archived, so this candidate cannot be scored or published.",
    );
  });

  it("still reads a structured provider payload", () => {
    // Resolved through the enum dictionary, which words it properly.
    expect(humanizeTechnicalError('{"code":"rate_limited"}')).toBe(
      "Too many sends in a short window — retry later.",
    );
  });

  it("still returns null for nothing", () => {
    expect(humanizeTechnicalError(null)).toBeNull();
    expect(humanizeTechnicalError("  ")).toBeNull();
  });
});
