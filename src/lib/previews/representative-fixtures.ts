/**
 * Centralised representative-data fixtures for public product previews.
 *
 * Rules held here:
 *  - Nothing in this file touches the database, Supabase, or any server
 *    function. It is a static module, imported only by marketing previews.
 *  - No real candidate, client, or account information. People are referred to
 *    by anonymised reference ("Candidate ref 4F2K9Q"), never by name, email,
 *    phone, employer, or link.
 *  - Every consumer renders REPRESENTATIVE_LABEL / REPRESENTATIVE_NOTICE so a
 *    preview can never be mistaken for a live account.
 *  - Shapes are the real product types, so previews render through the same
 *    components as the authenticated workspace.
 */
import type { IntelligenceMetric } from "@/lib/intelligence/hiring-intelligence";
import type { RoleLifecycle } from "@/lib/role-lifecycle/role-lifecycle";
import { REPRESENTATIVE_CHAIN } from "@/lib/evidence/evidence-graph";

export const REPRESENTATIVE_LABEL = "Example data";

export const REPRESENTATIVE_NOTICE =
  "Example data: a worked example of the product, not a live account. No real candidate information is shown.";

/** The one role every preview on the marketing site talks about. */
export const PREVIEW_ROLE = {
  title: "Senior Platform Engineer",
  reference: "Example role",
  rubric: "Criteria locked",
} as const;

/** Reused so the evidence preview and the workspace preview agree. */
export const PREVIEW_EVIDENCE_CHAIN = REPRESENTATIVE_CHAIN;

// ── Decision queue ───────────────────────────────────────────────────────────

export type PreviewCandidate = {
  ref: string;
  score: number;
  band: "Top fit" | "Strong fit" | "Consider";
  stage: string;
  requirementsMet: string;
  evidence: string[];
  gap: string;
};

/**
 * The one score the top example candidate carries on every marketing surface
 * (home hero, decision preview, risk-proof panel). Change it here only.
 */
export const PREVIEW_TOP_SCORE = 94;

export const PREVIEW_DECISION_QUEUE: PreviewCandidate[] = [
  {
    ref: "Candidate ref 4F2K9Q",
    score: PREVIEW_TOP_SCORE,
    band: "Top fit",
    stage: "Awaiting your decision",
    requirementsMet: "7 of 8 requirements evidenced",
    evidence: [
      "Ran a 42-service Kubernetes platform across 3 regions for six years.",
      "Escalation owner on a customer-facing on-call rotation.",
    ],
    gap: "No SOC 2 audit experience found in the CV.",
  },
  {
    ref: "Candidate ref 8HD3TW",
    score: 84,
    band: "Strong fit",
    stage: "Awaiting your decision",
    requirementsMet: "6 of 8 requirements evidenced",
    evidence: [
      "Migrated a monolith to managed Kubernetes over two quarters.",
      "Wrote the infrastructure-as-code standard adopted by four teams.",
    ],
    gap: "Team-leadership evidence is partial — one quote, no scope.",
  },
  {
    ref: "Candidate ref 2QL7BM",
    score: 76,
    band: "Consider",
    stage: "In review by TaaSFlow",
    requirementsMet: "5 of 8 requirements evidenced",
    evidence: ["Strong reliability work, mostly on internal-only services."],
    gap: "Production scale is below the blueprint threshold.",
  },
];

// ── The run, as four counts ──────────────────────────────────────────────────

/**
 * The funnel is always four numbers in one order: reached, matched, scored,
 * signed. The same words in the hero, the email and the role page. These are
 * the representative run drawn on the homepage; the first three are agent
 * work (blue), the last is a person's (ink).
 */
export type RunStage = "reached" | "matched" | "scored" | "signed";

export const PREVIEW_RUN_FUNNEL: readonly { key: RunStage; label: string; count: number }[] = [
  { key: "reached", label: "Reached", count: 6_240 },
  { key: "matched", label: "Matched", count: 418 },
  { key: "scored", label: "Scored", count: 64 },
  { key: "signed", label: "Signed", count: 10 },
];

/** Time is "Day n, hh:mm" from the approved brief; the list is signed on day 5. */
export const PREVIEW_RUN_SIGNED_AT = "Day 5, 09:00" as const;

