/**
 * v1.7.0: eligibility from dealbreakers only, and screening answers as
 * evidence for the must-have their question was written for. Question
 * wording is the Group Marketing Manager brief's.
 */
import { describe, expect, it } from "vitest";
import { asBoolean, dealbreakerCondition } from "@/lib/scoring/eligibility";
import { scoreCandidate, type ScreeningAnswer } from "@/lib/scoring-engine.server";

const YEARS_Q =
  "Do you have at least 10 years of progressive marketing experience, including at least 5 years in a leadership role?";
const DUBAI_Q =
  "Are you currently based in or willing to relocate to Dubai, UAE, and eligible for UAE employment?";
const ARABIC_Q = "Are you fluent in professional business Arabic (written and spoken)?";
const DEGREE_Q =
  "Do you hold a Bachelor's degree in Marketing, Business Administration, or a related field?";

const answer = (
  id: string,
  question: string,
  value: unknown,
  opts: { dealbreaker?: boolean; required?: boolean; must_have?: string | null } = {},
): ScreeningAnswer => ({
  question_id: id,
  question,
  required: opts.required ?? true,
  answer_type: "boolean",
  value,
  disqualifying_condition: dealbreakerCondition({
    dealbreaker: opts.dealbreaker ?? false,
    answer_type: "boolean",
  }),
  must_have: opts.must_have ?? null,
});

const CV = [
  "Jane Doe",
  "Mumbai, India",
  "Head of Marketing, Example Retail Group",
  "Jan 2012 - Present",
  "Led brand, campaigns and loyalty across 40 stores.",
].join("\n");

describe("which answers can make a candidate ineligible", () => {
  it("reads stored answers in every shape they arrive in", () => {
    for (const v of [true, "true", "Yes", { value: true }]) expect(asBoolean(v)).toBe(true);
    for (const v of [false, "false", "no", { value: "No" }]) expect(asBoolean(v)).toBe(false);
    expect(asBoolean("maybe")).toBeNull();
  });

  it("only a dealbreaker yes/no question has a disqualifying answer", () => {
    expect(dealbreakerCondition({ dealbreaker: false, answer_type: "boolean" })).toBeNull();
    expect(dealbreakerCondition({ dealbreaker: true, answer_type: "multi_choice" })).toBeNull();
    expect(dealbreakerCondition({ dealbreaker: true, answer_type: "boolean" })).toEqual({
      operator: "equals",
      value: false,
    });
  });

  it("a dealbreaker whose preferred answer is 'no' disqualifies 'yes'", () => {
    // "Do you require visa sponsorship?" on a role that cannot sponsor.
    expect(
      dealbreakerCondition({ dealbreaker: true, answer_type: "boolean", preferred_answer: false }),
    ).toEqual({
      operator: "equals",
      value: true,
    });
  });

  it("a 'no' to the optional Arabic question disqualifies nobody and is not counted against them", () => {
    const r = scoreCandidate({
      cv_text: CV,
      requirements: [
        {
          id: "req-0",
          text: "10 or more years of progressive marketing experience",
          required: true,
          keywords: [],
        },
      ],
      screening: [
        answer("q-years", YEARS_Q, true, { dealbreaker: true }),
        answer("q-arabic", ARABIC_Q, false, { dealbreaker: false, required: false }),
      ],
    });
    expect(r.disqualifying_answers).toEqual([]);
    expect(r.contradiction_status).not.toBe("disqualifying_answer");
    expect(r.screening_evidence.find((s) => s.question_id === "q-arabic")?.aligned).toBe("unknown");
  });

  it("a 'no' to a dealbreaker disqualifies, whether stored as false or as the text 'false'", () => {
    for (const value of [false, "false"]) {
      const r = scoreCandidate({
        cv_text: CV,
        requirements: [{ id: "req-0", text: "Marketing leadership", required: true, keywords: [] }],
        screening: [answer("q-dubai", DUBAI_Q, value, { dealbreaker: true })],
      });
      expect(r.disqualifying_answers.map((d) => d.question_id)).toEqual(["q-dubai"]);
      expect(r.contradiction_status).toBe("disqualifying_answer");
    }
  });
});

describe("a yes counts for the must-have its question was written for", () => {
  const RELOCATE = {
    id: "req-4",
    text: "If outside the UAE must be willing to relocate",
    required: true,
    keywords: [],
  };

  it("links by the stored must-have even when the wording shares nothing, as Partial", () => {
    const r = scoreCandidate({
      cv_text: CV,
      requirements: [RELOCATE],
      screening: [
        answer("q-dubai", DUBAI_Q, true, {
          dealbreaker: true,
          must_have: "Location and work eligibility in Dubai, UAE",
        }),
      ],
    });
    const row = r.requirement_assessment.find((a) => a.id === "req-4")!;
    expect(row.status).toBe("partial");
    expect(row.needs_validation).toBe(true);
    const ev = row.evidence.find((e) => e.source === "screening");
    expect(ev?.location).toBe("screening:q-dubai");
    expect(ev?.snippet).toMatch(/Answered yes/);
  });

  it("CV support in part plus a yes is Met", () => {
    const req = {
      id: "req-x",
      text: "Loyalty programme management across shopping malls",
      required: true,
      keywords: [],
    };
    const cvOnly = scoreCandidate({ cv_text: CV, requirements: [req], screening: [] });
    expect(cvOnly.requirement_assessment[0]!.status).toBe("partial");
    const withYes = scoreCandidate({
      cv_text: CV,
      requirements: [req],
      screening: [
        answer("q-loyalty", "Have you managed loyalty programmes for shopping malls?", true, {
          must_have: "Loyalty programme management across shopping malls",
        }),
      ],
    });
    expect(withYes.requirement_assessment[0]!.status).toBe("met");
    expect(withYes.requirement_assessment[0]!.evidence.map((e) => e.source)).toContain("screening");
  });

  it("a yes does not overrule a CV that clearly says otherwise; it is recorded as a contradiction", () => {
    const r = scoreCandidate({
      cv_text: ["EDUCATION", "BA (Hons) Ancient History, University College London", CV].join("\n"),
      requirements: [
        {
          id: "req-0",
          text: "Bachelor's degree in Marketing, Business Administration or a related field",
          required: true,
          keywords: [],
        },
      ],
      screening: [
        answer("q-degree", DEGREE_Q, true, {
          dealbreaker: true,
          must_have:
            "Bachelor's degree in Marketing, Business Administration, or related discipline",
        }),
      ],
    });
    expect(r.requirement_assessment[0]!.status).toBe("missing");
    expect(r.contradiction_rows.map((c) => c.question_id)).toEqual(["q-degree"]);
  });
});
