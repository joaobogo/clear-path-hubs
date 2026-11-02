/**
 * Hughes Mushrooms "Mushroom Harvesting Manager" (research, 2 Nov).
 *
 * (a) A "yes" to a dealbreaker with nothing on the CV passed as fully
 *     eligible (Thaddeus, Daim, Abdul said yes to mushroom experience; their
 *     CVs show none). Owner guidance: they STAY eligible, so the client can
 *     see them once approved, and the claim is flagged "screening claim
 *     unverified" for the recruiter. The flag never moves the score or the
 *     eligibility.
 *
 * (b) Anna Brintha and Vijay Mane answered "no" to the bundled dealbreaker
 *     (picking AND supervision) and were capped to 15, not_eligible. The
 *     engine ignored the recruiter's exception. A recruiter_review row now
 *     always wins: 'excepted' scores them normally (eligibility 'excepted',
 *     run publishable) while the "no" still counts as a gap; 'failed' is
 *     not_eligible whatever the answers.
 *
 * The CVs are synthetic, shaped like the research's descriptions; the
 * questions, must-have links and requirements are the role's own.
 */
import { describe, expect, it } from "vitest";
import { scoreCandidate, type RequirementInput, type ScreeningAnswer } from "@/lib/scoring-engine.server";
import { dealbreakerCondition, resolveEligibilityFromRows } from "@/lib/scoring/eligibility";
import {
  engineCheckRows,
  resolveScoredEligibility,
  type StoredEligibilityCheck,
} from "@/lib/scoring/recruiter-review";
import { planEligibilityRecompute } from "@/lib/scoring/screening-eligibility";
import { computePublishReadiness } from "@/lib/scoring/publish-gate";
import { buildReplaySnapshot, fingerprintOf } from "@/lib/scoring/replay";
import {
  offlineRescore,
  recruiterReviewFingerprintText,
  type OfflineContext,
  type OfflineMatch,
} from "@/lib/scoring/offline-rescore";

const POSITION_ID = "9466d8ac-0b74-4b14-94e9-0e9d56021fa2";
const Q_MUSHROOM = "7da77185-54dc-4fd9-89ea-1f960fee0fdb";
const Q_ROTA = "9816fc81-6e28-4d8e-815d-ee86f37b1f2c";
const Q_ENGLISH = "7b815ce0-7af7-45ba-a4b5-34e7044ded23";
const Q_VISA = "c5b1023e-0b34-40be-b352-ceda257589d6";
const Q_HYGIENE = "4b294949-8742-4fcd-847a-2e2823fca88a";

const MUSHROOM_QUESTION =
  "Do you have direct, hands-on mushroom picking experience as well as supervisory experience on a commercial mushroom farm?";

const MUST_HAVES = [
  "Hands-on mushroom picking experience",
  "Previous supervisory experience on a mushroom farm",
  "Strong people management and communication skills, written and verbal",
  "Excellent organisational and interpersonal skills",
  "Good basic IT and numerical skills",
  "Flexible approach to working hours, including weekends and peak overtime",
];
const NICE_TO_HAVES = [
  "Previous experience as a Harvesting Manager in the mushroom industry",
  "Experience managing pick rates, manning plans and agency labour",
  "Food safety team experience (HACCP, TACCP, VACCP, BRC)",
  "Advanced Food Hygiene qualification",
  "Degree-level education",
];
const REQUIREMENTS: RequirementInput[] = [
  ...MUST_HAVES.map((text, i) => ({ id: `req-${i}`, text, required: true, keywords: [] })),
  ...NICE_TO_HAVES.map((text, i) => ({ id: `pref-${i}`, text, required: false, keywords: [] })),
];

