/**
 * Hiring Intelligence — recommendation derivation.
 *
 * Pure and deterministic. Turns the same records the metric builder reads into
 * a short list of *system-detected* recommendations: an observed condition, the
 * data behind it, one suggested action, a cautiously worded expected impact and
 * a deep link to the control that changes it.
 *
 * Rules held here:
 *  - Nothing is predicted. Impact is always phrased as a possibility, never a
 *    guarantee, and never carries a forecast number.
 *  - A recommendation is only emitted when the supporting records clear a
 *    documented minimum sample. Thin data produces silence, not a guess.
 *  - Candidate-identifying detail never appears in a recommendation body; only
 *    counts and stage names do. The deep link takes a permitted user to the
 *    record itself.
 *  - General best practices are a separate, static list and are never mixed in
 *    with detected conditions.
 */

import { median, pct } from "./hiring-intelligence";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export type RecommendationSeverity = "act_now" | "review" | "watch";

export type RecommendationKey =
  | "requirement_too_restrictive"
  | "pool_too_narrow"
  | "stage_stalled"
  | "evidence_incomplete"
  | "approval_queue_growing"
  | "response_rate_declining"
  | "score_distribution_compressed"
  | "agent_runs_failing";

export type Recommendation = {
  key: RecommendationKey;
  /** Stable per-workspace identity, so dismissals survive a recompute. */
  id: string;
  title: string;
  severity: RecommendationSeverity;
  /** What the system saw. Plain language, no jargon. */
  observed: string;
  /** The figures behind the observation, each independently checkable. */
  evidence: { label: string; value: string }[];
  /** The one thing to do next. */
  suggestedAction: string;
  /** Cautious, non-guaranteed phrasing. */
  expectedImpact: string;
  link: { label: string; to: string; search?: Record<string, string> };
  /** Which metric card this was derived from, for traceability. */
  derivedFrom: string;
  dismissible: boolean;
  snoozable: boolean;
};

export type BestPractice = {
  key: string;
  title: string;
  body: string;
  link?: { label: string; to: string } | null;
};

export type RecommendationSignals = {
  /** Open or in-progress tasks in scope — the approval/action queue. */
  tasks: Row[];
  /** Outreach touches in scope, current and prior window. */
  outreachTouches: Row[];
};

/**
 * Documented thresholds. Kept in one place so they can be reviewed, tested and
 * argued with rather than being buried in the logic.
 */
export const RECOMMENDATION_THRESHOLDS = {
  /** Median must-have coverage at or below this reads as restrictive. */
  restrictiveCoverage: 0.5,
  /** Minimum scored candidates before coverage or spread is judged at all. */
  minScoredForCoverage: 5,
  /** Client-visible candidates at or below this on a live role reads as narrow. */
  narrowPool: 3,
  /** Days without a stage move before a candidate counts as stalled. */
  stallDays: 7,
  /** Stalled candidates in one stage before it is called out. */
  minStalledPerStage: 2,
  /** Share of findings quoting a source passage below this reads as incomplete. */
  evidenceQuotedShare: 0.7,
  minEvidenceItems: 5,
  /** Open queue items before the queue is called out. */
  approvalQueue: 5,
  /** Overdue queue items alone are enough to call it out. */
  approvalOverdue: 1,
  /** Relative fall in reply rate versus the prior window. */
  responseRateDrop: 0.25,
  /** Minimum sent touches in each window before reply rate is compared. */
  minTouchesPerWindow: 10,
  /** Score spread (p90 − p10) at or below this reads as compressed. */
  compressedSpread: 10,
  /** Failed agent runs before it is surfaced as a recommendation. */
  failedRuns: 1,
} as const;

const DAY_MS = 86_400_000;

