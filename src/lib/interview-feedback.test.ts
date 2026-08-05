import { describe, expect, it } from "vitest";
import {
  DECLINE_CONCERN_MIN,
  FEEDBACK_TEXT_MAX,
  emptyFeedbackDraft,
  isFeedbackValid,
  validateFeedback,
} from "./interview-feedback";

describe("interview feedback validation", () => {
  it("requires a recommendation and a next step", () => {
    const errors = validateFeedback(emptyFeedbackDraft());
    expect(errors.recommendation).toBeTruthy();
    expect(errors.next_step).toBeTruthy();
  });

  it("accepts advance with no text at all", () => {
    expect(
      isFeedbackValid({
        recommendation: "advance",
        strengths: "",
        concerns: "",
        next_step: "another_interview",
      }),
    ).toBe(true);
  });

  it("requires a concern of at least ten characters to decline", () => {
    const short = validateFeedback({
      recommendation: "decline",
      strengths: "",
      concerns: "too junior",
      next_step: "stop_here",
    });
    expect(short.concerns).toBeUndefined(); // exactly ten characters passes

    const tooShort = validateFeedback({
      recommendation: "decline",
      strengths: "",
      concerns: "no",
      next_step: "stop_here",
    });
    expect(tooShort.concerns).toContain(String(DECLINE_CONCERN_MIN));
  });

  it("caps free text", () => {
    const errors = validateFeedback({
      recommendation: "hold",
      strengths: "a".repeat(FEEDBACK_TEXT_MAX + 1),
      concerns: "",
      next_step: "another_interview",
    });
    expect(errors.strengths).toBeTruthy();
  });
});
