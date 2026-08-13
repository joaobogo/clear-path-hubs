/**
 * Canonical empty-state catalogue.
 *
 * Every important surface resolves its "nothing to show" state through one of
 * the resolvers below, so the product answers the same six questions everywhere:
 *
 *  1. why      — why this area is empty
 *  2. expected — whether that is expected right now
 *  3. populates— what will put data here
 *  4. action   — one clear next step the user can take
 *  5. activity — what the system is doing at this moment (honest: often nothing)
 *  6. eta      — only when the timing is genuinely supported by real behaviour
 *
 * Rule: never imply work is in progress when no process is running. If we cannot
 * observe a running process, `activity` says so plainly and `eta` is omitted.
 */

export type SurfaceIconName =
  | "roles"
  | "candidates"
  | "evidence"
  | "agents"
  | "analytics"
  | "integrations"
  | "messages"
  | "approvals"
  | "audit"
  | "notifications"
  | "outcomes"
  | "filters";

export type SurfaceTone = "expected" | "waiting" | "attention";

export interface SurfaceAction {
  label: string;
  /** Internal route. Omit when the caller supplies onClick. */
  to?: string;
  /** Search params for the route. */
  search?: Record<string, unknown>;
}

export interface SurfaceStateContent {
  id: string;
  icon: SurfaceIconName;
  tone: SurfaceTone;
  title: string;
  /** Why this area is empty. */
  why: string;
  /** Whether the emptiness is expected. */
  expected: string;
  /** What will populate this area. */
  populates: string;
  /** What the system is doing right now. "" is not allowed — say "nothing". */
  activity: string;
  /** Only set when a real, observable process has a known cadence. */
  eta?: string;
  action?: SurfaceAction;
  secondaryAction?: SurfaceAction;
}

const EXPECTED_NEW = "Expected — nothing has happened here yet.";
const EXPECTED_PROCESSING = "Expected — work is in progress.";
const EXPECTED_QUIET = "Expected — there is nothing outstanding.";
const NEEDS_ATTENTION = "Not expected — this needs a decision from someone.";
const NOTHING_RUNNING = "Nothing is happening in this area right now.";

/** Shared state for "filters removed every result" — never a false zero. */
export function resolveFilteredEmptyState(filters: string[]): SurfaceStateContent {
  return {
    id: "filtered",
    icon: "filters",
    tone: "expected",
    title: "No results match these filters",
    why:
      filters.length > 0
        ? `These filters removed every result: ${filters.join(" · ")}.`
        : "Your current filters exclude every record.",
    expected: "Expected — records exist, the view is just narrow.",
    populates: "Clearing or widening a filter brings the existing records back.",
    activity: "Nothing is searching — this is a display filter only.",
    action: { label: "Clear filters" },
  };
}

/* ---------------------------------------------------------------- 1. roles */

