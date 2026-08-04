/**
 * Role lifecycle visualisation — pure derivation layer.
 *
 * The nine stages below describe the *hiring system* lifecycle:
 *
 *   Intake > Blueprint > Discovery > Evidence > Scoring > Review >
 *   Interview > Decision > Hire
 *
 * RULES (deliberate, do not relax):
 *  - This is a VIEW over existing truth. It introduces no new status column,
 *    no new enum and no second pipeline. Every stage state is derived from
 *    records that already exist: positions.*, outreach_campaigns,
 *    applications, candidate_matches.stage, approved score runs, interviews,
 *    client_decisions and candidate_stage_history.
 *  - A stage is only "completed" when a real record proves it happened.
 *    Absence of data is "not_started", never "completed" and never "failed".
 *  - Client language only. No canonical states, integrity status, engine
 *    versions, rubric versions, trace ids or job ids.
 *  - Pure module: no server imports, safe on both sides.
 */

export const LIFECYCLE_STAGES = [
  "intake",
  "blueprint",
  "discovery",
  "evidence",
  "scoring",
  "review",
  "interview",
  "decision",
  "hire",
] as const;

export type LifecycleStageKey = (typeof LIFECYCLE_STAGES)[number];

export type LifecycleState =
  | "completed"
  | "active"
  | "waiting"
  | "blocked"
  | "skipped"
  | "failed"
  | "not_started";

export const LIFECYCLE_STATE_LABELS: Record<LifecycleState, string> = {
  completed: "Completed",
  active: "In progress",
  waiting: "Waiting",
  blocked: "Blocked",
  skipped: "Skipped",
  failed: "Failed",
  not_started: "Not started",
};

export type LifecycleStage = {
  key: LifecycleStageKey;
  label: string;
  /** One line describing what happens in this stage, in client language. */
  summary: string;
  state: LifecycleState;
  stateLabel: string;
  /** Who owns the work: an agent name, "Your team", or "TaaSFlow team". */
  owner: string;
  ownerKind: "agent" | "client" | "staff";
  startedAt: string | null;
  completedAt: string | null;
  inputs: string[];
  outputs: string[];
  blockers: string[];
  pendingApprovals: string[];
  /** What happens next, or what is needed to unblock. Null when finished. */
  nextAction: string | null;
};

export type RoleLifecycle = {
  positionId: string;
  title: string;
  /** Client-facing role status label, reused from the existing status map. */
  statusLabel: string;
  inactive: boolean;
  stages: LifecycleStage[];
  /** Index of the stage currently carrying the work, -1 when none. */
  currentIndex: number;
  /** Short caption, e.g. "Review · waiting on your team since 12 Aug". */
  caption: string;
  /** Total items across all stages needing someone's attention. */
  attentionCount: number;
};

/**
 * Signals gathered server-side from records the caller can already read.
 * Everything is optional: missing signals produce honest "not started".
 */
export type LifecycleSignals = {
  positionId: string;
  title: string;
  status: string;
  statusLabel: string;

  createdAt?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  clarificationRequestedAt?: string | null;
  publishedAt?: string | null;
  closedAt?: string | null;

  blueprintStatus?: string | null;
  blueprintGeneratedAt?: string | null;
  blueprintConfirmedAt?: string | null;

  /** First outreach campaign started for this role. */
  discoveryStartedAt?: string | null;
  /** Campaigns that are currently running. */
  activeCampaigns?: number;
  /** Real applications received for this role. */
  applicationCount?: number;

  /** First candidate worked on for this role. */
  firstCandidateAt?: string | null;
  /** Candidates shared with this workspace. */
  candidateCount?: number;
  /** Candidates with an evidence-backed, approved assessment. */
  assessedCount?: number;
  /** When the first assessment landed. */
  firstAssessmentAt?: string | null;

  /** Candidates delivered and still waiting on a first decision. */
  awaitingReview?: number;
  /** When the first candidate was delivered for review. */
  firstDeliveredAt?: string | null;
  /** When the workspace last recorded a decision. */
  lastDecisionAt?: string | null;
  decisionCount?: number;

  shortlistedCount?: number;
  /** Interviews requested or being scheduled — a time is still needed. */
  interviewsToConfirm?: number;
  interviewsScheduled?: number;
  interviewsCompleted?: number;
  firstInterviewAt?: string | null;
  lastInterviewCompletedAt?: string | null;

  offerCount?: number;
  firstOfferAt?: string | null;

  hires?: number;
  openings?: number;
  firstHireAt?: string | null;
};