type Q = {
  id: string;
  question: string;
  answer_type: string;
  required: boolean;
  dealbreaker: boolean;
  must_have: string;
};
const QUESTIONS: Q[] = [
  {
    id: Q_MUSHROOM,
    question: MUSHROOM_QUESTION,
    answer_type: "boolean",
    required: true,
    dealbreaker: true,
    must_have: "Hands-on mushroom picking experience and supervisory experience on a mushroom farm",
  },
  {
    id: Q_ROTA,
    question:
      "Are you able to work 100% onsite in Holme-on-Spalding-Moor on a 5-days-out-of-7 rota, including weekends and overtime during peak periods?",
    answer_type: "boolean",
    required: true,
    dealbreaker: true,
    must_have: "Full onsite availability on a 5-out-of-7 rota including weekends",
  },
  {
    id: Q_ENGLISH,
    question:
      "Are you fluent in English, both written and spoken, to deliver staff training, disciplinary processes, and cross-departmental coordination?",
    answer_type: "boolean",
    required: true,
    dealbreaker: true,
    must_have: "Fluent English (written and verbal)",
  },
  {
    id: Q_VISA,
    question: "What is your current UK work authorization status?",
    answer_type: "single_choice",
    required: true,
    dealbreaker: false,
    must_have: "Right to work in the UK or eligibility for employer visa sponsorship",
  },
  {
    id: Q_HYGIENE,
    question:
      "Do you hold an Advanced Food Hygiene qualification or direct experience participating in HACCP/TACCP/VACCP food safety teams?",
    answer_type: "boolean",
    required: false,
    dealbreaker: false,
    must_have: "Food safety compliance and HACCP awareness",
  },
];

/** Answers keyed by question id; the shape loadInputs hands the engine. */
function screening(answers: Record<string, unknown>): ScreeningAnswer[] {
  return QUESTIONS.filter((q) => q.id in answers).map((q) => ({
    question_id: q.id,
    question: q.question,
    required: q.required,
    answer_type: q.answer_type,
    value: answers[q.id],
    disqualifying_condition: dealbreakerCondition({
      dealbreaker: q.dealbreaker,
      answer_type: q.answer_type,
      preferred_answer: null,
    }),
    must_have: q.must_have,
  }));
}

const ALL_YES = {
  [Q_MUSHROOM]: true,
  [Q_ROTA]: true,
  [Q_ENGLISH]: true,
  [Q_VISA]: "I need sponsorship",
  [Q_HYGIENE]: false,
};
const MUSHROOM_NO = { ...ALL_YES, [Q_MUSHROOM]: false };

/** Shift operations manager: real supervision, no mushroom or picking work. */
const CV_NO_MUSHROOM = [
  "Shift Operations Manager",
  "Professional Experience",
  "Shift Operations Manager, Northern Recycling Services Ltd, Leeds — Mar 2019 – Present",
  "Lead 120 frontline staff across three shifts, owning rotas, training, absence management and disciplinary processes.",
  "Plan daily manning against throughput targets and report KPIs to the site director every week.",
  "Team Leader, Westgate Logistics, Bradford — Jun 2014 – Feb 2019",
  "Supervised a warehouse team of 30 operatives and coached new starters on health and safety procedures.",
  "Education: IOSH Managing Safely; Diploma in Business Management.",
].join("\n");

/** A harvest supervisor whose CV shows the mushroom work. */
const CV_MUSHROOM = [
  "Harvest Supervisor",
  "Professional Experience",
  "Harvest Supervisor, Greenvale Mushrooms Ltd, Lincolnshire — Apr 2017 – Present",
  "Supervise mushroom picking teams of 40 pickers on a commercial mushroom farm, setting pick rates and checking quality on every shift.",
  "Hands-on mushroom picking for two seasons before promotion; train new pickers in grading and trimming.",
  "Mushroom Picker, Greenvale Mushrooms Ltd, Lincolnshire — Mar 2015 – Mar 2017",
  "Picked and packed mushrooms to specification; covered weekend and overtime shifts in peak periods.",
].join("\n");

