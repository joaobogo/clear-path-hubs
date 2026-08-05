import { describe, expect, it } from "vitest";
import {
  DECISION_NOTE_MAX,
  NOT_A_FIT_REASONS,
  decisionReasonError,
} from "@/lib/client-decision-reasons";

describe("decisionReasonError", () => {
  it("requires a reason when one is expected", () => {
    expect(decisionReasonError({ reasonRequired: true })).toMatch(/Pick a reason/);
    expect(decisionReasonError({ reasonRequired: true, reasonCode: "too_junior" })).toBeNull();
  });

  it("requires a ten character note for Other", () => {
    expect(decisionReasonError({ reasonRequired: true, reasonCode: "other", note: "nope" })).toMatch(
      /at least 10/,
    );
    expect(
      decisionReasonError({ reasonRequired: true, reasonCode: "other", note: "wrong domain fit" }),
    ).toBeNull();
  });

  it("caps the note", () => {
    expect(
      decisionReasonError({
        reasonRequired: true,
        reasonCode: "timing",
        note: "x".repeat(DECISION_NOTE_MAX + 1),
      }),
    ).toMatch(/under 500/);
  });

  it("offers the fixed not-a-fit vocabulary", () => {
    const codes = NOT_A_FIT_REASONS.map((r) => r.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "missing_critical",
        "too_junior",
        "too_senior",
        "compensation",
        "location_or_work_setup",
        "availability",
        "other",
      ]),
    );
  });
});
