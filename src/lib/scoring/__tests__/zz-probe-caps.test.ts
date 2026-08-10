import { describe, expect, it } from "vitest";
import { scoreCandidate } from "@/lib/scoring-engine.server";
import { DEFAULT_CALIBRATION as C } from "@/lib/scoring/engine-calibration";

const reqs = (n: number, kw: string[]) =>
  Array.from({ length: n }, (_, i) => ({ id: `r${i}`, text: `req ${i} ${kw[i] ?? kw[0]}`, required: true, keywords: [kw[i] ?? kw[0]!] }));

const richCv = `
Chief pilot and operations lead. Managed dispatch rosters, crew scheduling, fatigue
risk management, safety audits, maintenance coordination, fuel planning, weather
briefings, regulatory filings, budget forecasting, vendor negotiation, contract
renewals, incident investigation, simulator training, checkride preparation,
ground handling oversight, catering logistics, deicing procedures, ramp safety,
noise abatement, customer recovery, irregular operations, gate assignment,
turnaround optimisation, baggage reconciliation, hazardous materials handling,
typescript automation scripts for reporting dashboards, postgres data warehouse
queries, tableau visualisation, stakeholder communication, union relations,
recruitment pipelines, onboarding curriculum, mentorship programmes, quality
assurance reviews, continuous improvement kaizen workshops, procurement policy.
`;
const perfectCv = `
Senior engineer with deep experience in typescript, postgres, kubernetes and terraform.
Led payments platform migration, ran hiring loops, owned SLOs. ${"Detailed delivery narrative. ".repeat(40)}
`;

describe("hard ceilings probe", () => {
  it("unparsed CV cannot beat the cap even with perfect requirement text", () => {
    const r = scoreCandidate({
      cv_text: "typescript postgres",  // < unreadable_cv_chars (60)
      requirements: reqs(3, ["typescript", "postgres", "kubernetes"]),
      screening: [],
    } as any);
    console.log("unparsed:", JSON.stringify({ raw: r.raw_score, score: r.score, caps: r.applied_caps, label: r.fit_label }));
    expect(r.score).toBeLessThanOrEqual(C.unparsed_cv_cap * 100);
  });

  it("must-have miss floors the score", () => {
    const r = scoreCandidate({
      cv_text: richCv,
      requirements: [
        { id: "a", text: "medical device sterilisation", required: true, keywords: ["sterilisation"] },
        { id: "b", text: "iso 13485 auditing", required: true, keywords: ["iso 13485"] },
        { id: "c", text: "clinical trial monitoring", required: true, keywords: ["clinical trial"] },
        { id: "d", text: "typescript", required: true, keywords: ["typescript"] },
      ],
      screening: [],
    } as any);
    console.log("floor:", JSON.stringify({ raw: r.raw_score, score: r.score, mhc: r.must_have_coverage, caps: r.applied_caps, label: r.fit_label }));
    expect(r.must_have_coverage).toBeLessThan(C.must_have_floor);
    expect(r.score).toBeLessThanOrEqual(C.must_have_floor_cap * 100);
  });

  it("dealbreaker answer dominates", () => {
    const r = scoreCandidate({
      cv_text: perfectCv,
      requirements: reqs(3, ["typescript", "postgres", "kubernetes"]),
      screening: [{ question_id: "q1", question: "Do you have the right to work?", required: true, answer_type: "boolean", value: false, disqualifying_condition: { operator: "equals", value: false } }],
    } as any);
    console.log("dq:", JSON.stringify({ raw: r.raw_score, score: r.score, caps: r.applied_caps, label: r.fit_label }));
    expect(r.score).toBeLessThanOrEqual(C.disqualified_cap * 100);
  });

  it("lowest cap wins when several fire", () => {
    const r = scoreCandidate({
      cv_text: "ts",
      requirements: [{ id: "a", text: "aviation dispatch", required: true, keywords: ["aviation dispatch"] }],
      screening: [{ question_id: "q1", question: "Right to work?", required: true, answer_type: "boolean", value: false, disqualifying_condition: { operator: "equals", value: false } }],
    } as any);
    console.log("stacked:", JSON.stringify({ raw: r.raw_score, score: r.score, caps: r.applied_caps }));
    expect(r.score).toBeLessThanOrEqual(C.disqualified_cap * 100);
  });
});

describe("floor cap visibility", () => {
  it("clamps and records when preferred/screening would otherwise carry a weak core", () => {
    const r = scoreCandidate({
      cv_text: richCv,
      requirements: [
        { id: "m1", text: "sterilisation", required: true, keywords: ["sterilisation"] },
        { id: "m2", text: "iso 13485", required: true, keywords: ["iso 13485"] },
        { id: "m3", text: "clinical trial", required: true, keywords: ["clinical trial"] },
        { id: "m4", text: "dispatch rosters", required: true, keywords: ["dispatch rosters"] },
        { id: "p1", text: "fatigue risk management", required: false, keywords: ["fatigue risk management"] },
        { id: "p2", text: "fuel planning", required: false, keywords: ["fuel planning"] },
      ],
      screening: [{ question_id: "q1", question: "Willing to relocate?", required: true, answer_type: "boolean", value: true, disqualifying_condition: null }],
    } as any);
    console.log("floorcap:", JSON.stringify({ raw: r.raw_score, score: r.score, mhc: r.must_have_coverage, caps: r.applied_caps, label: r.fit_label }));
    expect(r.must_have_coverage).toBeLessThan(C.must_have_floor);
    expect(r.raw_score).toBeGreaterThan(C.must_have_floor_cap * 100);
    expect(r.applied_caps.map((c) => c.reason).join()).toContain("must_have_floor");
    expect(r.score).toBe(C.must_have_floor_cap * 100);
  });
});