/** Food scientist: QA and lab work, no harvesting or farm supervision. */
const CV_FOOD_SCIENCE = [
  "Food Scientist",
  "Professional Experience",
  "Quality Technician, Syngrow Seeds UK, Cambridge — Sep 2022 – Present",
  "Run HACCP checks and BRC audit preparation for glasshouse trials; maintain lab records and train two junior technicians.",
  "Coordinate sampling schedules with growers and write weekly quality reports for the site manager.",
  "Laboratory Assistant, FreshLine Foods, Peterborough — Jan 2020 – Aug 2022",
  "Microbiology testing, FSSC 22000 documentation and supplier quality follow-up.",
  "Education: MSc Food Science.",
].join("\n");

const excepted = (questionId: string, keyed: "evidence" | "key" = "evidence"): StoredEligibilityCheck =>
  keyed === "evidence"
    ? { qualifier_key: "recruiter_review:mushroom-dealbreaker", status: "excepted", evidence: { question_id: questionId } }
    : { qualifier_key: `recruiter_review:${questionId}`, status: "excepted", evidence: [] };

function score(cv: string, answers: Record<string, unknown>, checks: StoredEligibilityCheck[] = []) {
  return scoreCandidate({
    cv_text: cv,
    requirements: REQUIREMENTS,
    screening: screening(answers),
    eligibility_checks: checks,
  });
}

describe("(a) a dealbreaker 'yes' the CV does not back is flagged, never excluded", () => {
  it("flags the mushroom claim of a candidate whose CV shows no mushroom work", () => {
    const r = score(CV_NO_MUSHROOM, ALL_YES);
    const claim = r.unverified_screening_claims.find((c) => c.question_id === Q_MUSHROOM);
    expect(claim).toBeDefined();
    expect(claim!.requirements).toContain("Hands-on mushroom picking experience");
    expect(r.concerns).toContain(`Screening claim unverified: ${MUSHROOM_QUESTION}`);
  });

  it("leaves the candidate eligible and the score untouched", () => {
    const r = score(CV_NO_MUSHROOM, ALL_YES);
    expect(r.disqualifying_answers).toEqual([]);
    expect(r.contradiction_status).not.toBe("disqualifying_answer");
    expect(r.applied_caps.some((c) => c.reason.startsWith("disqualifying_answer"))).toBe(false);
    expect(resolveScoredEligibility({ disqualifying_answers: r.disqualifying_answers, eligibility_checks: [] }).status).toBe(
      "eligible",
    );
    // A recruiter who checked the claim clears the flag; the number is the same.
    const reviewed = score(CV_NO_MUSHROOM, ALL_YES, [
      { qualifier_key: `recruiter_review:${Q_MUSHROOM}`, status: "passed", evidence: [] },
    ]);
    expect(reviewed.unverified_screening_claims).toEqual([]);
    expect(reviewed.score).toBe(r.score);
    expect(reviewed.input_hash).toBe(r.input_hash);
  });

  it("records an advisory eligibility check, never a gate", () => {
    const r = score(CV_NO_MUSHROOM, ALL_YES);
    const row = engineCheckRows(r).find((c) => c.qualifier_key === `screening_claim_unverified:${Q_MUSHROOM}`);
    expect(row).toMatchObject({ status: "unknown", qualifier_kind: "qualifier" });
    expect(row!.qualifier_label).toBe(`Screening claim unverified: ${MUSHROOM_QUESTION}`);
    expect(row!.reason).toMatch(/no evidence of: .*Hands-on mushroom picking experience/);
    expect(engineCheckRows(r).some((c) => c.status === "failed")).toBe(false);
    // The stored row does not make the match needs_validation either.
    expect(resolveEligibilityFromRows([{ qualifier_key: row!.qualifier_key, qualifier_kind: "qualifier", status: "unknown" }]).status).toBe(
      "eligible",
    );
  });

  it("judges the CV, not the answer: a CV that shows the work raises no flag", () => {
    const r = score(CV_MUSHROOM, ALL_YES);
    expect(r.unverified_screening_claims.map((c) => c.question_id)).not.toContain(Q_MUSHROOM);
    expect(r.concerns).not.toContain(`Screening claim unverified: ${MUSHROOM_QUESTION}`);
  });

  it("does not flag a 'no', or a question that is not a dealbreaker", () => {
    const r = score(CV_NO_MUSHROOM, { ...ALL_YES, [Q_MUSHROOM]: false, [Q_HYGIENE]: true });
    expect(r.unverified_screening_claims.map((c) => c.question_id)).not.toContain(Q_MUSHROOM);
    expect(r.unverified_screening_claims.map((c) => c.question_id)).not.toContain(Q_HYGIENE);
  });
});