export function resolveNoRolesState(signals: {
  status?: "active" | "draft" | "paused" | "closed" | string;
  /** Roles exist in the workspace but not in this tab. */
  hasAnyRole: boolean;
  /** Draft roles awaiting payment / scoping. */
  pendingSetup?: number;
}): SurfaceStateContent {
  const { status = "active", hasAnyRole, pendingSetup = 0 } = signals;

  if (status === "draft") {
    return {
      id: "roles.draft",
      icon: "roles",
      tone: "expected",
      title: "No roles in setup",
      why: "Nothing is currently being scoped. Roles sit here between intake and going live.",
      expected: EXPECTED_NEW,
      populates: "A role appears here as soon as you submit intake for it.",
      activity: NOTHING_RUNNING,
      action: { label: "Open intake", to: "/intake" },
    };
  }
  if (status === "paused") {
    return {
      id: "roles.paused",
      icon: "roles",
      tone: "expected",
      title: "No paused roles",
      why: "You have not paused any role.",
      expected: EXPECTED_QUIET,
      populates: "If you pause a role, it moves here with its pipeline intact.",
      activity: NOTHING_RUNNING,
      action: { label: "See active roles", to: "/client/positions" },
    };
  }
  if (status === "closed") {
    return {
      id: "roles.closed",
      icon: "roles",
      tone: "expected",
      title: "No closed roles yet",
      why: "No role has been filled or closed so far.",
      expected: EXPECTED_QUIET,
      populates: "Roles move here once they are filled or closed, with their hire record attached.",
      activity: NOTHING_RUNNING,
      action: { label: "See active roles", to: "/client/positions" },
    };
  }

  if (pendingSetup > 0) {
    return {
      id: "roles.pending-setup",
      icon: "roles",
      tone: "waiting",
      title: "Role submitted — setting up now",
      why: `${pendingSetup} role${pendingSetup === 1 ? " is" : "s are"} in setup, so nothing is live yet.`,
      expected: EXPECTED_PROCESSING,
      populates: "Once the blueprint is approved and the role is published, the search begins and candidates land here.",
      activity: "Your team is confirming the role blueprint and requirements.",
      eta: "Most roles go live within 1 business day of submission.",
      action: { label: "See what's in setup", to: "/client/positions" },
      secondaryAction: { label: "Message your team", to: "/client/conversations" },
    };
  }

  return {
    id: hasAnyRole ? "roles.none-in-view" : "roles.none",
    icon: "roles",
    tone: "expected",
    title: hasAnyRole ? "No live roles in this view" : "No roles yet",
    why: hasAnyRole
      ? "Your roles exist but none of them are live right now."
      : "This workspace has no roles, so there is nothing for the platform to work on.",
    expected: EXPECTED_NEW,
    populates:
      "Submitting a role creates the blueprint, opens discovery and starts the pipeline you'll see here.",
    activity: NOTHING_RUNNING,
    action: { label: hasAnyRole ? "See all roles" : "Add your first role", to: hasAnyRole ? "/client/positions" : "/intake" },
    secondaryAction: hasAnyRole ? undefined : { label: "Guided setup", to: "/client/onboarding" },
  };
}

/** Honest first-run state for a brand-new workspace. */
export function resolveFirstRunState(): SurfaceStateContent {
  return {
    id: "first-run",
    icon: "roles",
    tone: "expected",
    title: "Your workspace is ready",
    why: "Submit a role and this page becomes your command center — decisions, candidates, and next steps in one place.",
    expected: EXPECTED_NEW,
    populates: "Your first role opens the blueprint, discovery, and candidate pipeline.",
    activity: "Nothing is running yet.",
    eta: "After submission, roles typically go live within 1 business day.",
    action: { label: "Add your first role", to: "/intake" },
    secondaryAction: { label: "Guided setup", to: "/client/onboarding" },
  };
}


/* ----------------------------------------------------------- 2. candidates */

