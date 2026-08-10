import { describe, expect, it } from "vitest";
import { scoreCandidate } from "@/lib/scoring-engine.server";
import { DEFAULT_CALIBRATION as C } from "@/lib/scoring/engine-calibration";

const reqs = (n: number, kw: string[]) =>
  Array.from({ length: n }, (_, i) => ({ id: `r${i}`, text: `req ${i} ${kw[i] ?? kw[0]}`, required: true, keywords: [kw[i] ?? kw[0]!] }));

const perfectCv = `
Senior engineer with deep experience in typescript, postgres, kubernetes and terraform.
Led payments platform migration, ran hiring loops, owned SLOs. ${"Detailed delivery narrative. ".repeat(40)}
`;

describe("hard ceilings probe", () => {
  it("unparsed CV cannot beat the cap even with perfect requirement text", () => {
    const r = scoreCandidate({
      cv: "typescript postgres",  // < unreadable_cv_chars (60)
      requirements: reqs(3, ["typescript", "postgres", "kubernetes"]),
      screeningAnswers: [],
    } as any);
    console.log("unparsed:", JSON.stringify({ raw: r.raw_score, score: r.score, caps: r.applied_caps, label: r.fit_label }));
    expect(r.score).toBeLessThanOrEqual(C.unparsed_cv_cap * 100);
  });

  it("must-have miss floors the score", () => {
    const r = scoreCandidate({
      cv: perfectCv,
      requirements: [
        { id: "a", text: "aviation dispatch certification", required: true, keywords: ["aviation dispatch"] },
        { id: "b", text: "part 121 operations", required: true, keywords: ["part 121"] },
        { id: "c", text: "typescript", required: true, keywords: ["typescript"] },
      ],
      screeningAnswers: [],
    } as any);
    console.log("floor:", JSON.stringify({ raw: r.raw_score, score: r.score, mhc: r.must_have_coverage, caps: r.applied_caps, label: r.fit_label }));
    expect(r.must_have_coverage).toBeLessThan(C.must_have_floor);
    expect(r.score).toBeLessThanOrEqual(C.must_have_floor_cap * 100);
  });

  it("dealbreaker answer dominates", () => {
    const r = scoreCandidate({
      cv: perfectCv,
      requirements: reqs(3, ["typescript", "postgres", "kubernetes"]),
      screeningAnswers: [{ question_id: "q1", question: "Do you have the right to work?", required: true, answer_type: "boolean", value: false, disqualifying_condition: { operator: "equals", value: false } }],
    } as any);
    console.log("dq:", JSON.stringify({ raw: r.raw_score, score: r.score, caps: r.applied_caps, label: r.fit_label }));
    expect(r.score).toBeLessThanOrEqual(C.disqualified_cap * 100);
  });

  it("lowest cap wins when several fire", () => {
    const r = scoreCandidate({
      cv: "ts",
      requirements: [{ id: "a", text: "aviation dispatch", required: true, keywords: ["aviation dispatch"] }],
      screeningAnswers: [{ question_id: "q1", question: "Right to work?", required: true, answer_type: "boolean", value: false, disqualifying_condition: { operator: "equals", value: false } }],
    } as any);
    console.log("stacked:", JSON.stringify({ raw: r.raw_score, score: r.score, caps: r.applied_caps }));
    expect(r.score).toBeLessThanOrEqual(C.disqualified_cap * 100);
  });
});