describe("(b) a recruiter decision always wins over the dealbreaker answer", () => {
  it("without a decision, the 'no' still disqualifies (today's behaviour)", () => {
    const r = score(CV_FOOD_SCIENCE, MUSHROOM_NO);
    expect(r.disqualifying_answers.map((d) => d.question_id)).toEqual([Q_MUSHROOM]);
    expect(r.contradiction_status).toBe("disqualifying_answer");
    expect(r.score).toBe(15);
    expect(resolveScoredEligibility({ disqualifying_answers: r.disqualifying_answers, eligibility_checks: [] }).status).toBe(
      "not_eligible",
    );
  });

  it.each(["evidence", "key"] as const)("an excepted row (question id in %s) scores Anna/Vijay normally", (keyed) => {
    const checks = [excepted(Q_MUSHROOM, keyed)];
    const r = score(CV_FOOD_SCIENCE, MUSHROOM_NO, checks);
    expect(r.disqualifying_answers).toEqual([]);
    expect(r.recruiter_exceptions.map((x) => x.question_id)).toEqual([Q_MUSHROOM]);
    expect(r.contradiction_status).not.toBe("disqualifying_answer");
    expect(r.applied_caps.some((c) => c.reason.startsWith("disqualifying_answer"))).toBe(false);
    expect(r.score).toBeGreaterThan(15);
    expect(r.concerns.some((c) => c.startsWith("Dealbreaker answered no; recruiter exception recorded"))).toBe(true);
    expect(resolveScoredEligibility({ disqualifying_answers: r.disqualifying_answers, eligibility_checks: checks }).status).toBe(
      "excepted",
    );
    // No disq: row is written for the excepted answer, so the old one is cleaned up.
    expect(engineCheckRows(r).some((c) => c.qualifier_key.startsWith("disq:"))).toBe(false);
    // The run passes the publish gate's contradiction check.
    const readiness = computePublishReadiness(
      { approved_score_run_id: "x", canonical_state: "approved", integrity_status: "ok", eligibility_status: "excepted", recommendation: "review" },
      { status: "completed", rubric_version_id: "rv", contradiction_status: r.contradiction_status, final_score: r.score, applied_cap: null, raw_score: r.raw_score },
      true,
    );
    expect(readiness.checks.find((c) => c.id === "no_disqualifying_contradiction")!.ok).toBe(true);
  });

  it("the excepted 'no' still counts as a gap: it never earns the credit a 'yes' would", () => {
    const exceptedNo = score(CV_FOOD_SCIENCE, MUSHROOM_NO, [excepted(Q_MUSHROOM)]);
    const yes = score(CV_FOOD_SCIENCE, ALL_YES);
    expect(exceptedNo.score).toBeLessThan(yes.score);
    expect(exceptedNo.category_breakdown.screening_alignment).toBeLessThan(yes.category_breakdown.screening_alignment);
    const picking = exceptedNo.requirement_assessment.find((a) => a.text === "Hands-on mushroom picking experience")!;
    expect(picking.status).not.toBe("met");
    expect(picking.evidence.some((e) => e.location === `screening:${Q_MUSHROOM}`)).toBe(false);
  });

  it("a rescore with the exception is a new run, not a reuse of the capped one", () => {
    expect(score(CV_FOOD_SCIENCE, MUSHROOM_NO, [excepted(Q_MUSHROOM)]).input_hash).not.toBe(
      score(CV_FOOD_SCIENCE, MUSHROOM_NO).input_hash,
    );
    // ...while a candidate with no exception keeps the hash it always had.
    expect(score(CV_FOOD_SCIENCE, ALL_YES, [excepted(Q_MUSHROOM)]).input_hash).toBe(
      score(CV_FOOD_SCIENCE, ALL_YES).input_hash,
    );
  });

  it("a recruiter 'failed' is not_eligible whatever the answers", () => {
    const checks: StoredEligibilityCheck[] = [{ qualifier_key: "recruiter_review:no_mushroom_work", status: "failed", evidence: {} }];
    const r = score(CV_MUSHROOM, ALL_YES, checks);
    expect(r.disqualifying_answers).toEqual([]);
    expect(resolveScoredEligibility({ disqualifying_answers: r.disqualifying_answers, eligibility_checks: checks })).toEqual({
      status: "not_eligible",
      decided_by: ["recruiter_review:no_mushroom_work"],
    });
  });

  it("only recruiter_review rows decide: an outreach 'excepted' row lifts nothing", () => {
    const r = score(CV_FOOD_SCIENCE, MUSHROOM_NO, [
      { qualifier_key: "outreach_contact_suppression", status: "excepted", evidence: { question_id: Q_MUSHROOM } },
    ]);
    expect(r.contradiction_status).toBe("disqualifying_answer");
    expect(r.score).toBe(15);
  });

  it("a replay from the stored snapshot reproduces the excepted run", () => {
    const r = score(CV_FOOD_SCIENCE, MUSHROOM_NO, [excepted(Q_MUSHROOM)]);
    const snap = buildReplaySnapshot({
      cv_text: CV_FOOD_SCIENCE,
      requirements: REQUIREMENTS,
      screening: screening(MUSHROOM_NO),
      recruiter_exceptions: r.recruiter_exceptions.map((x) => x.question_id),
    });
    expect(snap.recruiter_exceptions).toEqual([Q_MUSHROOM]);
    const replayed = scoreCandidate({
      cv_text: snap.cv_text,
      requirements: snap.requirements,
      screening: snap.screening as ScreeningAnswer[],
      eligibility_checks: (snap.recruiter_exceptions ?? []).map((id) => ({ qualifier_key: `recruiter_review:${id}`, status: "excepted" })),
    });
    expect(fingerprintOf(replayed)).toEqual(fingerprintOf(r));
    // A snapshot without exceptions keeps its old shape.
    expect("recruiter_exceptions" in buildReplaySnapshot({ cv_text: "x", requirements: [], screening: [] })).toBe(false);
  });

  it("the stored-row reading honours the exception before the rescore runs", () => {
    const rows = [
      { qualifier_key: `disq:${Q_MUSHROOM}`, qualifier_kind: "disqualifier", status: "failed" },
      { qualifier_key: `recruiter_review:${Q_MUSHROOM}`, qualifier_kind: "disqualifier", status: "excepted" },
    ];
    expect(resolveEligibilityFromRows(rows).status).toBe("excepted");
  });

  it("the eligibility recompute tool keeps the recruiter's decision", () => {
    const answers = [
      { question_id: Q_MUSHROOM, question: MUSHROOM_QUESTION, dealbreaker: true, answer_type: "boolean", preferred_answer: null, value: { value: false } },
    ];
    const plan = planEligibilityRecompute({
      current_status: "not_eligible",
      answers,
      existing_checks: [
        { qualifier_key: `disq:${Q_MUSHROOM}`, status: "failed" },
        { qualifier_key: "recruiter_review:mushroom", status: "excepted", evidence: { question_id: Q_MUSHROOM } },
      ],
    });
    expect(plan.next_status).toBe("excepted");
    expect(plan.upserts).toEqual([]);
    expect(plan.stale_keys).toEqual([`disq:${Q_MUSHROOM}`]);

    const failed = planEligibilityRecompute({
      current_status: "excepted",
      answers: [{ ...answers[0]!, value: { value: true } }],
      existing_checks: [{ qualifier_key: "recruiter_review:x", status: "failed" }],
    });
    expect(failed.next_status).toBe("not_eligible");
  });
});

