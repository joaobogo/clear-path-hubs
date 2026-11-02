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
  isRecruiterOnlyConcern,
  planRecruiterDecision,
  recruiterReviewNotes,
  resolveScoredEligibility,
  type StoredEligibilityCheck,
} from "@/lib/scoring/recruiter-review";
import { displayConcern } from "@/lib/client/contradiction-copy";
import { buildValidationList } from "@/lib/client/validation-list";
import { planEligibilityRecompute } from "@/lib/scoring/screening-eligibility";
import { computePublishReadiness } from "@/lib/scoring/publish-gate";
import { buildReplaySnapshot, fingerprintOf, replayRecruiterChecks } from "@/lib/scoring/replay";
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
    // Recruiter-only: on the staff notes, never in the client-visible concerns.
    expect(recruiterReviewNotes(r).some((n) => n.startsWith(`Screening claim unverified: ${MUSHROOM_QUESTION}`))).toBe(true);
    expect(r.concerns.some((c) => /screening claim unverified/i.test(c))).toBe(false);
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
    // ...and it is a new run, not a reuse of the one that carries the flag.
    expect(reviewed.reviewed_screening_claims).toEqual([Q_MUSHROOM]);
    expect(reviewed.input_hash).not.toBe(r.input_hash);
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
    expect(recruiterReviewNotes(r).join("\n")).not.toContain(MUSHROOM_QUESTION);
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
    // Recruiter wording stays on the staff notes, out of the client's concerns.
    expect(recruiterReviewNotes(r).some((c) => c.startsWith("Dealbreaker answered no; recruiter exception recorded"))).toBe(true);
    expect(r.concerns.some((c) => /recruiter exception/i.test(c))).toBe(false);
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
    // ...while a decision that changes nothing keeps the hash it always had
    // (a "yes" the CV backs: nothing to lift, no flag to suppress).
    expect(score(CV_MUSHROOM, ALL_YES, [excepted(Q_MUSHROOM)]).input_hash).toBe(
      score(CV_MUSHROOM, ALL_YES).input_hash,
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

/** Lab analyst: dated roles, no people management, no mention of English. */
const CV_LAB = [
  "Laboratory Analyst",
  "Professional Experience",
  "Laboratory Analyst, Fenland Soil Labs, Ely — Feb 2021 – Present",
  "Run nutrient and moisture assays on compost samples, calibrate instruments and log results in the LIMS.",
  "Prepare weekly sample reports and flag out-of-range batches to the quality lead.",
  "Sample Technician, Anglia Grain Testing, Cambridge — Jul 2018 – Jan 2021",
  "Collected and prepared grain samples for moisture and protein testing.",
].join("\n");

describe("review follow-ups: 'passed', withdrawn decisions, the English link", () => {
  const passed = (questionId: string): StoredEligibilityCheck => ({
    qualifier_key: `recruiter_review:${questionId}`,
    status: "passed",
    evidence: { question_id: questionId },
  });

  it("'passed' lifts a dealbreaker 'no' exactly as 'excepted' does, and reads 'eligible'", () => {
    const viaPassed = score(CV_FOOD_SCIENCE, MUSHROOM_NO, [passed(Q_MUSHROOM)]);
    const viaExcepted = score(CV_FOOD_SCIENCE, MUSHROOM_NO, [excepted(Q_MUSHROOM)]);
    expect(viaPassed.disqualifying_answers).toEqual([]);
    expect(viaPassed.contradiction_status).not.toBe("disqualifying_answer");
    expect(viaPassed.applied_caps.some((c) => c.reason.startsWith("disqualifying_answer"))).toBe(false);
    expect(viaPassed.score).toBe(viaExcepted.score);
    expect(viaPassed.input_hash).toBe(viaExcepted.input_hash);
    const checks = [passed(Q_MUSHROOM)];
    expect(resolveScoredEligibility({ disqualifying_answers: viaPassed.disqualifying_answers, eligibility_checks: checks })).toEqual({
      status: "eligible",
      decided_by: [`recruiter_review:${Q_MUSHROOM}`],
    });
    // The stored rows and the recompute tool agree before any rescore.
    expect(
      resolveEligibilityFromRows([
        { qualifier_key: `disq:${Q_MUSHROOM}`, qualifier_kind: "disqualifier", status: "failed" },
        { qualifier_key: `recruiter_review:${Q_MUSHROOM}`, qualifier_kind: "disqualifier", status: "passed" },
      ]).status,
    ).toBe("eligible");
    const plan = planEligibilityRecompute({
      current_status: "not_eligible",
      answers: [{ question_id: Q_MUSHROOM, question: MUSHROOM_QUESTION, dealbreaker: true, answer_type: "boolean", preferred_answer: null, value: { value: false } }],
      existing_checks: [
        { qualifier_key: `disq:${Q_MUSHROOM}`, status: "failed" },
        { qualifier_key: `recruiter_review:${Q_MUSHROOM}`, status: "passed", evidence: [] },
      ],
    });
    expect(plan.next_status).toBe("eligible");
    expect(plan.stale_keys).toEqual([`disq:${Q_MUSHROOM}`]);
  });

  it("a withdrawn decision ('unknown') lifts nothing and is not a qualifier awaiting validation", () => {
    const withdrawn: StoredEligibilityCheck = { qualifier_key: `recruiter_review:${Q_MUSHROOM}`, status: "unknown", evidence: [] };
    const r = score(CV_FOOD_SCIENCE, MUSHROOM_NO, [withdrawn]);
    expect(r.disqualifying_answers.map((d) => d.question_id)).toEqual([Q_MUSHROOM]);
    expect(r.score).toBe(15);
    expect(resolveEligibilityFromRows([{ qualifier_key: withdrawn.qualifier_key, qualifier_kind: "disqualifier", status: "unknown" }]).status).toBe(
      "eligible",
    );
  });

  it("does not flag the English answer for want of people-management evidence (Elena)", () => {
    // "Fluent English (written and verbal)" shares only "written" and "verbal"
    // with "...communication skills, written and verbal": not a shared subject.
    const r = score(CV_LAB, ALL_YES);
    expect(r.unverified_screening_claims.map((c) => c.question_id)).not.toContain(Q_ENGLISH);
    expect(recruiterReviewNotes(r).join("\n")).not.toMatch(/fluent in English/);
    // The mushroom claim on the same CV is still flagged: the link works where
    // the subject is shared.
    expect(r.unverified_screening_claims.map((c) => c.question_id)).toContain(Q_MUSHROOM);
  });

  it("still links an English answer to an English requirement the CV does not show", () => {
    const requirements: RequirementInput[] = [
      ...REQUIREMENTS,
      { id: "req-english", text: "Fluent written English for audit reports", required: true, keywords: [] },
    ];
    const r = scoreCandidate({ cv_text: CV_LAB, requirements, screening: screening(ALL_YES) });
    const english = r.unverified_screening_claims.find((c) => c.question_id === Q_ENGLISH);
    expect(english?.requirements).toEqual(["Fluent written English for audit reports"]);
  });
});

describe("the client never sees recruiter wording", () => {
  const lines = [
    `Screening claim unverified: ${MUSHROOM_QUESTION}`,
    `Dealbreaker answered no; recruiter exception recorded: ${MUSHROOM_QUESTION}`,
  ];

  it("the engine's concerns carry neither the flag nor the exception", () => {
    const flagged = score(CV_NO_MUSHROOM, ALL_YES);
    const exceptedRun = score(CV_FOOD_SCIENCE, MUSHROOM_NO, [excepted(Q_MUSHROOM)]);
    for (const r of [flagged, exceptedRun]) {
      expect(r.concerns.filter(isRecruiterOnlyConcern)).toEqual([]);
      expect(r.concerns.join("\n")).not.toMatch(/recruiter exception|screening claim unverified/i);
    }
  });

  it("older stored text is dropped on every client read path", () => {
    for (const l of lines) {
      expect(isRecruiterOnlyConcern(l)).toBe(true);
      expect(displayConcern(l)).toBeNull();
    }
    const items = buildValidationList([], [...lines, "Contradicting evidence for required: Forklift licence"]);
    expect(items.map((i) => i.sentence).join("\n")).not.toMatch(/recruiter exception|screening claim unverified/i);
    // An ordinary concern still shows.
    expect(displayConcern("CV text could not be extracted with confidence.")).toBe("CV text could not be extracted with confidence.");
  });
});

describe("the admin eligibility control writes recruiter_review rows", () => {
  const disqRow = {
    id: "a1111111-1111-4111-8111-111111111111",
    qualifier_key: `disq:${Q_MUSHROOM}`,
    qualifier_label: MUSHROOM_QUESTION,
    qualifier_kind: "disqualifier",
    status: "failed",
    evidence: { question_id: Q_MUSHROOM, value: "no" },
  };
  const flagRow = {
    id: "b2222222-2222-4222-8222-222222222222",
    qualifier_key: `screening_claim_unverified:${Q_MUSHROOM}`,
    qualifier_label: `Screening claim unverified: ${MUSHROOM_QUESTION}`,
    qualifier_kind: "qualifier",
    status: "unknown",
    evidence: { question_id: Q_MUSHROOM, answer: "yes" },
  };

  it("a decision on the engine's disq: row becomes recruiter_review:<question>, never an edit of the engine row", () => {
    const w = planRecruiterDecision({ check: disqRow, status: "excepted", reason: "Bundled question", actor_user_id: "u1", match_checks: [disqRow] });
    expect(w).toEqual({
      kind: "insert",
      row: {
        qualifier_key: `recruiter_review:${Q_MUSHROOM}`,
        qualifier_label: MUSHROOM_QUESTION,
        qualifier_kind: "disqualifier",
        status: "excepted",
        reason: "Bundled question",
        actor_user_id: "u1",
        evidence: { decided_by: "recruiter", question_id: Q_MUSHROOM, source_check: `disq:${Q_MUSHROOM}`, screening_answer: "no" },
      },
    });
    // ...which the engine then honours on the next run.
    const r = score(CV_FOOD_SCIENCE, MUSHROOM_NO, [{ qualifier_key: (w as { row: { qualifier_key: string } }).row.qualifier_key, status: "excepted", evidence: {} }]);
    expect(r.disqualifying_answers).toEqual([]);
  });

  it("a decision on the unverified flag names the question, not the flag", () => {
    const w = planRecruiterDecision({ check: flagRow, status: "passed", reason: "Confirmed by phone", actor_user_id: "u1", match_checks: [flagRow] });
    expect(w.kind).toBe("insert");
    if (w.kind !== "insert") return;
    expect(w.row.qualifier_key).toBe(`recruiter_review:${Q_MUSHROOM}`);
    expect(w.row.qualifier_label).toBe(MUSHROOM_QUESTION);
    expect(w.row.evidence).toMatchObject({ screening_answer: "yes", source_check: flagRow.qualifier_key });
  });

  it("an existing decision on the question is updated in place, whatever its key", () => {
    const live = {
      id: "c3333333-3333-4333-8333-333333333333",
      qualifier_key: "recruiter_review:mushroom-dealbreaker",
      status: "excepted",
      evidence: { question_id: Q_MUSHROOM },
    };
    const w = planRecruiterDecision({ check: disqRow, status: "failed", reason: "No farm work at all", actor_user_id: "u2", match_checks: [disqRow, live] });
    expect(w).toEqual({
      kind: "update",
      id: live.id,
      qualifier_key: live.qualifier_key,
      patch: { status: "failed", reason: "No farm work at all", actor_user_id: "u2" },
    });
    // A recruiter_review row or a staff qualifier is edited in place.
    expect(planRecruiterDecision({ check: live, status: "passed", reason: "Re-checked", actor_user_id: "u2", match_checks: [live] }).kind).toBe("update");
    const staff = { id: "d4444444-4444-4444-8444-444444444444", qualifier_key: "right_to_work", status: "unknown" };
    expect(planRecruiterDecision({ check: staff, status: "passed", reason: "Share code checked", actor_user_id: "u2", match_checks: [staff] })).toMatchObject({
      kind: "update",
      id: staff.id,
    });
  });

  it("refuses an engine row that names no question", () => {
    const bare = { id: "e5555555-5555-4555-8555-555555555555", qualifier_key: "disq:", status: "failed", evidence: [] };
    expect(() => planRecruiterDecision({ check: bare, status: "excepted", reason: "whatever it is", actor_user_id: null, match_checks: [bare] })).toThrow(
      "check_has_no_question",
    );
  });
});

describe("a CV with no dated roles still records the flag and honours the recruiter (Abdul, Chiedza)", () => {
  const ctx: OfflineContext = {
    position: { id: POSITION_ID, requirements: MUST_HAVES.map((label) => ({ label })), preferred_requirements: NICE_TO_HAVES.map((label) => ({ label })) },
    rubric: { id: "05267eed-5042-41b1-aa25-e8fd165b7ea2", calibration: {} },
    role_family: null,
    reason: "test",
  };
  /** Supervision described, no dates anywhere. */
  const CV_UNDATED = [
    "Warehouse Supervisor",
    "Supervised a team of 25 operatives on rotating shifts, including weekends and overtime in peak periods.",
    "Trained new starters in health and safety and handled absence and disciplinary processes.",
    "Planned daily manning and reported KPIs to the site manager.",
  ].join("\n");
  const undated = (answers: Record<string, unknown>, checks: StoredEligibilityCheck[] = [], status = "eligible"): OfflineMatch => ({
    match_id: "3b45fb2e-0000-4000-8000-000000000001",
    application_id: "3b45fb2e-0000-4000-8000-000000000002",
    candidate_profile_id: "3b45fb2e-0000-4000-8000-000000000003",
    position_id: POSITION_ID,
    organization_id: "1def8e51-d266-48a4-8829-065d0201b447",
    eligibility_status: status,
    cv_text: CV_UNDATED,
    location: null,
    city: null,
    country: null,
    answers: QUESTIONS.filter((q) => q.id in answers).map((q) => ({
      question_id: q.id,
      answer: { value: answers[q.id] },
      q: { question: q.question, answer_type: q.answer_type, required: q.required, dealbreaker: q.dealbreaker, preferred_answer: null, must_have: q.must_have },
    })),
    eligibility_checks: checks,
  });

  it("writes the screening_claim_unverified row ('unknown') and keeps the match eligible, with no run", () => {
    const out = offlineRescore(undated(ALL_YES), ctx, { trace_id: "sc_test" });
    expect(out.kind).toBe("no_dated_roles");
    if (out.kind !== "no_dated_roles") return;
    expect(out.unverified_claims).toContain(Q_MUSHROOM);
    expect(out.eligibility).toBe("eligible");
    expect(out.eligibility_sql).toContain(`screening_claim_unverified:${Q_MUSHROOM}`);
    expect(out.eligibility_sql).toMatch(/'qualifier', 'unknown'/);
    expect(out.eligibility_sql).toContain("eligibility_status = 'eligible'");
    expect(out.eligibility_sql).toMatch(/recruiter decisions changed since export/);
    expect(out.eligibility_sql).toMatch(/CV text changed since export/);
    // The eligibility block alone never touches the score pointer or a run.
    expect(out.eligibility_sql).not.toMatch(/current_score_run_id|score_runs/);
    expect(out.eligibility_sql).not.toMatch(/INSERT INTO eligibility_checks[^;]*recruiter_review/);
    // The full statement still marks the document incomplete.
    expect(out.sql).toContain(out.eligibility_sql);
    expect(out.sql).toMatch(/current_score_run_id = NULL, processing_state = 'manual_review_required'/);
  });

  it("a recruiter exception lifts the 'no'; a recruiter 'failed' is not_eligible", () => {
    const ex = offlineRescore(undated(MUSHROOM_NO, [excepted(Q_MUSHROOM)], "not_eligible"), ctx, { trace_id: "sc_test" });
    expect(ex.kind === "no_dated_roles" && ex.eligibility).toBe("excepted");
    if (ex.kind !== "no_dated_roles") return;
    expect(ex.eligibility_sql).not.toMatch(/'disq:/);
    expect(ex.eligibility_sql).toContain("'scoring.eligibility_changed'");

    const failed = offlineRescore(
      undated(ALL_YES, [{ qualifier_key: "recruiter_review:student_work_only", status: "failed", evidence: {} }]),
      ctx,
      { trace_id: "sc_test" },
    );
    expect(failed.kind === "no_dated_roles" && failed.eligibility).toBe("not_eligible");
  });
});

describe("replay reproduces a run whose flag a recruiter decision suppressed", () => {
  it("stores the suppressed question and rebuilds the same hash", () => {
    const checks: StoredEligibilityCheck[] = [{ qualifier_key: `recruiter_review:${Q_MUSHROOM}`, status: "failed", evidence: [] }];
    const r = score(CV_NO_MUSHROOM, ALL_YES, checks);
    expect(r.reviewed_screening_claims).toEqual([Q_MUSHROOM]);
    const snap = buildReplaySnapshot({
      cv_text: CV_NO_MUSHROOM,
      requirements: REQUIREMENTS,
      screening: screening(ALL_YES),
      recruiter_exceptions: r.recruiter_exceptions.map((x) => x.question_id),
      reviewed_claims: r.reviewed_screening_claims,
    });
    expect(snap.reviewed_claims).toEqual([Q_MUSHROOM]);
    const replayed = scoreCandidate({
      cv_text: snap.cv_text,
      requirements: snap.requirements,
      screening: snap.screening as ScreeningAnswer[],
      eligibility_checks: replayRecruiterChecks(snap),
    });
    expect(fingerprintOf(replayed)).toEqual(fingerprintOf(r));
    expect("reviewed_claims" in buildReplaySnapshot({ cv_text: "x", requirements: [], screening: [] })).toBe(false);
  });
});
