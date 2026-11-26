/**
 * Scoring fix spec, 26 Nov 2026, Fix 7. With no screening answers the
 * screening part of the score drops out and the rest is re-weighted: Daniel
 * Miles showed 62.5 from his CV alone. The number stays; every list and card
 * says what it is built from, so 62.5 (CV only) is not read as better than 60
 * (CV and screening).
 */
import { describe, expect, it } from "vitest";
import { CV_ONLY_LABEL, isCvOnlyScore } from "../cv-only";
import { screeningFactsFor, type ScreeningFacts } from "../cv-only.server";

describe("a score built from the CV alone says so", () => {
  it("is labelled when the role asks questions and none is answered", () => {
    expect(isCvOnlyScore({ scored: true, roleHasQuestions: true, hasAnswers: false })).toBe(true);
    expect(CV_ONLY_LABEL).toBe("CV only, screening not answered");
  });

  it("is not labelled once any answer is on file, the candidate's or a recruiter's", () => {
    expect(isCvOnlyScore({ scored: true, roleHasQuestions: true, hasAnswers: true })).toBe(false);
  });

  it("is not labelled on a role that asks nothing: there is nothing unanswered", () => {
    expect(isCvOnlyScore({ scored: true, roleHasQuestions: false, hasAnswers: false })).toBe(false);
  });

  it("is not labelled on a candidate with no score to qualify", () => {
    expect(isCvOnlyScore({ scored: false, roleHasQuestions: true, hasAnswers: false })).toBe(false);
  });

  it("reads the two facts per row, and labels nothing when they are unknown", () => {
    const facts: ScreeningFacts = {
      rolesWithQuestions: new Set(["role-a"]),
      applicationsWithAnswers: new Set(["app-1"]),
    };
    expect(screeningFactsFor(facts, { position_id: "role-a", application_id: "app-1" })).toEqual({
      role_has_questions: true,
      has_answers: true,
    });
    expect(screeningFactsFor(facts, { position_id: "role-a", application_id: "app-2" })).toEqual({
      role_has_questions: true,
      has_answers: false,
    });
    // A staff-assigned match with no application on a role with questions.
    expect(screeningFactsFor(facts, { position_id: "role-a", application_id: null })).toEqual({
      role_has_questions: true,
      has_answers: false,
    });
    expect(screeningFactsFor(facts, { position_id: "role-b", application_id: "app-1" })).toEqual({
      role_has_questions: false,
      has_answers: true,
    });
  });
});
