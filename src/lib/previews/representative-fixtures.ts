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

export const SAMPLE_SHORTLIST_ROLE = "Registered nurse" as const;

export const SAMPLE_SHORTLIST_LABEL = "Example shortlist (example data, not a client result)" as const;

export const SAMPLE_SHORTLIST_NOTICE =
  "Every candidate, score and evidence line on this page is invented to show the format. No real person, employer or client appears here." as const;

/** In rubric order, heaviest first: the first three are the Brief chapter's sliders. */
export const SAMPLE_SHORTLIST_REQUIREMENTS = [
  { key: "licence", label: "Active RN licence in the state" },
  { key: "acute", label: "Acute-care experience, three years or more" },
  { key: "nights", label: "Night and weekend rotation" },
  { key: "certs", label: "BLS and ACLS certification" },
  { key: "charting", label: "Epic or Cerner charting" },
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
      licence: r(98, "Licensed as a registered nurse in the state since 2019; licence in good standing."),
      acute: r(95, "Five years on a 32-bed acute medical-surgical unit, charge nurse for the last two."),
      nights: r(72, "Shift pattern is not stated in the CV. Ask in the interview."),
      certs: r(96, "BLS and ACLS certified, both renewed in 2025."),
      charting: r(94, "Charted in Epic daily, including medication reconciliation and discharge planning."),
    },
  },
  {
    ref: "Example candidate B2",
    results: {
      licence: r(96, "Active state licence; renewal date stated in the CV."),
      acute: r(92, "Four years in a 40-bed telemetry unit at a regional hospital."),
      nights: r(88, "Works a rotating schedule including nights and alternate weekends, stated outright."),
      certs: r(90, "BLS and ACLS current; PALS listed as expired."),
      charting: r(84, "Cerner for three years; Epic mentioned from a float assignment."),
    },
  },
  {
    ref: "Example candidate C3",
    results: {
      licence: r(95, "Licence by endorsement granted this year; number given."),
      acute: r(90, "Six years across medical-surgical and step-down units."),
      nights: r(84, "Night shift for three of the six years."),
      certs: r(88, "BLS and ACLS current; renewal dates not given."),
      charting: r(80, "Epic listed under skills; no detail of daily use."),
    },
  },
  {
    ref: "Example candidate D4",
    results: {
      licence: r(94, "Active licence in the state; compact licence also held."),
      acute: r(86, "Three years in an intensive care unit; acute-care scope is clear."),
      nights: r(90, "Permanent night shift for the whole period."),
      certs: r(82, "ACLS current; BLS renewal is listed as due."),
      charting: r(76, "Charting system is not named."),
    },
  },
  {
    ref: "Example candidate E5",
    results: {
      licence: r(90, "Licence active; transferred from another state last year."),
      acute: r(84, "Three years on a surgical unit, with the bed count stated."),
      nights: r(80, "Rotation mentioned, without the split between days and nights."),
      certs: r(86, "BLS and ACLS current."),
      charting: r(70, "Paper and a legacy system; no Epic or Cerner experience shown."),
    },
  },
  {
    ref: "Example candidate F6",
    results: {
      licence: r(88, "Licence application in the state is pending; licensed elsewhere."),
      acute: r(82, "Two and a half years acute care, close to the requirement."),
      nights: r(74, "Preference for days is stated; nights not ruled out."),
      certs: r(84, "BLS and ACLS current."),
      charting: r(72, "Epic training course completed; no unit use yet."),
    },
  },
  {
    ref: "Example candidate G7",
    results: {
      licence: r(85, "Licence active; the state is not named in the CV."),
      acute: r(78, "Two years acute care, then outpatient."),
      nights: r(76, "Weekend rotation stated; nights not mentioned."),
      certs: r(80, "BLS current; ACLS not listed."),
      charting: r(68, "Charting experience is not described."),
    },
  },
  {
    ref: "Example candidate H8",
    results: {
      licence: r(80, "Licence held; status and renewal date not stated."),
      acute: r(76, "Long-term care background with one acute-care rotation."),
      nights: r(70, "Shift pattern not stated."),
      certs: r(78, "BLS current; ACLS in progress."),
      charting: r(66, "A different electronic record is named."),
    },
  },
  {
    ref: "Example candidate I9",
    results: {
      licence: r(76, "Licensed in another state; no transfer under way."),
      acute: r(72, "One year acute care within a residency."),
      nights: r(68, "Shift pattern not stated."),
      certs: r(74, "BLS current; ACLS not listed."),
      charting: r(62, "Charting experience is not described."),
    },
  },
  {
    ref: "Example candidate J10",
    results: {
      licence: r(70, "Licence status unclear from the CV."),
      acute: r(66, "Agency contracts only; unit and duration not stated."),
      nights: r(60, "Shift pattern not stated."),
      certs: r(68, "BLS listed without a date."),
      charting: r(58, "No charting system named."),
    },
  },
];