// ── Agent runs ───────────────────────────────────────────────────────────────

export type PreviewAgentRun = {
  agent: string;
  status: "Running" | "Complete" | "Waiting";
  detail: string;
  at: string;
  result: string;
};

export const PREVIEW_AGENT_RUNS: PreviewAgentRun[] = [
  {
    agent: "Blueprint agent",
    status: "Complete",
    detail: "Compiled 8 requirements from intake + JD",
    at: "09:02",
    result: "Criteria locked",
  },
  {
    agent: "Discovery agent",
    status: "Running",
    detail: "418 profiles assessed against the blueprint",
    at: "09:14",
    result: "26 shortlisted for screening",
  },
  {
    agent: "Evidence agent",
    status: "Running",
    detail: "26 CVs parsed · quotes attached to 21",
    at: "09:31",
    result: "5 need reviewer confirmation",
  },
  {
    agent: "Scoring agent",
    status: "Complete",
    detail: "12 scored against the approved criteria",
    at: "09:41",
    result: "Score run written to audit trail",
  },
  {
    agent: "Coordination agent",
    status: "Complete",
    detail: "2 outreach messages sent",
    at: "09:46",
    result: "Replies land in one conversation",
  },
];

// ── Intelligence metrics ─────────────────────────────────────────────────────

const FRESHNESS = {
  latestAt: "2026-08-03T09:41:00.000Z",
  computedAt: "2026-08-03T09:45:00.000Z",
  staleAfterDays: 14,
};

/**
 * Three metrics that show three different honest states: a live number, a
 * partial-sample number, and a "not enough data" state. Previews must show the
 * states the real product shows, not only the happy path.
 */
export const PREVIEW_METRICS: IntelligenceMetric[] = [
  {
    key: "preview-time-to-first-qualified",
    title: "Time to first qualified candidate",
    question: "How long until this role has someone worth a conversation?",
    status: "ok",
    statusReason: null,
    value: "4.2 days",
    valueNote: "median across 6 example roles",
    tone: "good",
    comparison: {
      baselineLabel: "previous example window",
      baselineValue: "9.1 days",
      delta: "-4.9 days",
      direction: "down",
      tone: "good",
    },
    freshness: FRESHNESS,
    explanation:
      "Measured from the moment a blueprint is locked to the first evidence-backed candidate delivered for review.",
    action: null,
    link: null,
    chart: {
      kind: "bars",
      unit: "days",
      valueHeading: "Days to first qualified candidate",
      points: [
        { key: "a", label: "Role A", value: 3.1, tone: "good" },
        { key: "b", label: "Role B", value: 4.2, tone: "good" },
        { key: "c", label: "Role C", value: 5.8, tone: "neutral" },
        { key: "d", label: "Role D", value: 9.4, tone: "warn" },
      ],
    },

    sample: { counted: 6, expected: 6, unit: "roles" },
  },
  {
    key: "preview-evidence-coverage",
    title: "Evidence coverage",
    question: "How much of the scoring is backed by a quote from the source?",
    status: "partial",
    statusReason: "21 of 26 assessments have a verified quote attached.",
    value: "81%",
    valueNote: "of scored requirements carry a source quote",
    tone: "warn",
    comparison: null,
    freshness: FRESHNESS,
    explanation:
      "Requirements without a quote are never counted as met — they surface for reviewer confirmation instead.",
    action: {
      label: "Review unverified evidence",
      detail: "5 assessments are waiting on a reviewer.",
      link: null,
    },
    link: null,
    chart: null,
    sample: { counted: 21, expected: 26, unit: "assessments" },
  },
  {
    key: "preview-dropout",
    title: "Where candidates drop out",
    question: "Which stage is losing the people you want?",
    status: "insufficient",
    statusReason: "Fewer than 5 completed decisions in this example window.",
    value: null,
    valueNote: null,
    tone: "neutral",
    comparison: null,
    freshness: FRESHNESS,
    explanation:
      "Drop-out is only reported once there are enough decisions to be meaningful. Until then the product says so instead of drawing a chart.",
    action: null,
    link: null,
    chart: null,
    sample: { counted: 3, expected: 5, unit: "decisions" },
  },
];

// ── Role lifecycle ───────────────────────────────────────────────────────────

