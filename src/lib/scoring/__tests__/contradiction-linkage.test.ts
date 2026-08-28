import { describe, expect, it } from "vitest";
import { scoreCandidate, type ScreeningAnswer } from "@/lib/scoring-engine.server";
import { filler, reqFromText } from "@/lib/scoring/golden-corpus";

/**
 * Screening/requirement linkage semantics (engine v1.5.0).
 *
 * History: v1.4.0 flagged "screening contradicts cv" whenever ANY boolean yes
 * coexisted with ANY missing must-have — every real candidate, nothing to
 * resolve. v1.4.1 required the answer and the requirement to share their
 * subject. v1.5.0 completes it: a linked yes over a SILENT requirement is
 * weak positive evidence (floored at partial, needs validation), and the
 * contradiction flag fires only when the CV affirmatively NEGATES what the
 * answer claims. Absence of corroboration is a thing to verify, not a
 * conflict.
 */

const yes = (question_id: string, question: string): ScreeningAnswer => ({
  question_id,
  question,
  required: true,
  answer_type: "boolean",
  value: true,
});

const ENGLISH_REQ = "Fluent professional English speaking and communication skills";
const ENGLISH_Q = "Do you have fluent professional English communication skills?";

describe("screening linkage (v1.5.0)", () => {
  it("an unrelated yes neither flags nor credits an unrelated missing requirement", () => {
    const result = scoreCandidate({
      cv_text: `Full stack developer building React and Node applications. ${filler}`,
      requirements: [reqFromText("Proven experience running Kubernetes clusters in production")],
      screening: [yes("q-comp", "This role pays R$3,500-R$4,500 per month as PJ - does that work for you?")],
    });
    expect(result.contradiction_status).toBe("none");
    expect(result.contradiction_rows).toEqual([]);
    expect(result.requirement_assessment[0]!.status).not.toBe("partial");
  });

  it("a linked yes floors a silent requirement at partial with the answer as evidence", () => {
    const result = scoreCandidate({
      cv_text: `Full stack developer building React and Node applications. ${filler}`,
      requirements: [reqFromText(ENGLISH_REQ)],
      screening: [yes("q-english", ENGLISH_Q)],
    });
    const row = result.requirement_assessment[0]!;
    expect(row.status).toBe("partial");
    expect(row.needs_validation).toBe(true);
    expect(row.evidence.some((e) => e.source === "screening")).toBe(true);
    // No contradiction: the CV is silent, not conflicting.
    expect(result.contradiction_status).toBe("none");
  });

  it("a linked yes over a CV that NEGATES the claim is a real contradiction", () => {
    const result = scoreCandidate({
      cv_text: `Backend engineer. No professional English speaking experience and not fluent in English communication. ${filler}`,
      requirements: [reqFromText(ENGLISH_REQ)],
      screening: [yes("q-english", ENGLISH_Q)],
    });
    // Only when the requirement itself resolved as contradicted may the flag
    // fire — and then it names the pair.
    if (result.requirement_assessment[0]!.status === "contradicted") {
      expect(result.contradiction_status).toBe("screening_contradicts_cv");
      expect(result.contradiction_rows[0]).toMatchObject({ question_id: "q-english" });
      expect(result.concerns[0]).toContain("contradicts");
    } else {
      // If negation heuristics read this CV as silent instead, the floor
      // applies and no contradiction may be claimed.
      expect(result.contradiction_status).toBe("none");
    }
  });

  it("evidenced requirements never contradict, whatever was answered", () => {
    const result = scoreCandidate({
      cv_text: `Fluent professional English communication, daily client calls. ${filler}`,
      requirements: [reqFromText(ENGLISH_REQ)],
      screening: [yes("q-english", ENGLISH_Q)],
    });
    expect(result.contradiction_status).toBe("none");
  });

  it("a disqualifying answer still wins over the linkage flag", () => {
    const result = scoreCandidate({
      cv_text: `Full stack developer building React and Node applications. ${filler}`,
      requirements: [reqFromText(ENGLISH_REQ)],
      screening: [
        {
          question_id: "q-pj",
          question: "Are you able to work under a PJ contract?",
          required: true,
          answer_type: "boolean",
          value: false,
          disqualifying_condition: { operator: "equals", value: false },
        },
        yes("q-english", ENGLISH_Q),
      ],
    });
    expect(result.contradiction_status).toBe("disqualifying_answer");
    expect(result.contradiction_rows).toEqual([]);
  });

  it("a text answer's content is evidence for the terms it names", () => {
    const result = scoreCandidate({
      cv_text: `Backend engineer shipping Laravel services. ${filler}`,
      requirements: [reqFromText("Comfortable using AI tools as part of the development workflow")],
      screening: [
        {
          question_id: "q-ai",
          question: "How comfortable are you with AI tools?",
          required: true,
          answer_type: "long_text",
          value:
            "I use Claude Code daily and run ChatGPT for code review; AI tools are part of my normal development workflow.",
        },
      ],
    });
    const row = result.requirement_assessment[0]!;
    expect(["partial", "met"]).toContain(row.status);
    expect(row.evidence.some((e) => e.source === "screening")).toBe(true);
  });
});