function iso(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function ms(v: unknown): number | null {
  const raw = iso(v);
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? null : t;
}

function scoreOf(run: Row): number | null {
  const v = run.final_score ?? run.score;
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function quantile(sorted: number[], q: number): number | null {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const loV = sorted[lo];
  const hiV = sorted[hi];
  if (loV === undefined || hiV === undefined) return null;
  return loV + (hiV - loV) * (pos - lo);
}

const STAGE_LABELS: Record<string, string> = {
  delivered: "awaiting your decision",
  shortlisted: "shortlisted",
  interview_process: "in interview",
  offer: "at offer",
};

const OPEN_STAGES = Object.keys(STAGE_LABELS);

const LIVE_POSITION_STATUSES = new Set(["published", "live", "active", "open", "sourcing"]);

/**
 * Derive system-detected recommendations from records.
 *
 * `scope` is only used to build stable ids so dismissals are scoped to the
 * filter the user was looking at.
 */
export function deriveRecommendations(input: {
  positions: Row[];
  matches: Row[];
  history: Row[];
  scoreRuns: Row[];
  evidenceItems: Row[];
  agentRuns: Row[];
  feedEvents?: Row[];
  signals: RecommendationSignals;
  window: { days: number; from: string; priorFrom: string; to: string };
  positionId: string | null;
  now?: Date;
}): Recommendation[] {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const T = RECOMMENDATION_THRESHOLDS;
  const scope = input.positionId ?? "all";
  const out: Recommendation[] = [];
  const fromMs = ms(input.window.from) ?? 0;
  const priorFromMs = ms(input.window.priorFrom) ?? 0;

  const id = (key: RecommendationKey, suffix = "") =>
    `${key}:${scope}${suffix ? `:${suffix}` : ""}`;

  // ── 1 · Requirement too restrictive ────────────────────────────────────
  {
    const norm = (v: number) => (v > 1 ? v / 100 : v);
    const coverage = input.scoreRuns
      .map((r) => (r.must_have_coverage == null ? null : norm(Number(r.must_have_coverage))))
      .filter((v): v is number => v !== null && !Number.isNaN(v));
    const med = median(coverage);
    if (coverage.length >= T.minScoredForCoverage && med !== null && med <= T.restrictiveCoverage) {
      const belowHalf = coverage.filter((v) => v < 0.5).length;
      out.push({
        key: "requirement_too_restrictive",
        id: id("requirement_too_restrictive"),
        title: "Your must-have list may be filtering out viable people",
        severity: "review",
        observed: `The median scored candidate meets only ${pct(med)} of the must-have requirements on this scope.`,
        evidence: [
          { label: "Scored candidates measured", value: String(coverage.length) },
          { label: "Median must-have coverage", value: pct(med) },
          { label: "Candidates under half coverage", value: `${belowHalf} of ${coverage.length}` },
        ],
        suggestedAction:
          "Open the role requirements and check which must-haves are rarely evidenced. Moving one or two into 'preferred' is usually enough to test the effect.",
        expectedImpact:
          "Relaxing a requirement that few candidates evidence may widen who reaches you. It is not guaranteed to, and it does change the bar you are hiring against — so review the requirement itself before changing it.",
        link: { label: "Review role requirements", to: "/client/positions" },
        derivedFrom: "requirement_coverage",
        dismissible: true,
        snoozable: true,
      });
    }
  }

  // ── 2 · Candidate pool too narrow ──────────────────────────────────────
  {
    const liveRoles = input.positions.filter((p) =>
      LIVE_POSITION_STATUSES.has(String(p.status ?? "")),
    );
    const perRole = new Map<string, number>();
    for (const m of input.matches) {
      const pid = String(m.position_id ?? "");
      if (!pid) continue;
      perRole.set(pid, (perRole.get(pid) ?? 0) + 1);
    }
    const narrow = liveRoles.filter((p) => (perRole.get(String(p.id)) ?? 0) <= T.narrowPool);
    if (liveRoles.length && narrow.length) {
      out.push({
        key: "pool_too_narrow",
        id: id("pool_too_narrow"),
        title:
          narrow.length === 1
            ? "One live role has very few candidates released to you"
            : `${narrow.length} live roles have very few candidates released to you`,
        severity: "review",
        observed: `${narrow.length} of ${liveRoles.length} live role${liveRoles.length === 1 ? "" : "s"} currently ${narrow.length === 1 ? "has" : "have"} ${T.narrowPool} or fewer candidates visible to you.`,
        evidence: [
          { label: "Live roles in scope", value: String(liveRoles.length) },
          { label: "Roles at or below threshold", value: String(narrow.length) },
          { label: "Threshold used", value: `${T.narrowPool} visible candidates` },
        ],
        suggestedAction:
          "Open the role and widen the constraints you control — location or work model, seniority band, or a must-have that is hard to evidence. Your delivery lead can also confirm whether sourcing is still in progress.",
        expectedImpact:
          "Broadening a constraint may increase the number of candidates that qualify. A narrow pool can also simply mean sourcing is early, so check the role's stage before changing anything.",
        link: { label: "Open your roles", to: "/client/positions" },
        derivedFrom: "pipeline_health",
        dismissible: true,
        snoozable: true,
      });
    }
  }

  // ── 3 · Pipeline stage stalled ─────────────────────────────────────────
  {
    const lastMove = new Map<string, number>();
    for (const h of input.history) {
      const at = ms(h.created_at);
      if (at === null) continue;
      const key = String(h.candidate_match_id ?? "");
      const prev = lastMove.get(key);
      if (prev === undefined || at > prev) lastMove.set(key, at);
    }
    const byStage = new Map<string, { count: number; oldestDays: number }>();
    for (const m of input.matches) {
      const stage = String(m.stage ?? "");
      if (!OPEN_STAGES.includes(stage)) continue;
      const at = lastMove.get(String(m.id)) ?? ms(m.updated_at) ?? ms(m.delivered_at);
      if (at === null) continue;
      const days = Math.floor((nowMs - at) / DAY_MS);
      if (days < T.stallDays) continue;
      const cur = byStage.get(stage) ?? { count: 0, oldestDays: 0 };
      byStage.set(stage, {
        count: cur.count + 1,
        oldestDays: Math.max(cur.oldestDays, days),
      });
    }
    const worst = Array.from(byStage.entries())
      .filter(([, v]) => v.count >= T.minStalledPerStage)
      .sort((a, b) => b[1].count - a[1].count || b[1].oldestDays - a[1].oldestDays)[0];
    if (worst) {
      const [stage, v] = worst;
      const label = STAGE_LABELS[stage] ?? stage.replace(/_/g, " ");
      out.push({
        key: "stage_stalled",
        id: id("stage_stalled", stage),
        title: `${v.count} candidate${v.count === 1 ? "" : "s"} have sat ${label} for over ${T.stallDays} days`,
        severity: stage === "delivered" || stage === "offer" ? "act_now" : "review",
        observed: `Nothing has moved for ${v.count} candidate${v.count === 1 ? "" : "s"} in the "${label}" stage. The longest has waited ${v.oldestDays} days.`,
        evidence: [
          { label: "Stage", value: label },
          { label: "Candidates waiting", value: String(v.count) },
          { label: "Longest wait", value: `${v.oldestDays} days` },
          { label: "Threshold used", value: `${T.stallDays} days without a stage change` },
        ],
        suggestedAction:
          stage === "delivered"
            ? "Open the decision queue and clear the candidates waiting on you. Every decision is reversible for a short window after you make it."
            : "Open the candidates in this stage and record the next step, or ask your delivery lead to chase the outstanding side.",
        expectedImpact:
          "Clearing a stalled stage usually shortens the overall time to hire and reduces the chance a candidate withdraws. The effect depends on why each one stalled.",
        link:
          stage === "delivered"
            ? { label: "Open the decision queue", to: "/client" }
            : { label: "Open candidates", to: "/client/candidates" },
        derivedFrom: "stalled_stages",
        dismissible: false,
        snoozable: true,
      });
    }
  }

  // ── 4 · Evidence completeness low ──────────────────────────────────────
  {
    const total = input.evidenceItems.length;
    const quoted = input.evidenceItems.filter((e) => !!iso(e.source_passage)).length;
    const needsCheck = input.evidenceItems.filter(
      (e) => e.validation_need && e.validation_need !== "none",
    ).length;
    const share = total ? quoted / total : null;
    if (total >= T.minEvidenceItems && share !== null && share < T.evidenceQuotedShare) {
      out.push({
        key: "evidence_incomplete",
        id: id("evidence_incomplete"),
        title: "Some findings are not backed by a quoted source passage",
        severity: "review",
        observed: `${pct(share)} of recorded findings quote the exact passage they came from, below the ${pct(T.evidenceQuotedShare)} level this workspace treats as complete.`,
        evidence: [
          { label: "Findings recorded", value: String(total) },
          { label: "With a source quote", value: `${quoted} of ${total}` },
          { label: "Flagged for checking", value: String(needsCheck) },
        ],
        suggestedAction:
          "Open the affected candidates and request or review the missing evidence before you rely on their scores.",
        expectedImpact:
          "Filling the gaps makes the scores safer to act on. It will not necessarily change the ranking, and unquoted findings are already marked in the record so you are not acting blind.",
        link: { label: "Review evidence", to: "/client/candidates" },
        derivedFrom: "evidence_completeness",
        dismissible: true,
        snoozable: true,
      });
    }
  }

  // ── 5 · Approval / action queue growing ────────────────────────────────
  {
    const open = input.signals.tasks.filter(
      (t) => t.status === "open" || t.status === "in_progress",
    );
    const overdue = open.filter((t) => {
      const due = ms(t.due_at);
      return due !== null && due < nowMs;
    }).length;
    const blocking = open.filter((t) => t.blocking === true).length;
    if (open.length >= T.approvalQueue || overdue >= T.approvalOverdue) {
      out.push({
        key: "approval_queue_growing",
        id: id("approval_queue_growing"),
        title:
          overdue > 0
            ? `${overdue} item${overdue === 1 ? "" : "s"} in your queue are past their date`
            : `${open.length} items are waiting in your queue`,
        severity: overdue > 0 || blocking > 0 ? "act_now" : "review",
        observed: `${open.length} open item${open.length === 1 ? "" : "s"} in scope, ${overdue} past the agreed date and ${blocking} marked as blocking progress.`,
        evidence: [
          { label: "Open items", value: String(open.length) },
          { label: "Past their date", value: String(overdue) },
          { label: "Blocking progress", value: String(blocking) },
        ],
        suggestedAction:
          "Open pending approvals and clear the blocking items first — those are the ones holding other work up.",
        expectedImpact:
          "Clearing blocking items lets dependent work resume. Items not marked blocking can wait without stopping the pipeline.",
        link: { label: "Open pending approvals", to: "/client/approvals" },
        derivedFrom: "role_risk",
        dismissible: false,
        snoozable: true,
      });
    }
  }

  // ── 6 · Response rate declining ────────────────────────────────────────
  {
    const sentStates = new Set(["sent", "delivered", "opened", "replied", "bounced"]);
    const partition = (from: number, to: number) =>
      input.signals.outreachTouches.filter((t) => {
        if (t.is_test_record === true) return false;
        if (t.direction && t.direction !== "outbound") return false;
        if (!sentStates.has(String(t.state ?? ""))) return false;
        const at = ms(t.sent_at) ?? ms(t.created_at);
        return at !== null && at >= from && at < to;
      });
    const current = partition(fromMs, nowMs + 1);
    const prior = partition(priorFromMs, fromMs);
    const rate = (rows: Row[]) =>
      rows.length ? rows.filter((r) => !!iso(r.replied_at)).length / rows.length : null;
    const curRate = rate(current);
    const priorRate = rate(prior);
    if (
      current.length >= T.minTouchesPerWindow &&
      prior.length >= T.minTouchesPerWindow &&
      curRate !== null &&
      priorRate !== null &&
      priorRate > 0 &&
      (priorRate - curRate) / priorRate >= T.responseRateDrop
    ) {
      const drop = (priorRate - curRate) / priorRate;
      out.push({
        key: "response_rate_declining",
        id: id("response_rate_declining"),
        title: "Candidate reply rate has fallen against the previous period",
        severity: "watch",
        observed: `Replies to outbound contact ran at ${pct(curRate)} in the last ${input.window.days} days, against ${pct(priorRate)} in the ${input.window.days} days before — a relative fall of ${pct(drop)}.`,
        evidence: [
          { label: "Outbound messages, this period", value: String(current.length) },
          { label: "Reply rate, this period", value: pct(curRate) },
          { label: "Outbound messages, prior period", value: String(prior.length) },
          { label: "Reply rate, prior period", value: pct(priorRate) },
        ],
        suggestedAction:
          "Review the messaging and targeting on the active campaigns — the opening line, the channel mix and who is being contacted.",
        expectedImpact:
          "Changing message or targeting may recover some reply rate. Reply rates also move with seasonality and role type, so treat one period as a signal rather than a verdict.",
        link: { label: "Review outreach", to: "/client/outreach" },
        derivedFrom: "funnel_conversion",
        dismissible: true,
        snoozable: true,
      });
    }
  }

  // ── 7 · Score distribution compressed ──────────────────────────────────
  {
    const scores = input.scoreRuns
      .map(scoreOf)
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);
    const p10 = quantile(scores, 0.1);
    const p90 = quantile(scores, 0.9);
    if (
      scores.length >= T.minScoredForCoverage &&
      p10 !== null &&
      p90 !== null &&
      p90 - p10 <= T.compressedSpread
    ) {
      const spread = Number((p90 - p10).toFixed(1));
      const med = median(scores);
      out.push({
        key: "score_distribution_compressed",
        id: id("score_distribution_compressed"),
        title: "Scores are clustered too tightly to separate candidates",
        severity: "review",
        observed: `Across ${scores.length} scoring runs, the 10th and 90th percentile sit only ${spread} points apart, so the score is not telling candidates apart.`,
        evidence: [
          { label: "Scoring runs measured", value: String(scores.length) },
          { label: "Spread (10th–90th percentile)", value: `${spread} points` },
          { label: "Median score", value: med === null ? "—" : String(Number(med.toFixed(1))) },
          { label: "Threshold used", value: `${T.compressedSpread} points or less` },
        ],
        suggestedAction:
          "Review the rubric weighting for this scope with your delivery lead — a compressed spread usually means several requirements carry near-identical weight.",
        expectedImpact:
          "Re-weighting can make real differences visible in the score. It changes how candidates rank, so any change is versioned and previous runs stay intact.",
        link: { label: "Review scoring", to: "/client/candidates" },
        derivedFrom: "score_distribution",
        dismissible: true,
        snoozable: true,
      });
    }
  }

  // ── 8 · Agent runs failing ─────────────────────────────────────────────
  {
    const failed = [
      ...input.agentRuns,
      ...(input.feedEvents ?? [])
        .filter((f) => f.event_type === "failed" || f.event_type === "error") // hypothetical if feed carries them
        .map((f) => ({ outcome: "failed", occurred_at: f.occurred_at })),
    ].filter((r) => {
      const at = ms(r.occurred_at);
      if (at === null || at < fromMs) return false;
      const o = String(r.outcome ?? "");
      return o === "failed" || o === "error";
    }).length;
    if (failed >= T.failedRuns) {
      out.push({
        key: "agent_runs_failing",
        id: id("agent_runs_failing"),
        title: `${failed} automated run${failed === 1 ? "" : "s"} failed in this period`,
        severity: "watch",
        observed: `${failed} recorded agent run${failed === 1 ? "" : "s"} in the last ${input.window.days} days ended in failure, which can leave gaps in candidate records.`,
        evidence: [
          { label: "Failed runs", value: String(failed) },
          { label: "Window", value: `Last ${input.window.days} days` },
        ],
        suggestedAction:
          "Open agent activity to see which step failed. Your delivery lead is alerted automatically, so this is for visibility rather than repair.",
        expectedImpact:
          "Re-running a failed step usually restores the missing records. Until it does, treat any affected candidate's evidence as incomplete.",
        link: { label: "Open agent activity", to: "/client/agents" },
        derivedFrom: "agent_run_outcomes",
        dismissible: true,
        snoozable: true,
      });
    }
  }

  const order: Record<RecommendationSeverity, number> = { act_now: 0, review: 1, watch: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

/**
 * General best practices. Static guidance, never derived from records, and kept
 * apart from detected conditions so the two are never confused.
 */
export const BEST_PRACTICES: BestPractice[] = [
  {
    key: "decide_in_batches",
    title: "Decide in batches, not one at a time",
    body: "Comparing candidates side by side gives a steadier bar than reading them in isolation, and it is faster.",
    link: { label: "Open the decision queue", to: "/client" },
  },
  {
    key: "few_must_haves",
    title: "Keep must-haves to the few that genuinely gate the job",
    body: "Everything else belongs in preferred. Must-haves exclude; preferred only ranks.",
    link: { label: "Open your roles", to: "/client/positions" },
  },
  {
    key: "read_the_evidence",
    title: "Read the evidence, not just the score",
    body: "Each finding carries the passage it came from. Two candidates on the same score can be evidenced very differently.",
    link: { label: "Open candidates", to: "/client/candidates" },
  },
  {
    key: "keep_feedback_fast",
    title: "Give interview feedback within a day",
    body: "Structured feedback recorded while it is fresh keeps the scorecard useful and keeps candidates warm.",
    link: { label: "Open interviews", to: "/client/interviews" },
  },
];