export function resolveNoCandidatesState(signals: {
  /** Live roles in the workspace. */
  activeRoles: number;
  /** Roles in setup but not yet live. */
  rolesInSetup: number;
  /** Discovery/sourcing has been started for at least one role. */
  discoveryStarted: boolean;
  /** Candidates currently being processed or scored (not yet approved). */
  inProcessing: number;
  /** Discovery finished but produced nobody above the bar. */
  runsCompleted: number;
}): SurfaceStateContent {
  const { activeRoles, rolesInSetup, discoveryStarted, inProcessing, runsCompleted } = signals;

  if (activeRoles === 0 && rolesInSetup > 0) {
    return {
      id: "candidates.role-in-setup",
      icon: "candidates",
      tone: "waiting",
      title: "Candidates are on the way",
      why: `${rolesInSetup} role${rolesInSetup === 1 ? " is" : "s are"} in setup. Sourcing starts once the role is published.`,
      expected: EXPECTED_PROCESSING,
      populates: "Approved candidates appear here after the role goes live and the first search runs.",
      activity: "The role blueprint is being finalized before searching begins.",
      eta: "Expect the first candidates within 24–48 hours of the role going live.",
      action: { label: "See role progress", to: "/client/positions" },
    };
  }

  if (activeRoles === 0) {
    return {
      id: "candidates.no-roles",
      icon: "candidates",
      tone: "expected",
      title: "No candidates — no live role to search against",
      why: "We search per role, and you have no live role yet.",
      expected: EXPECTED_NEW,
      populates: "Publishing a role starts the search, and approved candidates land here.",
      activity: NOTHING_RUNNING,
      action: { label: "Add a role", to: "/intake" },
    };
  }

  if (!discoveryStarted) {
    return {
      id: "candidates.not-started",
      icon: "candidates",
      tone: "attention",
      title: "The search hasn't started yet",
      why: "Your role is live, but the search hasn't been started for it.",
      expected: NEEDS_ATTENTION,
      populates: "Starting the search puts our sourcing and evidence review to work on this role.",
      activity: "Nothing is searching for this role yet.",
      action: { label: "Start the search", to: "/client/positions" },
    };
  }

  if (inProcessing > 0) {
    return {
      id: "candidates.processing",
      icon: "candidates",
      tone: "waiting",
      title: "Candidates are being reviewed",
      why: `${inProcessing} application${inProcessing === 1 ? " is" : "s are"} still being read and assessed, so none are ready for you yet.`,
      expected: EXPECTED_PROCESSING,
      populates: "Each candidate appears once their CV is read, assessed and approved for you.",
      activity: "We are reading CVs and assessing them now.",
      eta: "Most CVs finish within a few minutes of upload.",
      action: { label: "See role progress", to: "/client/positions" },
    };
  }

  if (runsCompleted > 0) {
    return {
      id: "candidates.no-qualifiers",
      icon: "candidates",
      tone: "attention",
      title: "The search finished with nobody qualified",
      why: "The search finished, but nobody cleared your must-have requirements.",
      expected: NEEDS_ATTENTION,
      populates: "Widening must-haves, location or compensation usually reopens the pool.",
      activity: "No further searching until the requirements change.",
      action: { label: "Adjust requirements", to: "/client/positions" },
      secondaryAction: { label: "Talk to your team", to: "/client/conversations" },
    };
  }

  return {
    id: "candidates.awaiting-approval",
    icon: "candidates",
    tone: "waiting",
    title: "No candidates approved for you yet",
    why: "Discovery is underway; candidates stay hidden until they are reviewed and approved for your workspace.",
    expected: EXPECTED_PROCESSING,
    populates: "Approved candidates appear here with their evidence and fit.",
    activity: "Discovery and review are in progress.",
    eta: "First candidates usually arrive within 24–48 hours of a search starting.",
    action: { label: "See role progress", to: "/client/positions" },
  };
}


/* ------------------------------------------------------------- 3. evidence */

export function resolveNoEvidenceState(signals: {
  cvPresent: boolean;
  processingState?: string | null;
  extractionFailed?: boolean;
}): SurfaceStateContent {
  const { cvPresent, processingState, extractionFailed } = signals;

  if (!cvPresent) {
    return {
      id: "evidence.no-cv",
      icon: "evidence",
      tone: "attention",
      title: "No evidence — no CV to extract from",
      why: "Evidence is extracted from the candidate's CV, and no CV has been uploaded.",
      expected: NEEDS_ATTENTION,
      populates: "Once a PDF CV is attached, extraction produces requirement-level evidence.",
      activity: "No extraction is running.",
      action: { label: "Request a CV", to: "/client/conversations" },
    };
  }
  if (extractionFailed) {
    return {
      id: "evidence.failed",
      icon: "evidence",
      tone: "attention",
      title: "Evidence extraction didn't complete",
      why: "The CV was received but extraction failed, so there are no findings to show.",
      expected: NEEDS_ATTENTION,
      populates: "Re-running extraction, or a readable replacement CV, produces the evidence.",
      activity: "Nothing is retrying automatically.",
      action: { label: "Flag this to your team", to: "/client/conversations" },
    };
  }
  if (processingState && processingState !== "complete") {
    return {
      id: "evidence.processing",
      icon: "evidence",
      tone: "waiting",
      title: "Evidence is being extracted",
      why: "The CV is in the pipeline and findings are not written yet.",
      expected: EXPECTED_PROCESSING,
      populates: "Each requirement gets supporting quotes and a confidence level when extraction finishes.",
      activity: "Extraction is running for this candidate.",
      eta: "Usually a few minutes per CV.",
    };
  }
  return {
    id: "evidence.none",
    icon: "evidence",
    tone: "attention",
    title: "No evidence recorded",
    why: "Extraction ran but found nothing that maps to the requirements in this blueprint.",
    expected: NEEDS_ATTENTION,
    populates: "Sharper requirements, or a fuller CV, give the extractor something to match.",
    activity: "No extraction is running.",
    action: { label: "Review requirements", to: "/client/positions" },
  };
}