/**
 * The example brief's weights, one per requirement, totalling 100. The first
 * three are the sliders in the Brief chapter; the rest are chips.
 */
export const SAMPLE_RUBRIC_WEIGHTS: Record<SampleRequirementKey, number> = {
  licence: 35,
  acute: 25,
  nights: 15,
  certs: 15,
  charting: 10,
};

/**
 * An excerpt of the top example candidate's CV, invented like the rest of
 * this fixture. Each sentence that earns points names its requirement, so the
 * Score chapter's quotes are, character for character, the sentences it
 * highlights. The night-rotation requirement has no sentence on purpose: the
 * gap is shown as plainly as the hits.
 */
export const SAMPLE_CV_EXCERPT: readonly { text: string; requirement?: SampleRequirementKey }[] = [
  { text: "Registered nurse, Riverside General Hospital, medical-surgical unit, 2020 to 2025." },
  { text: "Licensed as a registered nurse in the state since 2019; licence in good standing.", requirement: "licence" },
  { text: "Five years on a 32-bed acute medical-surgical unit, charge nurse for the last two.", requirement: "acute" },
  { text: "BLS and ACLS certified, both renewed in 2025.", requirement: "certs" },
  { text: "Charted in Epic daily, including medication reconciliation and discharge planning.", requirement: "charting" },
  { text: "Earlier: graduate nurse residency at a community hospital." },
];

/** The recruiter's one-line note on each of the top five, as the Sign-off chapter shows them. */
export const SAMPLE_RECRUITER_NOTES: readonly string[] = [
  "Charge nurse on a unit this size already. Ask about the shift pattern.",
  "Rotates nights and weekends now; the strongest match on schedule.",
  "Six years acute care; confirm the charting system in the interview.",
  "Intensive care background and permanent nights; BLS renewal is due.",
  "Three years on a surgical unit; no Epic or Cerner yet. Worth a conversation.",
];

/** What the recruiter wrote above the signed list. */
export const SAMPLE_RECRUITER_SIGN_OFF =
  "Ten read in full. Seven hold an active licence in the state today; three are transferring. Two need a direct question on night rotation, flagged on their rows. Nothing here was scored by software alone." as const;

/**
 * Three representative runs on the one clock, as the Proof chapter draws
 * them: brief approved on day 0, the list signed within the promise. Example
 * timings, not client results; each links to its example engagement.
 */
export const SAMPLE_RUNS: readonly { sector: string; role: string; signedDay: number; signedTime: string; to: string }[] = [
  { sector: "Hospitality", role: "Hotel general manager", signedDay: 4, signedTime: "15:10", to: "/case-studies" },
  { sector: "Healthcare", role: "Registered nurse", signedDay: 5, signedTime: "09:00", to: "/case-studies" },
  { sector: "Industrial", role: "Warehouse supervisor", signedDay: 3, signedTime: "16:40", to: "/case-studies" },
];

export const SAMPLE_SHORTLIST: SampleShortlistCandidate[] = SAMPLE_CANDIDATE_INPUTS.map(
  (c, i) => {
    const scores = SAMPLE_SHORTLIST_REQUIREMENTS.map((q) => c.results[q.key].score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    return { rank: i + 1, ref: c.ref, score: Math.round(mean), results: c.results };
  },
);
