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

export const REPRESENTATIVE_LABEL = "Representative data";

export const REPRESENTATIVE_NOTICE =
  "Representative data — a worked example of the product, not a live account. No candidate information is shown.";

/** The one role every preview on the marketing site talks about. */
export const PREVIEW_ROLE = {
  title: "Senior Platform Engineer",
  reference: "Example role",
  rubric: "Rubric v4 · locked",
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

export const PREVIEW_DECISION_QUEUE: PreviewCandidate[] = [
  {
    ref: "Candidate ref 4F2K9Q",
    score: 98,
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
    result: "Rubric v4 locked",
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
    detail: "12 scored under rubric v4",
    at: "09:41",
    result: "Score run written to audit trail",
  },
  {
    agent: "Coordination agent",
    status: "Waiting",
    detail: "2 interview slots proposed",
    at: "09:46",
    result: "Waiting on your confirmation",
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
      outputs: ["8 requirements", "Rubric v4 (locked)"],
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
      inputs: ["Rubric v4"],
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
      inputs: ["Verified evidence", "Rubric v4"],
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
    detail: "Pick a plan and pay, or book a call — both open the workspace.",
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