export const PREVIEW_LIFECYCLE: RoleLifecycle = {
  positionId: "preview-role",
  title: PREVIEW_ROLE.title,
  statusLabel: "Live · candidates in review",
  inactive: false,
  currentIndex: 5,
  caption: "Review · waiting on your team since 3 Aug",
  attentionCount: 3,
  stages: [
    {
      key: "intake",
      label: "Intake",
      summary: "You describe the role, the must-haves and the constraints.",
      state: "completed",
      stateLabel: "Completed",
      owner: "Your team",
      ownerKind: "client",
      startedAt: "2026-07-27T09:00:00.000Z",
      completedAt: "2026-07-27T09:18:00.000Z",
      inputs: ["Role brief", "Job description upload"],
      outputs: ["Structured intake record"],
      blockers: [],
      pendingApprovals: [],
      nextAction: null,
    },
    {
      key: "blueprint",
      label: "Blueprint",
      summary: "Requirements are compiled into a scoreable rubric.",
      state: "completed",
      stateLabel: "Completed",
      owner: "Blueprint agent",
      ownerKind: "agent",
      startedAt: "2026-07-27T09:20:00.000Z",
      completedAt: "2026-07-27T09:24:00.000Z",
      inputs: ["Intake record", "Job description"],
      outputs: ["8 requirements", "Approved criteria (locked)"],
      blockers: [],
      pendingApprovals: [],
      nextAction: null,
    },
    {
      key: "discovery",
      label: "Discovery",
      summary: "Agents search for people who match the blueprint.",
      state: "completed",
      stateLabel: "Completed",
      owner: "Discovery agent",
      ownerKind: "agent",
      startedAt: "2026-07-28T08:00:00.000Z",
      completedAt: "2026-07-31T17:00:00.000Z",
      inputs: ["Approved criteria"],
      outputs: ["418 profiles assessed", "26 taken to screening"],
      blockers: [],
      pendingApprovals: [],
      nextAction: null,
    },
    {
      key: "evidence",
      label: "Evidence",
      summary: "Each requirement is matched to a quote from the source.",
      state: "active",
      stateLabel: "In progress",
      owner: "Evidence agent",
      ownerKind: "agent",
      startedAt: "2026-08-01T09:00:00.000Z",
      completedAt: null,
      inputs: ["26 CVs (PDF)"],
      outputs: ["21 assessments with verified quotes"],
      blockers: [],
      pendingApprovals: ["5 assessments need reviewer confirmation"],
      nextAction: "Reviewer confirms the 5 remaining assessments.",
    },
    {
      key: "scoring",
      label: "Scoring",
      summary: "Scores are written as an immutable run against the locked rubric.",
      state: "completed",
      stateLabel: "Completed",
      owner: "Scoring agent",
      ownerKind: "agent",
      startedAt: "2026-08-03T09:35:00.000Z",
      completedAt: "2026-08-03T09:41:00.000Z",
      inputs: ["Verified evidence", "Approved criteria"],
      outputs: ["12 scored candidates", "Audit record per score"],
      blockers: [],
      pendingApprovals: [],
      nextAction: null,
    },
    {
      key: "review",
      label: "Review",
      summary: "You accept, decline or ask for more on each candidate.",
      state: "waiting",
      stateLabel: "Waiting",
      owner: "Your team",
      ownerKind: "client",
      startedAt: "2026-08-03T10:00:00.000Z",
      completedAt: null,
      inputs: ["3 candidates delivered"],
      outputs: [],
      blockers: [],
      pendingApprovals: ["3 decisions due"],
      nextAction: "Decide on 3 candidates in the Decision Workspace.",
    },
    {
      key: "interview",
      label: "Interview",
      summary: "Scheduling, scorecards and structured feedback in one screen.",
      state: "not_started",
      stateLabel: "Not started",
      owner: "Coordination agent",
      ownerKind: "agent",
      startedAt: null,
      completedAt: null,
      inputs: [],
      outputs: [],
      blockers: [],
      pendingApprovals: [],
      nextAction: "Starts when the first candidate is accepted.",
    },
    {
      key: "decision",
      label: "Decision",
      summary: "Offer, decline, or hold — with the reason recorded.",
      state: "not_started",
      stateLabel: "Not started",
      owner: "Your team",
      ownerKind: "client",
      startedAt: null,
      completedAt: null,
      inputs: [],
      outputs: [],
      blockers: [],
      pendingApprovals: [],
      nextAction: null,
    },
    {
      key: "hire",
      label: "Hire",
      summary: "Start date confirmed and the role closes.",
      state: "not_started",
      stateLabel: "Not started",
      owner: "Your team",
      ownerKind: "client",
      startedAt: null,
      completedAt: null,
      inputs: [],
      outputs: [],
      blockers: [],
      pendingApprovals: [],
      nextAction: null,
    },
  ] as RoleLifecycle["stages"],
};