describe("offline rescore carries recruiter decisions and the unverified flag", () => {
  const ctx: OfflineContext = {
    position: { id: POSITION_ID, requirements: MUST_HAVES.map((label) => ({ label })), preferred_requirements: NICE_TO_HAVES.map((label) => ({ label })) },
    rubric: { id: "05267eed-5042-41b1-aa25-e8fd165b7ea2", calibration: {} },
    role_family: null,
    reason: "test",
  };
  const match = (cv: string, answers: Record<string, unknown>, checks?: StoredEligibilityCheck[]): OfflineMatch => ({
    match_id: "8dd2623c-54e4-4aeb-ab91-b9a4f05f1b4a",
    application_id: "3bfa31dc-91f7-4d42-b332-a7719f75e0cd",
    candidate_profile_id: "07e94312-81fd-4f0c-9d2d-582d42fb31a9",
    position_id: POSITION_ID,
    organization_id: "1def8e51-d266-48a4-8829-065d0201b447",
    eligibility_status: "not_eligible",
    cv_text: cv,
    location: null,
    city: null,
    country: null,
    answers: QUESTIONS.filter((q) => q.id in answers).map((q) => ({
      question_id: q.id,
      answer: { value: answers[q.id] },
      q: { question: q.question, answer_type: q.answer_type, required: q.required, dealbreaker: q.dealbreaker, preferred_answer: null, must_have: q.must_have },
    })),
    ...(checks ? { eligibility_checks: checks } : {}),
  });

  it("scores the excepted candidate as excepted and never touches the recruiter row", () => {
    const checks = [excepted(Q_MUSHROOM)];
    const out = offlineRescore(match(CV_FOOD_SCIENCE, MUSHROOM_NO, checks), ctx, { run_id: "11111111-1111-4111-8111-111111111111", trace_id: "sc_test" });
    expect(out.kind).toBe("scored");
    if (out.kind !== "scored") return;
    expect(out.score).toBeGreaterThan(15);
    expect(out.sql).toContain("eligibility_status = 'excepted'");
    expect(out.sql).not.toContain("'disqualifying_answer'");
    // The only eligibility_checks statement naming recruiter_review is the
    // guard that refuses the write when the decisions changed after export.
    const lines = out.sql.split("\n").filter((l) => l.includes("recruiter_review") && l.includes("eligibility_checks"));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^\s*IF \(SELECT md5\(.*recruiter decisions changed since export/);
    expect(out.sql).not.toMatch(/INSERT INTO eligibility_checks[^;]*recruiter_review/);
    // Clean-up reaches only the engine's own prefixes.
    expect(out.sql).toMatch(/DELETE FROM eligibility_checks WHERE candidate_match_id = '[^']+' AND \(starts_with\(qualifier_key, \$p\$disq:\$p\$\) OR starts_with\(qualifier_key, \$p\$screening_claim_unverified:\$p\$\)\)/);
  });

  it("writes the unverified flag as an 'unknown' check and keeps the match eligible", () => {
    const out = offlineRescore(match(CV_NO_MUSHROOM, ALL_YES, []), ctx);
    expect(out.kind).toBe("scored");
    if (out.kind !== "scored") return;
    expect(out.sql).toContain(`screening_claim_unverified:${Q_MUSHROOM}`);
    expect(out.sql).toMatch(/'qualifier', 'unknown'/);
    expect(out.sql).toContain("eligibility_status = 'eligible'");
  });

  it("fingerprints the recruiter rows the way the SQL rebuilds them", () => {
    expect(recruiterReviewFingerprintText(undefined)).toBe("");
    expect(
      recruiterReviewFingerprintText([
        { qualifier_key: "recruiter_review:b", status: "failed", evidence: [] },
        { qualifier_key: `disq:${Q_MUSHROOM}`, status: "failed", evidence: { question_id: Q_MUSHROOM } },
        { qualifier_key: "recruiter_review:a", status: "excepted", evidence: { question_id: Q_MUSHROOM } },
      ]),
    ).toBe(`recruiter_review:a=excepted=${Q_MUSHROOM}|recruiter_review:b=failed=`);
  });
});