/* ----------------------------------------------------------- 4. agent runs */

export function resolveNoAgentRunsState(signals: {
  activeRoles: number;
  /** Any run queued or executing right now. */
  running: number;
}): SurfaceStateContent {
  if (signals.activeRoles === 0) {
    return {
      id: "agents.no-roles",
      icon: "agents",
      tone: "expected",
      title: "No agent activity yet",
      why: "Agents work on roles, and there is no live role in this workspace.",
      expected: EXPECTED_NEW,
      populates: "Publishing a role starts the setup, search, evidence and assessment work — each step logged here.",
      activity: NOTHING_RUNNING,
      action: { label: "Add a role", to: "/intake" },
    };
  }
  if (signals.running > 0) {
    return {
      id: "agents.running",
      icon: "agents",
      tone: "waiting",
      title: "Nothing has finished yet",
      why: `${signals.running} step${signals.running === 1 ? " is" : "s are"} in progress and nothing has finished.`,
      expected: EXPECTED_PROCESSING,
      populates: "Every step posts its result here — who, what, which role and the outcome.",
      activity: "Work is happening now.",
    };
  }
  return {
    id: "agents.idle",
    icon: "agents",
    tone: "attention",
    title: "No agent activity finished yet",
    why: "Your roles are live but no work has been started for them.",
    expected: NEEDS_ATTENTION,
    populates: "Starting a search — or raising the agent level — creates activity here.",
    activity: "Nothing is running right now.",
    action: { label: "Review agent settings", to: "/client/agents" },
  };
}

/* ------------------------------------------------------------ 5. analytics */

export function resolveNoAnalyticsState(signals: {
  /** Observations available (delivered candidates, decisions, etc.). */
  observations: number;
  /** Minimum before the metric means anything. */
  minimum: number;
  metricLabel?: string;
}): SurfaceStateContent {
  const { observations, minimum, metricLabel = "These metrics" } = signals;
  if (observations === 0) {
    return {
      id: "analytics.none",
      icon: "analytics",
      tone: "expected",
      title: "Not enough hiring activity to measure",
      why: `${metricLabel} are computed from real pipeline events, and none have been recorded yet.`,
      expected: EXPECTED_NEW,
      populates: `Delivered candidates, reviews, interviews and decisions. At least ${minimum} data point${minimum === 1 ? "" : "s"} before anything is shown.`,
      activity: NOTHING_RUNNING,
      action: { label: "See your roles", to: "/client/positions" },
    };
  }
  return {
    id: "analytics.insufficient",
    icon: "analytics",
    tone: "waiting",
    title: "Not enough data yet",
    why: `${observations} of ${minimum} data points recorded — too few to report honestly.`,
    expected: EXPECTED_PROCESSING,
    populates: `${minimum - observations} more decision${minimum - observations === 1 ? "" : "s"} or delivered candidate${minimum - observations === 1 ? "" : "s"} unlocks this metric.`,
    activity: "Metrics recompute automatically as pipeline events land.",
    action: { label: "Review candidates", to: "/client/candidates" },
  };
}

/* --------------------------------------------------------- 6. integrations */