const STAGE_META: Record<
  LifecycleStageKey,
  {
    label: string;
    summary: string;
    owner: string;
    ownerKind: LifecycleStage["ownerKind"];
    inputs: string[];
    outputs: string[];
  }
> = {
  intake: {
    label: "Intake",
    summary: "Your role brief is captured and checked for gaps.",
    owner: "Intake agent",
    ownerKind: "agent",
    inputs: ["Role details from your team", "Any job description you uploaded"],
    outputs: ["A structured role brief", "A list of anything still missing"],
  },
  blueprint: {
    label: "Blueprint",
    summary: "The brief becomes the requirements candidates are measured against.",
    owner: "Blueprint agent",
    ownerKind: "agent",
    inputs: ["The role brief", "Must-haves, nice-to-haves and dealbreakers"],
    outputs: ["A role blueprint you sign off", "The scoring requirements for this role"],
  },
  discovery: {
    label: "Discovery",
    summary: "We find and approach people who match the blueprint.",
    owner: "Discovery agent",
    ownerKind: "agent",
    inputs: ["The signed-off blueprint", "People already known to the platform", "Your job board listing"],
    outputs: ["A longlist of candidates", "Applications and outreach replies"],
  },
  evidence: {
    label: "Evidence",
    summary: "Each candidate's CV is read and turned into checkable facts.",
    owner: "Evidence agent",
    ownerKind: "agent",
    inputs: ["Candidate CVs and application answers"],
    outputs: ["Evidence for each requirement", "Gaps where evidence is missing"],
  },
  scoring: {
    label: "Scoring",
    summary: "Candidates are assessed against your requirements, backed by evidence.",
    owner: "Scoring agent",
    ownerKind: "agent",
    inputs: ["Extracted evidence", "The role blueprint"],
    outputs: ["An assessment per candidate", "Requirement-by-requirement coverage"],
  },
  review: {
    label: "Review",
    summary: "Assessed candidates are checked by us, then shared with you to decide.",
    owner: "Your team",
    ownerKind: "client",
    inputs: ["Assessed candidates", "Evidence behind each assessment"],
    outputs: ["Shortlisted candidates", "Candidates set aside with a reason"],
  },
  interview: {
    label: "Interview",
    summary: "Interviews are arranged and feedback is captured against the brief.",
    owner: "Coordination agent",
    ownerKind: "agent",
    inputs: ["Your shortlist", "Interviewer and candidate availability"],
    outputs: ["Confirmed interview times", "Structured interview feedback"],
  },
  decision: {
    label: "Decision",
    summary: "You decide who to progress to offer.",
    owner: "Your team",
    ownerKind: "client",
    inputs: ["Interview feedback", "Compensation signal for the role"],
    outputs: ["An offer decision", "A recorded reason either way"],
  },
  hire: {
    label: "Hire",
    summary: "The offer is accepted and the hire is confirmed.",
    owner: "Your team",
    ownerKind: "client",
    inputs: ["The accepted offer", "Start date"],
    outputs: ["A confirmed hire", "The role closed against its openings"],
  },
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "12 Aug" this year, "12 Aug 2025" otherwise. Empty when unknown. */
export function formatLifecycleDate(
  iso: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

function n(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function earliest(...values: Array<string | null | undefined>): string | null {
  const list = values.filter((v): v is string => Boolean(v)).sort();
  return list[0] ?? null;
}

type Draft = {
  state: LifecycleState;
  startedAt: string | null;
  completedAt: string | null;
  blockers: string[];
  pendingApprovals: string[];
  nextAction: string | null;
  /** Extra, verified detail appended to the static inputs/outputs. */
  outputNotes: string[];
};

function draft(partial: Partial<Draft> = {}): Draft {
  return {
    state: "not_started",
    startedAt: null,
    completedAt: null,
    blockers: [],
    pendingApprovals: [],
    nextAction: null,
    outputNotes: [],
    ...partial,
  };
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function computeRoleLifecycle(
  s: LifecycleSignals,
  now: Date = new Date(),
): RoleLifecycle {
  const status = (s.status ?? "").toLowerCase();
  const inactive = ["paused", "closed", "archived", "filled"].includes(status);
  const closed = ["closed", "archived", "filled"].includes(status);
  const hires = n(s.hires);
  const openings = Math.max(1, n(s.openings) || 1);
  const filled = hires >= openings;

  const drafts: Record<LifecycleStageKey, Draft> = {
    intake: draft(),
    blueprint: draft(),
    discovery: draft(),
    evidence: draft(),
    scoring: draft(),
    review: draft(),
    interview: draft(),
    decision: draft(),
    hire: draft(),
  };

  // ── Intake ────────────────────────────────────────────────────────────────
  const intakeStart = s.createdAt ?? null;
  const intakeDone = earliest(s.submittedAt, s.approvedAt);
  if (s.clarificationRequestedAt && !s.approvedAt) {
    drafts.intake = draft({
      state: "blocked",
      startedAt: intakeStart,
      blockers: ["We've asked your team for missing detail on the brief."],
      nextAction: "Answer the clarification request so the brief can be finalised.",
    });
  } else if (intakeDone) {
    drafts.intake = draft({
      state: "completed",
      startedAt: intakeStart,
      completedAt: intakeDone,
      outputNotes: ["Brief captured and accepted"],
    });
  } else if (intakeStart) {
    drafts.intake = draft({
      state: status === "draft" ? "active" : "waiting",
      startedAt: intakeStart,
      nextAction:
        status === "draft"
          ? "Finish the role brief and submit it."
          : "We're reviewing the brief.",
    });
  }

  // ── Blueprint ─────────────────────────────────────────────────────────────
  const bp = String(s.blueprintStatus ?? "none").toLowerCase();
  if (bp === "failed") {
    drafts.blueprint = draft({
      state: "failed",
      startedAt: s.blueprintGeneratedAt ?? intakeDone,
      blockers: ["We couldn't build the blueprint from the brief."],
      nextAction: "Our team is rebuilding the blueprint — no action needed from you.",
    });
  } else if (s.blueprintConfirmedAt) {
    drafts.blueprint = draft({
      state: "completed",
      startedAt: earliest(s.blueprintGeneratedAt, intakeDone),
      completedAt: s.blueprintConfirmedAt,
      outputNotes: ["Blueprint signed off by your team"],
    });
  } else if (s.blueprintGeneratedAt || bp === "ready") {
    drafts.blueprint = draft({
      state: "waiting",
      startedAt: s.blueprintGeneratedAt ?? intakeDone,
      pendingApprovals: ["Blueprint sign-off from your team"],
      nextAction: "Review the blueprint and confirm the requirements.",
    });
  } else if (["queued", "analyzing_jd", "researching", "drafting", "generating"].includes(bp)) {
    drafts.blueprint = draft({
      state: "active",
      startedAt: intakeDone ?? intakeStart,
      nextAction: "The blueprint is being compiled from your brief.",
    });
  } else if (intakeDone) {
    drafts.blueprint = draft({
      state: "not_started",
      nextAction: "The blueprint is compiled once the brief is accepted.",
    });
  }

  // ── Discovery ─────────────────────────────────────────────────────────────
  const discoveryStart = earliest(s.discoveryStartedAt, s.publishedAt);
  const applications = n(s.applicationCount);
  const candidates = n(s.candidateCount);
  if (discoveryStart || applications > 0 || candidates > 0) {
    const evidenceMoved = n(s.assessedCount) > 0 || n(s.awaitingReview) > 0;
    drafts.discovery = draft({
      state: closed && !filled ? "completed" : evidenceMoved || candidates > 0 ? "active" : "active",
      startedAt: discoveryStart ?? s.firstCandidateAt,
      completedAt: closed ? (s.closedAt ?? null) : null,
      outputNotes: [
        candidates > 0 ? `${plural(candidates, "candidate")} on this role` : "",
        applications > 0 ? `${plural(applications, "application")} received` : "",
        n(s.activeCampaigns) > 0 ? `${plural(n(s.activeCampaigns), "outreach campaign")} running` : "",
      ].filter(Boolean),
      nextAction: closed ? null : "We keep sourcing until the role is filled.",
    });
    if (closed) drafts.discovery.state = "completed";
  } else if (s.blueprintConfirmedAt) {
    drafts.discovery = draft({
      state: "waiting",
      nextAction: "Sourcing starts as soon as the role goes live.",
    });
  }

  // ── Evidence ──────────────────────────────────────────────────────────────
  const assessed = n(s.assessedCount);
  if (candidates > 0) {
    const allAssessed = assessed >= candidates;
    drafts.evidence = draft({
      state: allAssessed ? "completed" : assessed > 0 ? "active" : "active",
      startedAt: s.firstCandidateAt,
      completedAt: allAssessed ? s.firstAssessmentAt : null,
      outputNotes: [
        `${plural(candidates, "CV")} read`,
        assessed > 0 ? `Evidence attached for ${assessed}` : "Evidence extraction in progress",
      ],
      nextAction: allAssessed ? null : "Evidence is being extracted from the remaining CVs.",
    });
  }

  // ── Scoring ───────────────────────────────────────────────────────────────
  if (assessed > 0) {
    drafts.scoring = draft({
      state: assessed >= candidates ? "completed" : "active",
      startedAt: s.firstAssessmentAt,
      completedAt: assessed >= candidates ? s.firstAssessmentAt : null,
      outputNotes: [`${plural(assessed, "candidate")} assessed against your requirements`],
      nextAction:
        assessed >= candidates ? null : "Remaining candidates are still being assessed.",
    });
  } else if (candidates > 0) {
    drafts.scoring = draft({
      state: "waiting",
      nextAction: "Assessment starts once evidence has been extracted.",
    });
  }

  // ── Review ────────────────────────────────────────────────────────────────
  const awaiting = n(s.awaitingReview);
  const decisions = n(s.decisionCount);
  const shortlisted = n(s.shortlistedCount);
  if (awaiting > 0) {
    drafts.review = draft({
      state: "waiting",
      startedAt: s.firstDeliveredAt,
      pendingApprovals: [`${plural(awaiting, "candidate")} waiting on your decision`],
      nextAction: "Review the shared candidates and shortlist or set them aside.",
    });
  } else if (decisions > 0 || shortlisted > 0 || s.firstDeliveredAt) {
    drafts.review = draft({
      state: closed || shortlisted > 0 || decisions > 0 ? "completed" : "active",
      startedAt: s.firstDeliveredAt,
      completedAt: s.lastDecisionAt ?? null,
      outputNotes: [
        shortlisted > 0 ? `${plural(shortlisted, "candidate")} shortlisted` : "",
        decisions > 0 ? `${plural(decisions, "decision")} recorded` : "",
      ].filter(Boolean),
      nextAction: closed ? null : "New candidates appear here for your decision.",
    });
  } else if (assessed > 0) {
    drafts.review = draft({
      state: "waiting",
      nextAction: "Candidates are shared with you once our team has checked them.",
    });
  }

  // ── Interview ─────────────────────────────────────────────────────────────
  const toConfirm = n(s.interviewsToConfirm);
  const scheduled = n(s.interviewsScheduled);
  const completedIvs = n(s.interviewsCompleted);
  if (toConfirm > 0) {
    drafts.interview = draft({
      state: "waiting",
      startedAt: s.firstInterviewAt,
      pendingApprovals: [`${plural(toConfirm, "interview")} needing a confirmed time`],
      nextAction: "Confirm a time so we can book the interview.",
      outputNotes: scheduled > 0 ? [`${plural(scheduled, "interview")} confirmed`] : [],
    });
  } else if (scheduled > 0) {
    drafts.interview = draft({
      state: "active",
      startedAt: s.firstInterviewAt,
      outputNotes: [`${plural(scheduled, "interview")} confirmed`],
      nextAction: "Interviews are booked — feedback is captured after each one.",
    });
  } else if (completedIvs > 0) {
    drafts.interview = draft({
      state: "completed",
      startedAt: s.firstInterviewAt,
      completedAt: s.lastInterviewCompletedAt ?? null,
      outputNotes: [`${plural(completedIvs, "interview")} completed`],
    });
  } else if (shortlisted > 0) {
    drafts.interview = draft({
      state: "waiting",
      nextAction: "Request an interview with a shortlisted candidate.",
    });
  }

  // ── Decision ──────────────────────────────────────────────────────────────
  const offers = n(s.offerCount);
  if (offers > 0) {
    drafts.decision = draft({
      state: hires > 0 ? "completed" : "waiting",
      startedAt: s.firstOfferAt,
      completedAt: hires > 0 ? s.firstHireAt : null,
      pendingApprovals: hires > 0 ? [] : [`${plural(offers, "offer")} awaiting an outcome`],
      outputNotes: [`${plural(offers, "offer")} in play`],
      nextAction: hires > 0 ? null : "Record the outcome once the candidate responds.",
    });
  } else if (completedIvs > 0 || scheduled > 0) {
    drafts.decision = draft({
      state: "waiting",
      nextAction: "Decide who to take to offer after the interviews.",
    });
  }

  // ── Hire ──────────────────────────────────────────────────────────────────
  if (hires > 0) {
    drafts.hire = draft({
      state: filled ? "completed" : "active",
      startedAt: s.firstHireAt,
      completedAt: filled ? (s.closedAt ?? s.firstHireAt) : null,
      outputNotes: [
        `${plural(hires, "hire")} confirmed of ${plural(openings, "opening")}`,
      ],
      nextAction: filled ? null : "Keep going until every opening is filled.",
    });
  } else if (offers > 0) {
    drafts.hire = draft({
      state: "waiting",
      nextAction: "The hire is confirmed once the offer is accepted.",
    });
  }

  // ── Skipped: a closed role that never reached a stage a later one passed ──
  const order = LIFECYCLE_STAGES;
  const reached = (k: LifecycleStageKey) =>
    drafts[k].state !== "not_started" && drafts[k].state !== "skipped";
  const lastReached = order.reduce(
    (acc, k, i) => (reached(k) ? i : acc),
    -1,
  );
  for (let i = 0; i < order.length; i += 1) {
    const k = order[i]!;
    if (drafts[k].state === "not_started" && i < lastReached) {
      drafts[k] = draft({
        state: "skipped",
        nextAction: null,
      });
    }
  }
  // A closed role with nothing pending: later untouched stages stay
  // "not started" rather than pretending they were skipped.

  // ── Assemble ──────────────────────────────────────────────────────────────
  const stages: LifecycleStage[] = order.map((key) => {
    const d = drafts[key];
    const meta = STAGE_META[key];
    return {
      key,
      label: meta.label,
      summary: meta.summary,
      state: d.state,
      stateLabel: LIFECYCLE_STATE_LABELS[d.state],
      owner: meta.owner,
      ownerKind: meta.ownerKind,
      startedAt: d.startedAt,
      completedAt: d.completedAt,
      inputs: meta.inputs,
      outputs: d.outputNotes.length > 0 ? [...d.outputNotes, ...meta.outputs] : meta.outputs,
      blockers: d.blockers,
      pendingApprovals: d.pendingApprovals,
      nextAction: inactive && status !== "filled" && d.state === "waiting" ? null : d.nextAction,
    };
  });

  // Current stage: the furthest stage that is active, waiting, blocked or failed.
  const priority: LifecycleState[] = ["blocked", "failed", "waiting", "active"];
  let currentIndex = -1;
  for (const state of priority) {
    const idx = stages.findIndex((st) => st.state === state);
    if (idx !== -1) {
      currentIndex = idx;
      break;
    }
  }
  if (currentIndex === -1) {
    currentIndex = stages.reduce(
      (acc, st, i) => (st.state === "completed" ? i : acc),
      -1,
    );
  }

  const attentionCount = stages.reduce(
    (acc, st) => acc + st.pendingApprovals.length + st.blockers.length,
    0,
  );

  const current = currentIndex >= 0 ? stages[currentIndex] : undefined;
  let caption: string;
  if (status === "paused") caption = `Paused at ${current?.label.toLowerCase() ?? "intake"}`;
  else if (filled) caption = "Role filled";
  else if (closed) caption = "Role closed";
  else if (!current) caption = "Nothing has happened on this role yet";
  else {
    const since = formatLifecycleDate(current.startedAt, now);
    const owner =
      current.ownerKind === "client" ? "waiting on your team" : `with the ${current.owner}`;
    caption =
      current.state === "waiting"
        ? `${current.label} · ${owner}${since ? ` since ${since}` : ""}`
        : `${current.label} · ${current.stateLabel.toLowerCase()}${since ? ` since ${since}` : ""}`;
  }

  return {
    positionId: s.positionId,
    title: s.title,
    statusLabel: s.statusLabel,
    inactive,
    stages,
    currentIndex,
    caption,
    attentionCount,
  };
}
