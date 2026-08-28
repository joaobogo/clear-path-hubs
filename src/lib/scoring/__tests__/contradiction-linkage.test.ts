import { describe, expect, it } from "vitest";
import { scoreCandidate, type ScreeningAnswer } from "@/lib/scoring-engine.server";
import { filler, reqFromText } from "@/lib/scoring/golden-corpus";

/**
 * Regression pin for the screening-contradiction flag (engine v1.4.1).
 *
 * The old test — "any boolean yes was answered" AND "any required requirement
 * is missing" — linked nothing to nothing. Every real candidate answers yes to
 * something and misses some keyword, so every scored candidate in a live
 * workspace carried "screening contradicts cv", score approval was blocked on
 * all of them, and the reviewer had no row to resolve. The flag now requires
 * the ANSWER and the UNEVIDENCED REQUIREMENT to share their subject, and each
 * flagged pair is recorded for the review surface.
 */

const yes = (question_id: string, question: string): ScreeningAnswer => ({
  question_id,
  question,
  required: true,
  answer_type: "boolean",
  value: true,
});

describe("screening contradiction linkage", () => {
  it("an unrelated yes never flags an unrelated missing requirement", () => {
    // CV misses the Kubernetes must-have; the yes is about compensation.
    const result = scoreCandidate({
      cv_text: `Full stack developer building React and Node applications. ${filler}`,
      requirements: [reqFromText("Proven experience running Kubernetes clusters in production")],
      screening: [yes("q-comp", "This role pays R$3,500-R$4,500 per month as PJ - does that work for you?")],
    });
    expect(result.contradiction_status).toBe("none");
    expect(result.contradiction_rows).toEqual([]);
  });

  it("a yes about the same subject as a missing requirement flags with the named pair", () => {
    const result = scoreCandidate({
      cv_text: `Full stack developer building React and Node applications. ${filler}`,
      requirements: [
        reqFromText("Fluent professional English speaking and communication skills"),
      ],
      screening: [
        yes("q-english", "Do you have fluent professional English communication skills?"),
      ],
    });
    expect(result.contradiction_status).toBe("screening_contradicts_cv");
    expect(result.contradiction_rows).toHaveLength(1);
    expect(result.contradiction_rows[0]).toMatchObject({
      question_id: "q-english",
      requirement: "Fluent professional English speaking and communication skills",
    });
    // The concern names both sides so a reviewer can actually resolve it.
    expect(result.concerns[0]).toContain("English");
  });

  it("evidenced requirements never contradict, whatever was answered", () => {
    const result = scoreCandidate({
      cv_text: `Fluent professional English communication, daily client calls. ${filler}`,
      requirements: [
        reqFromText("Fluent professional English speaking and communication skills"),
      ],
      screening: [
        yes("q-english", "Do you have fluent professional English communication skills?"),
      ],
    });
    expect(result.contradiction_status).toBe("none");
  });

  it("a disqualifying answer still wins over the linkage flag", () => {
    const result = scoreCandidate({
      cv_text: `Full stack developer building React and Node applications. ${filler}`,
      requirements: [
        reqFromText("Fluent professional English speaking and communication skills"),
      ],
      screening: [
        {
          question_id: "q-pj",
          question: "Are you able to work under a PJ contract?",
          required: true,
          answer_type: "boolean",
          value: false,
          disqualifying_condition: { operator: "equals", value: false },
        },
        yes("q-english", "Do you have fluent professional English communication skills?"),
      ],
    });
    expect(result.contradiction_status).toBe("disqualifying_answer");
    // Rows list only backs the screening_contradicts_cv status.
    expect(result.contradiction_rows).toEqual([]);
  });
});