export function resolveNoIntegrationsState(signals: {
  available: number;
  canConnect: boolean;
}): SurfaceStateContent {
  if (!signals.canConnect) {
    return {
      id: "integrations.no-permission",
      icon: "integrations",
      tone: "expected",
      title: "No connections set up",
      why: "Nothing is connected to this workspace, and your role can't change connections.",
      expected: EXPECTED_QUIET,
      populates: "A workspace owner connecting a tool — connections and their health then show here.",
      activity: "No sync is running because nothing is connected.",
      action: { label: "See available integrations", to: "/integrations" },
    };
  }
  return {
    id: "integrations.none",
    icon: "integrations",
    tone: "expected",
    title: "No connections yet",
    why: "This workspace hasn't connected any external tool, so there is no sync history.",
    expected: EXPECTED_NEW,
    populates: `Connecting any of the ${signals.available} available integrations starts a sync and reports its health here.`,
    activity: "No sync is running because nothing is connected.",
    action: { label: "Browse integrations", to: "/integrations" },
  };
}

/* ------------------------------------------------------------- 7. messages */

export function resolveNoMessagesState(signals: { activeRoles: number }): SurfaceStateContent {
  if (signals.activeRoles === 0) {
    return {
      id: "messages.no-roles",
      icon: "messages",
      tone: "expected",
      title: "No conversations yet",
      why: "Threads are attached to a role or a candidate, and you have neither yet.",
      expected: EXPECTED_NEW,
      populates: "Adding a role opens its thread; every message about it stays there and mirrors to email.",
      activity: NOTHING_RUNNING,
      action: { label: "Add a role", to: "/intake" },
    };
  }
  return {
    id: "messages.none",
    icon: "messages",
    tone: "expected",
    title: "No conversations yet",
    why: "Nobody has started a thread on your roles or candidates.",
    expected: EXPECTED_QUIET,
    populates: "One thread per role and per candidate, created the first time anyone writes.",
    activity: NOTHING_RUNNING,
    action: { label: "Start from a role", to: "/client/positions" },
    secondaryAction: { label: "See candidates", to: "/client/candidates" },
  };
}

/* ------------------------------------------------------------ 8. approvals */

export function resolveNoApprovalsState(signals: {
  /** Candidates delivered and awaiting your decision elsewhere. */
  awaitingDecision: number;
  activeRoles: number;
}): SurfaceStateContent {
  if (signals.awaitingDecision > 0) {
    return {
      id: "approvals.elsewhere",
      icon: "approvals",
      tone: "attention",
      title: "No approvals in this list",
      why: `Nothing is queued here, but ${signals.awaitingDecision} candidate${signals.awaitingDecision === 1 ? "" : "s"} still need a decision.`,
      expected: NEEDS_ATTENTION,
      populates: "Approval items are created when the platform needs a human gate to open.",
      activity: "Pipeline work is paused on those candidates until you decide.",
      action: { label: "Review candidates", to: "/client/candidates" },
    };
  }
  if (signals.activeRoles === 0) {
    return {
      id: "approvals.no-roles",
      icon: "approvals",
      tone: "expected",
      title: "Nothing to approve",
      why: "Approvals come from live roles, and you have none.",
      expected: EXPECTED_NEW,
      populates: "Once a role is live, oversight gates and candidate decisions queue up here.",
      activity: NOTHING_RUNNING,
      action: { label: "Add a role", to: "/intake" },
    };
  }
  return {
    id: "approvals.clear",
    icon: "approvals",
    tone: "expected",
    title: "You're clear — nothing needs approval",
    why: "Every gate on your roles is either open or not reached yet.",
    expected: EXPECTED_QUIET,
    populates: "New shortlists, interview requests and offers appear here when they need your sign-off.",
    activity: "Pipelines are running without waiting on you.",
    action: { label: "See role progress", to: "/client/positions" },
  };
}

/* --------------------------------------------------------- 9. audit events */