// ── Onboarding ───────────────────────────────────────────────────────────────

export type PreviewOnboardingStep = {
  label: string;
  state: "done" | "active" | "todo";
  detail: string;
  owner: string;
  elapsed: string;
};

export const PREVIEW_ONBOARDING: PreviewOnboardingStep[] = [
  {
    label: "Describe the role",
    state: "done",
    detail: "One page: must-haves, salary band, location, start date.",
    owner: "Your team",
    elapsed: "≈8 minutes",
  },
  {
    label: "Confirm the plan",
    state: "done",
    detail: "Confirm the plan with the team by message or email.",
    owner: "Your team",
    elapsed: "≈2 minutes",
  },
  {
    label: "Blueprint compiled",
    state: "done",
    detail: "Requirements become a locked, scoreable rubric you can edit.",
    owner: "Blueprint agent",
    elapsed: "Same day",
  },
  {
    label: "Search running",
    state: "active",
    detail: "Discovery and evidence agents work the role continuously.",
    owner: "Agent layer",
    elapsed: "Day 1 onward",
  },
  {
    label: "Decisions in the workspace",
    state: "todo",
    detail: "Evidence-first candidate cards, side by side, reversible for 5 minutes.",
    owner: "Your team",
    elapsed: "From first delivery",
  },
];

// ── Sample shortlist (hospitality) ───────────────────────────────────────────
//
// Ten fictional example candidates for one hospitality role, used only by the
// /sample-shortlist page. Everything here is invented example data. There is no
// real person, employer or property. Each candidate has ONE overall score, the
// rounded mean of the five requirement scores, computed in one place below.

export const SAMPLE_SHORTLIST_ROLE = "Hotel General Manager" as const;

export const SAMPLE_SHORTLIST_LABEL = "Example shortlist (example data, not a client result)" as const;

export const SAMPLE_SHORTLIST_NOTICE =
  "Every candidate, score and evidence line on this page is invented to show the format. No real person, employer or client appears here." as const;

export const SAMPLE_SHORTLIST_REQUIREMENTS = [
  { key: "ops", label: "Hotel operations leadership" },
  { key: "pnl", label: "P&L and budget ownership" },
  { key: "guest", label: "Guest satisfaction results" },
  { key: "team", label: "Team leadership and retention" },
  { key: "brand", label: "Brand and licence standards" },
] as const;

export type SampleRequirementKey = (typeof SAMPLE_SHORTLIST_REQUIREMENTS)[number]["key"];

type SampleRequirementResult = { score: number; evidence: string };

type SampleCandidateInput = {
  ref: string;
  results: Record<SampleRequirementKey, SampleRequirementResult>;
};

export type SampleShortlistCandidate = {
  rank: number;
  ref: string;
  /** The one score for this candidate: rounded mean of the requirement scores. */
  score: number;
  results: Record<SampleRequirementKey, SampleRequirementResult>;
};

const r = (score: number, evidence: string): SampleRequirementResult => ({ score, evidence });

const SAMPLE_CANDIDATE_INPUTS: SampleCandidateInput[] = [
  {
    ref: "Example candidate A1",
    results: {
      ops: r(96, "Ran a 240-room city hotel with rooms, F&B and events reporting to them."),
      pnl: r(93, "Owned a stated annual budget and the monthly forecast for five years."),
      guest: r(92, "CV cites lifting the guest review score over two consecutive years."),
      team: r(90, "Led a department-head team of eight; promoted three from within."),
      brand: r(94, "Passed two brand standards audits as the accountable manager."),
    },
  },
  {
    ref: "Example candidate B2",
    results: {
      ops: r(91, "General manager of a 180-room resort with a spa and two restaurants."),
      pnl: r(90, "Delivered a cost-reduction plan against budget; figures stated in the CV."),
      guest: r(88, "Describes a service recovery programme and the review trend that followed."),
      team: r(89, "Reduced front-line turnover during a seasonal peak, with the method stated."),
      brand: r(86, "Opened the hotel under an international brand programme."),
    },
  },
  {
    ref: "Example candidate C3",
    results: {
      ops: r(89, "Resident manager of a 300-room convention hotel for four years."),
      pnl: r(84, "Shared budget ownership with a finance director; own share is not quantified."),
      guest: r(90, "Quotes guest feedback targets and the actions taken to meet them."),
      team: r(86, "Managed a team of about 120 across four departments."),
      brand: r(83, "Brand standards work mentioned, no audit result given."),
    },
  },
  {
    ref: "Example candidate D4",
    results: {
      ops: r(87, "Director of operations for a three-hotel group in one city."),
      pnl: r(88, "Group-level P&L responsibility with a stated revenue range."),
      guest: r(81, "Guest scores mentioned for one property only."),
      team: r(85, "Built a regional training programme, with attendance figures."),
      brand: r(80, "Works across independent hotels; limited brand-programme evidence."),
    },
  },
  {
    ref: "Example candidate E5",
    results: {
      ops: r(84, "Hotel manager of a 120-room boutique property for three years."),
      pnl: r(82, "Owned the property budget; the size is not stated."),
      guest: r(86, "Cites top-ranked status on a travel review site for the property."),
      team: r(80, "Led a team of 45; no retention evidence in the CV."),
      brand: r(76, "Independent property, so no brand standards to evidence."),
    },
  },
  {
    ref: "Example candidate F6",
    results: {
      ops: r(82, "Assistant general manager at a 200-room hotel, deputising for the GM."),
      pnl: r(76, "Prepared budgets for rooms and F&B; final sign-off sat with the GM."),
      guest: r(83, "Led the guest complaints process and reported its results monthly."),
      team: r(81, "Ran hiring and training for the front office and housekeeping."),
      brand: r(78, "Coordinated a brand audit as the delegate for the GM."),
    },
  },
  {
    ref: "Example candidate G7",
    results: {
      ops: r(79, "Rooms division manager at a large airport hotel."),
      pnl: r(72, "Rooms revenue targets owned; F&B and overall P&L were not."),
      guest: r(80, "Front-desk service scores stated for the rooms division."),
      team: r(78, "Managed about 60 staff in the rooms division."),
      brand: r(75, "Worked to brand standards daily; no audit ownership shown."),
    },
  },
  {
    ref: "Example candidate H8",
    results: {
      ops: r(76, "Food and beverage director with some rooms-division exposure."),
      pnl: r(74, "Owned the F&B budget for a 150-room hotel."),
      guest: r(77, "Restaurant review scores quoted; no whole-hotel figure."),
      team: r(75, "Led a kitchen and service team of around 70."),
      brand: r(68, "Brand standards evidence is limited to F&B."),
    },
  },
  {
    ref: "Example candidate I9",
    results: {
      ops: r(72, "Hotel manager at a serviced-apartment operator, a related format."),
      pnl: r(71, "Owned an occupancy and cost target; scale is smaller than this role."),
      guest: r(70, "Guest satisfaction is mentioned without a figure."),
      team: r(69, "Managed a team of 20; the scale is below the role requirement."),
      brand: r(66, "No international brand programme in the work history."),
    },
  },
  {
    ref: "Example candidate J10",
    results: {
      ops: r(68, "Operations manager at a resort, seasonal contracts only."),
      pnl: r(63, "Budget responsibility is described in general terms."),
      guest: r(66, "Guest feedback is mentioned, with no source or result."),
      team: r(64, "Led seasonal teams; the size is not stated."),
      brand: r(61, "No brand or licence standards evidence found."),
    },
  },
];

export const SAMPLE_SHORTLIST: SampleShortlistCandidate[] = SAMPLE_CANDIDATE_INPUTS.map(
  (c, i) => {
    const scores = SAMPLE_SHORTLIST_REQUIREMENTS.map((q) => c.results[q.key].score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    return { rank: i + 1, ref: c.ref, score: Math.round(mean), results: c.results };
  },
);