export function resolveNoAuditEventsState(signals: {
  hasFilters: boolean;
  windowLabel?: string;
}): SurfaceStateContent {
  if (signals.hasFilters) {
    return {
      id: "audit.filtered",
      icon: "audit",
      tone: "expected",
      title: "No audit events in this range",
      why: `Nothing was recorded${signals.windowLabel ? ` in ${signals.windowLabel}` : " in the selected range"} for these filters.`,
      expected: "Expected — the log is complete, the window is just quiet.",
      populates: "Widening the date range or clearing filters shows earlier events.",
      activity: "Logging is always on; no event matched this query.",
      action: { label: "Widen the range" },
    };
  }
  return {
    id: "audit.none",
    icon: "audit",
    tone: "expected",
    title: "No audit events yet",
    why: "No sensitive action — approval, release, deletion, payment — has happened in this workspace.",
    expected: EXPECTED_NEW,
    populates: "Every gated action writes an immutable entry with actor, target and time.",
    activity: "Audit logging is active and waiting for the first event.",
  };
}

/* ------------------------------------------------------- 10. notifications */

export function resolveNoNotificationsState(signals: {
  hasFilters?: boolean;
  activeRoles: number;
}): SurfaceStateContent {
  if (signals.hasFilters) {
    return resolveFilteredEmptyState(["notification filters"]);
  }
  if (signals.activeRoles === 0) {
    return {
      id: "notifications.no-roles",
      icon: "notifications",
      tone: "expected",
      title: "No notifications yet",
      why: "Notifications follow role activity, and there is no live role to report on.",
      expected: EXPECTED_NEW,
      populates: "Deliveries, interview requests, decisions and SLA warnings on your roles.",
      activity: NOTHING_RUNNING,
      action: { label: "Add a role", to: "/intake" },
    };
  }
  return {
    id: "notifications.none",
    icon: "notifications",
    tone: "expected",
    title: "You're up to date",
    why: "Nothing has happened on your roles that needs your attention.",
    expected: EXPECTED_QUIET,
    populates: "New candidate deliveries, interview updates and offer movement land here.",
    activity: "Pipelines are running; you'll be notified when something needs you.",
    action: { label: "Check notification settings", to: "/client/account?tab=notifications" },
  };
}

/* ----------------------------------------------------- 11. hiring outcomes */

export function resolveNoOutcomesState(signals: {
  activeRoles: number;
  interviews: number;
  offers: number;
}): SurfaceStateContent {
  const { activeRoles, interviews, offers } = signals;
  if (activeRoles === 0) {
    return {
      id: "outcomes.no-roles",
      icon: "outcomes",
      tone: "expected",
      title: "No hiring outcomes yet",
      why: "Outcomes are recorded per role, and none are live.",
      expected: EXPECTED_NEW,
      populates: "Hires, start dates and closed roles, once a pipeline reaches its end.",
      activity: NOTHING_RUNNING,
      action: { label: "Add a role", to: "/intake" },
    };
  }
  if (offers > 0) {
    return {
      id: "outcomes.offers-open",
      icon: "outcomes",
      tone: "waiting",
      title: "No hires recorded yet",
      why: `${offers} offer${offers === 1 ? " is" : "s are"} still open, so no outcome is final.`,
      expected: EXPECTED_PROCESSING,
      populates: "An accepted offer creates the hire record and the outcome shown here.",
      activity: "Offer follow-up is in progress.",
      action: { label: "Review offers", to: "/client/offers" },
    };
  }
  if (interviews > 0) {
    return {
      id: "outcomes.interviewing",
      icon: "outcomes",
      tone: "waiting",
      title: "No hiring outcomes yet",
      why: `${interviews} candidate${interviews === 1 ? " is" : "s are"} still interviewing — nothing has reached an offer.`,
      expected: EXPECTED_PROCESSING,
      populates: "Outcomes appear when an offer is made and accepted or declined.",
      activity: "Interview coordination is in progress.",
      action: { label: "See interviews", to: "/client/interviews" },
    };
  }
  return {
    id: "outcomes.none",
    icon: "outcomes",
    tone: "expected",
    title: "No hiring outcomes yet",
    why: "No candidate on your roles has reached interview or offer stage.",
    expected: EXPECTED_NEW,
    populates: "Interview results, offers and hires — each one closes the loop on a role.",
    activity: "Candidate review is the current step.",
    action: { label: "Review candidates", to: "/client/candidates" },
  };
}
