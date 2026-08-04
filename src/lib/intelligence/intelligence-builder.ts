/**
 * Hiring Intelligence — pure metric builder.
 *
 * Takes raw records and returns the metric set. Pure and deterministic, so it
 * is unit-testable and cannot accidentally reach the network or invent data.
 *
 * Every metric here answers a decision question. If a question cannot be
 * answered from the records provided, the metric says so — it does not guess.
 */

import { computeRoleRisk, STALL_DAYS } from "@/lib/client-role-risk";
import {
  bucketScores,
  compare,
  daysAgo,
  daysLabel,
  DEFAULT_STALE_AFTER_DAYS,
  median,
  MIN_SAMPLE_DISTRIBUTION,
  MIN_SAMPLE_MEDIAN,
  pct,
  resolveMetricStatus,
  type IntelligenceMetric,
  type MetricPoint,
} from "./hiring-intelligence";
import {
  BEST_PRACTICES,
  deriveRecommendations,
  type BestPractice,
  type Recommendation,
} from "./recommendations";


// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const DAY_MS = 86_400_000;

export type IntelligenceRecords = {
  positions: Row[];
  matches: Row[];
  history: Row[];
  scoreRuns: Row[];
  evidenceItems: Row[];
  agentRuns: Row[];
  commitments: Row[];
  interviews: Row[];
  marketSignals: Row[];
  /** Open work queue items (approvals, actions). Optional: absent means none read. */
  tasks?: Row[];
  /** Outbound outreach touches, current and prior window. */
  outreachTouches?: Row[];
  window: { days: number; from: string; priorFrom: string; to: string };
  positionId: string | null;
};

export type IntelligenceResult = {
  window: IntelligenceRecords["window"];
  computedAt: string;
  metrics: IntelligenceMetric[];
  /** System-detected recommendations, derived from the same records. */
  recommendations: Recommendation[];
  /** Static guidance, never derived from records. Kept separate on purpose. */
  bestPractices: BestPractice[];
  /** True when the workspace holds no records at all in scope. */
  emptyWorkspace: boolean;
};


const FUNNEL_STEPS = [
  { key: "delivered", label: "Shown to you" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "interview_process", label: "Interviewed" },
  { key: "offer", label: "Offered" },
  { key: "hired", label: "Hired" },
];

const PIPELINE_STAGES = [
  { key: "delivered", label: "Awaiting your decision", tone: "warn" as const },
  { key: "shortlisted", label: "Shortlisted", tone: "good" as const },
  { key: "interview_process", label: "In interview", tone: "good" as const },
  { key: "offer", label: "At offer", tone: "good" as const },
  { key: "hired", label: "Hired", tone: "good" as const },
  { key: "not_moving_forward", label: "Not moving forward", tone: "neutral" as const },
];

function iso(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function newest(rows: Row[], field: string): string | null {
  let best: number | null = null;
  let bestIso: string | null = null;
  for (const r of rows) {
    const raw = iso(r[field]);
    if (!raw) continue;
    const t = new Date(raw).getTime();
    if (Number.isNaN(t)) continue;
    if (best === null || t > best) {
      best = t;
      bestIso = raw;
    }
  }
  return bestIso;
}

function inWindow(rowIso: string | null, from: string, to: string): boolean {
  if (!rowIso) return false;
  const t = new Date(rowIso).getTime();
  return t >= new Date(from).getTime() && t <= new Date(to).getTime();
}

function inPriorWindow(rowIso: string | null, priorFrom: string, from: string): boolean {
  if (!rowIso) return false;
  const t = new Date(rowIso).getTime();
  return t >= new Date(priorFrom).getTime() && t < new Date(from).getTime();
}

function scoreOf(run: Row): number | null {
  const v = run.final_score ?? run.score;
  return typeof v === "number" ? v : v == null ? null : Number(v);
}

function positionLink(positionId: string | null, orgId?: string) {
  void orgId;
  return positionId
    ? { label: "Open the role", to: "/client/positions" }
    : { label: "Open your roles", to: "/client/positions" };
}

export function buildIntelligence(
  records: IntelligenceRecords,
  now: Date = new Date(),
): IntelligenceResult {
  const { window: win } = records;
  const computedAt = now.toISOString();
  const metrics: IntelligenceMetric[] = [];

  const fresh = (latestAt: string | null, staleAfterDays = DEFAULT_STALE_AFTER_DAYS) => ({
    latestAt,
    computedAt,
    staleAfterDays,
  });

  // ── 1 · Pipeline health ────────────────────────────────────────────────
  {
    const openStages = new Set(["delivered", "shortlisted", "interview_process", "offer"]);
    const counts = new Map<string, number>();
    for (const m of records.matches) counts.set(m.stage, (counts.get(m.stage) ?? 0) + 1);
    const points: MetricPoint[] = PIPELINE_STAGES.map((s) => ({
      key: s.key,
      label: s.label,
      value: counts.get(s.key) ?? 0,
      tone: s.tone,
      note: `${counts.get(s.key) ?? 0} candidate${(counts.get(s.key) ?? 0) === 1 ? "" : "s"} at this stage right now`,
    }));
    const live = PIPELINE_STAGES.filter((s) => openStages.has(s.key)).reduce(
      (sum, s) => sum + (counts.get(s.key) ?? 0),
      0,
    );
    const awaiting = counts.get("delivered") ?? 0;
    const latestAt = newest(records.matches, "updated_at") ?? newest(records.matches, "created_at");
    const state = resolveMetricStatus({
      counted: records.matches.length,
      latestAt,
      staleAfterDays: STALL_DAYS,
      now,
    });
    metrics.push({
      key: "pipeline_health",
      title: "Pipeline health",
      question: "Do I have enough live candidates to fill these roles?",
      status: state.status,
      statusReason: state.reason,
      value: state.status === "no_data" ? null : String(live),
      valueNote: state.status === "no_data" ? null : "candidates still in play",
      tone: live === 0 ? "bad" : awaiting > 0 ? "warn" : "good",
      comparison: null,
      freshness: fresh(latestAt, STALL_DAYS),
      explanation: `Counts every candidate released to your workspace, by the stage they sit at now. "In play" excludes hired and not-moving-forward. Based on ${records.matches.length} released candidate${records.matches.length === 1 ? "" : "s"}.`,
      action:
        awaiting > 0
          ? {
              label: `Decide on ${awaiting}`,
              detail: `${awaiting} candidate${awaiting === 1 ? " is" : "s are"} waiting on your decision. Nothing moves until you act.`,
              link: { label: "Open the decision queue", to: "/client" },
            }
          : null,
      link: { label: "See all candidates", to: "/client/candidates" },
      chart: {
        kind: "bars",
        unit: "candidates",
        valueHeading: "Candidates",
        points,
      },
      sample: { counted: records.matches.length, expected: null, unit: "released candidates" },
    });
  }

  // ── 2 · Time to first qualified candidate ──────────────────────────────
  {
    const byPosition = new Map<string, number[]>();
    for (const m of records.matches) {
      const d = iso(m.delivered_at);
      if (!d) continue;
      const list = byPosition.get(m.position_id) ?? [];
      list.push(new Date(d).getTime());
      byPosition.set(m.position_id, list);
    }
    for (const l of byPosition.values()) l.sort((a, b) => a - b);

    const current: number[] = [];
    const prior: number[] = [];
    for (const p of records.positions) {
      const base = iso(p.published_at) ?? iso(p.approved_at) ?? iso(p.created_at);
      const first = byPosition.get(p.id)?.[0];
      if (!base || !first) continue;
      const elapsed = (first - new Date(base).getTime()) / DAY_MS;
      const firstIso = new Date(first).toISOString();
      if (inWindow(firstIso, win.from, win.to)) current.push(elapsed);
      else if (inPriorWindow(firstIso, win.priorFrom, win.from)) prior.push(elapsed);
    }
    const value = median(current);
    const cmp = compare(value, median(prior), { lowerIsBetter: true, unit: "days" });
    const rolesWithoutFirst = records.positions.filter(
      (p) => ["active", "approved", "submitted"].includes(String(p.status)) && !byPosition.get(p.id)?.length,
    );
    const latestAt = newest(records.matches, "delivered_at");
    const state = resolveMetricStatus({
      counted: current.length,
      minSample: MIN_SAMPLE_MEDIAN,
      expected: records.positions.length || null,
      latestAt,
      now,
    });
    metrics.push({
      key: "time_to_first_qualified",
      title: "Time to first qualified candidate",
      question: "How long does a new role wait before it has someone worth reading?",
      status: state.status,
      statusReason: state.reason,
      value: value === null ? null : daysLabel(value),
      valueNote: value === null ? null : `median across ${current.length} role${current.length === 1 ? "" : "s"}`,
      tone: value === null ? "neutral" : value <= 7 ? "good" : value <= 14 ? "warn" : "bad",
      comparison: { baselineLabel: `previous ${win.days} days`, ...cmp },
      freshness: fresh(latestAt),
      explanation:
        "Measured from the day a role went live to the moment its first candidate was released to you. Roles with no candidate yet are excluded from the median and counted separately below.",
      action: rolesWithoutFirst.length
        ? {
            label: `${rolesWithoutFirst.length} role${rolesWithoutFirst.length === 1 ? "" : "s"} with nobody yet`,
            detail: rolesWithoutFirst
              .slice(0, 3)
              .map((p) => p.title)
              .join(", "),
            link: positionLink(records.positionId),
          }
        : null,
      link: positionLink(records.positionId),
      chart: null,
      sample: {
        counted: current.length,
        expected: records.positions.length || null,
        unit: "roles measured",
      },
    });
  }

  // ── 3 · Time to shortlist ──────────────────────────────────────────────
  {
    const deliveries = new Map<string, number[]>();
    for (const m of records.matches) {
      const d = iso(m.delivered_at);
      if (!d) continue;
      const list = deliveries.get(m.position_id) ?? [];
      list.push(new Date(d).getTime());
      deliveries.set(m.position_id, list);
    }
    for (const l of deliveries.values()) l.sort((a, b) => a - b);

    const actual: number[] = [];
    const promised: number[] = [];
    const points: MetricPoint[] = [];
    for (const c of records.commitments) {
      const base = iso(c.baseline_at);
      const times = deliveries.get(c.position_id) ?? [];
      const size = Number(c.shortlist_size ?? 0);
      if (!base || size <= 0) continue;
      const title =
        records.positions.find((p) => p.id === c.position_id)?.title ?? "Role";
      if (times.length >= size) {
        const elapsed = (times[size - 1] - new Date(base).getTime()) / DAY_MS;
        actual.push(elapsed);
        promised.push(Number(c.first_shortlist_days ?? 0));
        points.push({
          key: c.position_id,
          label: title,
          value: Number(elapsed.toFixed(1)),
          compareValue: Number(c.first_shortlist_days ?? 0),
          tone: elapsed <= Number(c.first_shortlist_days ?? 0) ? "good" : "bad",
          note: `${daysLabel(elapsed)} actual against ${c.first_shortlist_days} promised`,
        });
      } else {
        points.push({
          key: c.position_id,
          label: title,
          value: 0,
          compareValue: Number(c.first_shortlist_days ?? 0),
          tone: "neutral",
          note: `Only ${times.length} of ${size} candidates delivered — not measurable yet`,
        });
      }
    }
    const value = median(actual);
    const promise = median(promised);
    const cmp = compare(value, promise, { lowerIsBetter: true, unit: "days" });
    const latestAt = newest(records.matches, "delivered_at");
    const state = resolveMetricStatus({
      error: records.commitments.length === 0 ? null : null,
      counted: actual.length,
      minSample: 1,
      expected: records.commitments.length || null,
      latestAt,
      now,
    });
    metrics.push({
      key: "time_to_shortlist",
      title: "Time to full shortlist",
      question: "Are we delivering the shortlist we committed to, on time?",
      status:
        records.commitments.length === 0
          ? "no_data"
          : state.status,
      statusReason:
        records.commitments.length === 0
          ? "No service commitment is set on your roles, so there is no promise to measure against."
          : state.reason,
      value: value === null ? null : daysLabel(value),
      valueNote:
        value === null
          ? null
          : `against ${promise === null ? "—" : daysLabel(promise)} committed`,
      tone:
        value === null || promise === null
          ? "neutral"
          : value <= promise
            ? "good"
            : "bad",
      comparison: { baselineLabel: "committed at role launch", ...cmp },
      freshness: fresh(latestAt),
      explanation:
        "Each role has a committed shortlist size and date at launch. This compares the day the last shortlist slot was filled with the day we promised it. Roles still filling are listed but excluded from the median.",
      action:
        value !== null && promise !== null && value > promise
          ? {
              label: "We are behind commitment",
              detail: `The shortlist is landing ${daysLabel(value - promise)} later than committed. Your delivery lead should have raised this — ask for the plan.`,
              link: { label: "Open deliveries", to: "/client/deliveries" },
            }
          : null,
      link: { label: "Open deliveries", to: "/client/deliveries" },
      chart: points.length
        ? {
            kind: "paired-bars",
            unit: "days",
            valueHeading: "Actual (days)",
            compareHeading: "Committed (days)",
            points,
          }
        : null,
      sample: {
        counted: actual.length,
        expected: records.commitments.length || null,
        unit: "roles with a commitment",
      },
    });
  }

  // ── 4 · Candidate score distribution ───────────────────────────────────
  {
    const runsInWindow = records.scoreRuns.filter(
      (r) =>
        r.status !== "failed" &&
        scoreOf(r) !== null &&
        inWindow(iso(r.completed_at) ?? iso(r.created_at), win.from, win.to),
    );
    const scores = runsInWindow.map((r) => scoreOf(r) as number);
    const priorScores = records.scoreRuns
      .filter(
        (r) =>
          r.status !== "failed" &&
          scoreOf(r) !== null &&
          inPriorWindow(iso(r.completed_at) ?? iso(r.created_at), win.priorFrom, win.from),
      )
      .map((r) => scoreOf(r) as number);
    const med = median(scores);
    const cmp = compare(med, median(priorScores), { lowerIsBetter: false, unit: "pts" });
    const strong = scores.filter((s) => s >= 85).length;
    const latestAt = newest(records.scoreRuns, "completed_at") ?? newest(records.scoreRuns, "created_at");
    const state = resolveMetricStatus({
      counted: scores.length,
      minSample: MIN_SAMPLE_DISTRIBUTION,
      latestAt,
      now,
    });
    metrics.push({
      key: "score_distribution",
      title: "Candidate score distribution",
      question: "Is the quality of what we surface good enough, or is the brief too narrow?",
      status: state.status,
      statusReason: state.reason,
      value: med === null ? null : `${Math.round(med)}`,
      valueNote: med === null ? null : `median score · ${strong} scored 85+`,
      tone: med === null ? "neutral" : med >= 75 ? "good" : med >= 60 ? "warn" : "bad",
      comparison: { baselineLabel: `previous ${win.days} days`, ...cmp },
      freshness: fresh(latestAt),
      explanation: `Scores come from completed scoring runs against your role's rubric — every point is backed by evidence in the candidate record. Distribution over ${scores.length} run${scores.length === 1 ? "" : "s"} in this window.`,
      action:
        scores.length >= MIN_SAMPLE_DISTRIBUTION && strong === 0
          ? {
              label: "Nothing is clearing the top band",
              detail:
                "No candidate scored 85 or above in this window. That usually means the must-haves are too tight for the market, not that nobody is out there.",
              link: positionLink(records.positionId),
            }
          : null,
      link: { label: "See scored candidates", to: "/client/candidates" },
      chart: scores.length
        ? {
            kind: "distribution",
            unit: "candidates",
            valueHeading: "Candidates",
            points: bucketScores(scores),
          }
        : null,
      sample: { counted: scores.length, expected: null, unit: "scoring runs" },
    });
  }

  // ── 5 · Requirement coverage ───────────────────────────────────────────
  {
    const withCoverage = records.scoreRuns.filter(
      (r) => r.must_have_coverage != null || r.preferred_coverage != null,
    );
    const must = withCoverage
      .map((r) => (r.must_have_coverage == null ? null : Number(r.must_have_coverage)))
      .filter((v): v is number => v !== null);
    const pref = withCoverage
      .map((r) => (r.preferred_coverage == null ? null : Number(r.preferred_coverage)))
      .filter((v): v is number => v !== null);
    const norm = (v: number) => (v > 1 ? v / 100 : v);
    const mustMed = median(must.map(norm));
    const prefMed = median(pref.map(norm));
    const latestAt = newest(records.scoreRuns, "completed_at") ?? newest(records.scoreRuns, "created_at");
    const state = resolveMetricStatus({
      counted: withCoverage.length,
      minSample: MIN_SAMPLE_MEDIAN,
      expected: records.scoreRuns.length || null,
      latestAt,
      now,
    });
    metrics.push({
      key: "requirement_coverage",
      title: "Requirement coverage",
      question: "Which of my requirements is the market actually meeting?",
      status: state.status,
      statusReason: state.reason,
      value: mustMed === null ? null : pct(mustMed),
      valueNote: mustMed === null ? null : "of must-haves met, median candidate",
      tone: mustMed === null ? "neutral" : mustMed >= 0.8 ? "good" : mustMed >= 0.5 ? "warn" : "bad",
      comparison:
        prefMed === null
          ? null
          : {
              baselineLabel: "preferred requirements",
              baselineValue: pct(prefMed),
              delta: null,
              direction: "unknown",
              tone: "neutral",
            },
      freshness: fresh(latestAt),
      explanation:
        "Coverage is the share of your stated requirements a candidate has evidence for, taken from the scoring run. Must-haves and preferred requirements are reported separately because only must-haves gate a decision.",
      action:
        mustMed !== null && mustMed < 0.5
          ? {
              label: "Your must-haves may be blocking the search",
              detail:
                "The median candidate meets under half of your must-haves. Moving one must-have to preferred usually widens the field immediately.",
              link: positionLink(records.positionId),
            }
          : null,
      link: positionLink(records.positionId),
      chart:
        mustMed === null && prefMed === null
          ? null
          : {
              kind: "bars",
              unit: "%",
              valueHeading: "Median coverage",
              points: [
                ...(mustMed === null
                  ? []
                  : [
                      {
                        key: "must",
                        label: "Must-haves",
                        value: Math.round(mustMed * 100),
                        tone: (mustMed >= 0.8 ? "good" : mustMed >= 0.5 ? "warn" : "bad") as MetricPoint["tone"],
                        note: `Median candidate meets ${pct(mustMed)} of must-haves`,
                      },
                    ]),
                ...(prefMed === null
                  ? []
                  : [
                      {
                        key: "preferred",
                        label: "Preferred",
                        value: Math.round(prefMed * 100),
                        tone: "neutral" as const,
                        note: `Median candidate meets ${pct(prefMed)} of preferred requirements`,
                      },
                    ]),
              ],
            },
      sample: {
        counted: withCoverage.length,
        expected: records.scoreRuns.length || null,
        unit: "scoring runs with coverage recorded",
      },
    });
  }

  // ── 6 · Evidence completeness ──────────────────────────────────────────
  {
    const total = records.evidenceItems.length;
    const withSource = records.evidenceItems.filter((e) => !!iso(e.source_passage)).length;
    const reviewed = records.evidenceItems.filter(
      (e) => e.reviewer_status === "confirmed" || e.reviewer_status === "corrected",
    ).length;
    const needsCheck = records.evidenceItems.filter(
      (e) => e.validation_need && e.validation_need !== "none",
    ).length;
    const share = total ? withSource / total : null;
    const latestAt = newest(records.evidenceItems, "created_at");
    const state = resolveMetricStatus({
      counted: total,
      minSample: MIN_SAMPLE_MEDIAN,
      latestAt,
      now,
    });
    metrics.push({
      key: "evidence_completeness",
      title: "Evidence completeness",
      question: "Can I trust these scores enough to act on them without re-reading every CV?",
      status: state.status,
      statusReason: state.reason,
      value: share === null ? null : pct(share),
      valueNote: share === null ? null : "of findings quote a source passage",
      tone: share === null ? "neutral" : share >= 0.9 ? "good" : share >= 0.7 ? "warn" : "bad",
      comparison: null,
      freshness: fresh(latestAt),
      explanation: `Across ${total} recorded finding${total === 1 ? "" : "s"}, this is how many carry the exact passage they came from. ${reviewed} ${reviewed === 1 ? "has" : "have"} been confirmed or corrected by a human reviewer.`,
      action: needsCheck
        ? {
            label: `${needsCheck} finding${needsCheck === 1 ? "" : "s"} flagged for checking`,
            detail:
              "These were extracted but the system could not fully verify them. They are marked in the candidate record so you never act on an unchecked claim unknowingly.",
            link: { label: "Open candidates", to: "/client/candidates" },
          }
        : null,
      link: { label: "Open candidates", to: "/client/candidates" },
      chart: total
        ? {
            kind: "bars",
            unit: "findings",
            valueHeading: "Findings",
            points: [
              { key: "quoted", label: "With source quote", value: withSource, tone: "good", note: `${withSource} findings quote the exact passage` },
              { key: "reviewed", label: "Human-confirmed", value: reviewed, tone: "good", note: `${reviewed} findings were read and accepted by a reviewer` },
              { key: "check", label: "Needs checking", value: needsCheck, tone: "warn", note: `${needsCheck} findings are flagged for verification` },
              { key: "unquoted", label: "No source quote", value: total - withSource, tone: "bad", note: `${total - withSource} findings have no passage attached` },
            ],
          }
        : null,
      sample: { counted: total, expected: null, unit: "evidence findings" },
    });
  }

  // ── 7 · Funnel conversion ──────────────────────────────────────────────
  {
    const reached = new Map<string, Set<string>>(FUNNEL_STEPS.map((s) => [s.key, new Set<string>()]));
    const delivered = records.matches.filter((m) =>
      inWindow(iso(m.delivered_at), win.from, win.to),
    );
    for (const m of delivered) {
      const stages = new Set<string>(
        [
          "delivered",
          m.stage,
          ...records.history.filter((h) => h.candidate_match_id === m.id).map((h) => h.to_stage),
        ].filter(Boolean) as string[],
      );
      for (const s of stages) reached.get(s)?.add(m.id);
    }
    const points: MetricPoint[] = FUNNEL_STEPS.map((s, i) => {
      const count = reached.get(s.key)!.size;
      const prev = i === 0 ? null : reached.get(FUNNEL_STEPS[i - 1].key)!.size;
      const dropped = prev === null ? 0 : Math.max(0, prev - count);
      return {
        key: s.key,
        label: s.label,
        value: count,
        tone: dropped > 0 && prev ? ("warn" as const) : ("neutral" as const),
        note:
          prev === null
            ? `${count} candidates entered here`
            : `${count} of ${prev} continued — ${dropped} stopped at ${FUNNEL_STEPS[i - 1].label.toLowerCase()}`,
      };
    });
    const worst = points
      .slice(1)
      .reduce<{ point: MetricPoint; dropped: number; from: string } | null>((acc, p, i) => {
        const prev = points[i].value;
        const dropped = Math.max(0, prev - p.value);
        if (!acc || dropped > acc.dropped) return { point: p, dropped, from: points[i].label };
        return acc;
      }, null);
    const hired = reached.get("hired")!.size;
    const rate = delivered.length ? hired / delivered.length : null;
    const latestAt = newest(delivered, "delivered_at");
    const state = resolveMetricStatus({
      counted: delivered.length,
      minSample: MIN_SAMPLE_MEDIAN,
      latestAt,
      now,
    });
    metrics.push({
      key: "funnel_conversion",
      title: "Funnel conversion",
      question: "Where in the process am I losing the people I wanted?",
      status: state.status,
      statusReason: state.reason,
      value: rate === null ? null : pct(rate),
      valueNote: rate === null ? null : `${hired} hired from ${delivered.length} shown`,
      tone: rate === null ? "neutral" : rate > 0 ? "good" : "warn",
      comparison: null,
      freshness: fresh(latestAt),
      explanation:
        "Every candidate released to you in this window, tracked through the stages they actually reached. A candidate counts at a stage if their record ever passed through it, so backwards moves do not erase history.",
      action:
        worst && worst.dropped > 0
          ? {
              label: `Biggest fall-off: ${worst.from} → ${worst.point.label}`,
              detail: `${worst.dropped} candidate${worst.dropped === 1 ? "" : "s"} stopped there. That is the one step worth changing.`,
              link: { label: "Review that stage", to: "/client/candidates" },
            }
          : null,
      link: { label: "See the pipeline", to: "/client/candidates" },
      chart: delivered.length
        ? { kind: "funnel", unit: "candidates", valueHeading: "Candidates", points }
        : null,
      sample: { counted: delivered.length, expected: null, unit: "candidates released in window" },
    });
  }

  // ── 8 · Agent run outcomes ─────────────────────────────────────────────
  {
    const runs = records.agentRuns.filter((r) => inWindow(iso(r.occurred_at), win.from, win.to));
    const byOutcome = new Map<string, number>();
    for (const r of runs) {
      const key = String(r.outcome ?? "unrecorded");
      byOutcome.set(key, (byOutcome.get(key) ?? 0) + 1);
    }
    const failed = (byOutcome.get("failed") ?? 0) + (byOutcome.get("error") ?? 0);
    const priorCount = records.agentRuns.filter((r) =>
      inPriorWindow(iso(r.occurred_at), win.priorFrom, win.from),
    ).length;
    const cmp = compare(runs.length, priorCount || null, { lowerIsBetter: false, unit: "runs", digits: 0 });
    const latestAt = newest(records.agentRuns, "occurred_at");
    const state = resolveMetricStatus({
      counted: runs.length,
      latestAt,
      staleAfterDays: 7,
      now,
    });
    metrics.push({
      key: "agent_run_outcomes",
      title: "Agent run outcomes",
      question: "Is the automation actually doing work on my roles, and is any of it failing?",
      status: state.status,
      statusReason: state.reason,
      value: runs.length ? String(runs.length) : null,
      valueNote: runs.length ? `agent runs · ${failed} failed` : null,
      tone: !runs.length ? "neutral" : failed > 0 ? "warn" : "good",
      comparison: { baselineLabel: `previous ${win.days} days`, ...cmp },
      freshness: fresh(latestAt, 7),
      explanation:
        "Each entry is one recorded agent run on your roles — sourcing, evidence extraction, scoring, coordination. Outcomes are recorded by the agent itself; nothing here is inferred.",
      action: failed
        ? {
            label: `${failed} run${failed === 1 ? "" : "s"} failed`,
            detail:
              "Failed runs leave gaps in candidate records. Your delivery lead is alerted automatically, but you can chase it here.",
            link: { label: "Open agent activity", to: "/client/agents" },
          }
        : null,
      link: { label: "Open agent activity", to: "/client/agents" },
      chart: runs.length
        ? {
            kind: "bars",
            unit: "runs",
            valueHeading: "Runs",
            points: Array.from(byOutcome.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([outcome, count]) => ({
                key: outcome,
                label: outcome.replace(/_/g, " "),
                value: count,
                tone:
                  outcome === "failed" || outcome === "error"
                    ? ("bad" as const)
                    : outcome === "unrecorded"
                      ? ("neutral" as const)
                      : ("good" as const),
                note: `${count} run${count === 1 ? "" : "s"} recorded this outcome`,
              })),
          }
        : null,
      sample: { counted: runs.length, expected: null, unit: "agent runs" },
    });
  }

  // ── 9 · Role risk ──────────────────────────────────────────────────────
  {
    const open = records.positions.filter((p) =>
      ["active", "approved", "submitted"].includes(String(p.status)),
    );
    const rows = open.map((p) => {
      const roleMatches = records.matches.filter((m) => m.position_id === p.id);
      const awaiting = roleMatches.filter((m) => m.stage === "delivered");
      const oldestAwaiting = awaiting
        .map((m) => iso(m.delivered_at))
        .filter(Boolean)
        .sort()[0] as string | undefined;
      const unconfirmed = records.interviews.filter(
        (i) => i.position_id === p.id && !i.scheduled_start && i.status !== "cancelled",
      );
      const movement = [
        ...roleMatches.map((m) => iso(m.updated_at)),
        ...records.history.filter((h) => h.position_id === p.id).map((h) => iso(h.created_at)),
        iso(p.updated_at),
      ]
        .filter(Boolean)
        .sort()
        .pop() as string | undefined;
      const commitment = records.commitments.find((c) => c.position_id === p.id);
      const promisedBy =
        commitment && iso(commitment.baseline_at)
          ? new Date(
              new Date(commitment.baseline_at).getTime() +
                Number(commitment.first_shortlist_days ?? 0) * DAY_MS,
            ).toISOString()
          : null;
      const risk = computeRoleRisk(
        {
          status: String(p.status),
          lastMovementAt: movement ?? null,
          awaitingDecision: awaiting.length,
          oldestAwaitingDecisionAt: oldestAwaiting ?? null,
          interviewsToConfirm: unconfirmed.length,
          oldestInterviewToConfirmAt:
            (unconfirmed.map((i) => iso(i.created_at)).filter(Boolean).sort()[0] as string) ?? null,
          promisedShortlistBy: promisedBy,
          shortlistDeliveredAt:
            (roleMatches.map((m) => iso(m.delivered_at)).filter(Boolean).sort()[0] as string) ?? null,
        },
        now,
      );
      return { position: p, risk };
    });
    const atRisk = rows.filter((r) => r.risk.atRisk);
    const latestAt = newest(records.positions, "updated_at");
    const state = resolveMetricStatus({
      counted: open.length,
      latestAt,
      staleAfterDays: 30,
      now,
    });
    metrics.push({
      key: "role_risk",
      title: "Role risk",
      question: "Which of my open roles is about to slip, and why?",
      status: open.length === 0 ? "no_data" : state.status,
      statusReason:
        open.length === 0 ? "No open roles in scope, so nothing can be at risk." : state.reason,
      value: open.length ? `${atRisk.length} of ${open.length}` : null,
      valueNote: open.length ? "open roles flagged" : null,
      tone: !open.length ? "neutral" : atRisk.length === 0 ? "good" : "bad",
      comparison: null,
      freshness: fresh(latestAt, 30),
      explanation: `A role is flagged only when a date proves it: a decision sitting with you, an interview with no confirmed time, a missed shortlist commitment, or ${STALL_DAYS} days with no movement at all. No prediction is involved.`,
      action: atRisk.length
        ? {
            label: atRisk[0].position.title,
            detail: atRisk[0].risk.reason,
            link: { label: "Open the role", to: "/client/positions" },
          }
        : null,
      link: { label: "Open your roles", to: "/client/positions" },
      chart: atRisk.length
        ? {
            kind: "bars",
            unit: "roles",
            valueHeading: "Days waiting",
            points: atRisk.map((r) => ({
              key: r.position.id,
              label: r.position.title,
              value: daysAgo(iso(r.position.updated_at), now) ?? 0,
              tone: "bad" as const,
              note: r.risk.reason,
            })),
          }
        : null,
      sample: { counted: open.length, expected: records.positions.length || null, unit: "open roles" },
    });
  }

  // ── 10 · Stalled stages ────────────────────────────────────────────────
  {
    const lastMove = new Map<string, string>();
    for (const h of records.history) {
      const at = iso(h.created_at);
      if (!at) continue;
      const prev = lastMove.get(h.candidate_match_id);
      if (!prev || at > prev) lastMove.set(h.candidate_match_id, at);
    }
    const openStages = new Set(["delivered", "shortlisted", "interview_process", "offer"]);
    const live = records.matches.filter((m) => openStages.has(String(m.stage)));
    const stalled = live
      .map((m) => {
        const at = lastMove.get(m.id) ?? iso(m.updated_at) ?? iso(m.delivered_at);
        return { match: m, days: daysAgo(at, now) ?? 0, at };
      })
      .filter((r) => r.days >= STALL_DAYS)
      .sort((a, b) => b.days - a.days);
    const byStage = new Map<string, number>();
    for (const s of stalled) byStage.set(String(s.match.stage), (byStage.get(String(s.match.stage)) ?? 0) + 1);
    const latestAt = newest(records.matches, "updated_at");
    const state = resolveMetricStatus({
      counted: live.length,
      latestAt,
      staleAfterDays: STALL_DAYS,
      now,
    });
    metrics.push({
      key: "stalled_stages",
      title: "Stalled stages",
      question: "What has stopped moving, and who has to unblock it?",
      status: live.length === 0 ? "no_data" : state.status,
      statusReason:
        live.length === 0
          ? "No candidates are currently in play, so nothing can be stalled."
          : state.reason,
      value: live.length ? String(stalled.length) : null,
      valueNote: live.length ? `of ${live.length} live candidates sitting ${STALL_DAYS}+ days` : null,
      tone: !live.length ? "neutral" : stalled.length === 0 ? "good" : "bad",
      comparison: null,
      freshness: fresh(latestAt, STALL_DAYS),
      explanation: `A candidate is stalled when their last recorded stage change — or their release to you — is more than ${STALL_DAYS} days old and they are still in play. Measured from stage history, not from guesswork.`,
      action: stalled.length
        ? {
            label: `Oldest has waited ${daysLabel(stalled[0].days, 0)}`,
            detail: `Sitting at "${String(stalled[0].match.stage).replace(/_/g, " ")}". Candidates go cold here first.`,
            link: { label: "Open the decision queue", to: "/client" },
          }
        : null,
      link: { label: "Open the decision queue", to: "/client" },
      chart: stalled.length
        ? {
            kind: "bars",
            unit: "candidates",
            valueHeading: "Stalled candidates",
            points: Array.from(byStage.entries()).map(([stage, count]) => ({
              key: stage,
              label: stage.replace(/_/g, " "),
              value: count,
              tone: "bad" as const,
              note: `${count} candidate${count === 1 ? "" : "s"} stuck at this stage for ${STALL_DAYS}+ days`,
            })),
          }
        : null,
      sample: { counted: live.length, expected: null, unit: "live candidates" },
    });
  }

  // ── 11 · Market / talent availability signals ──────────────────────────
  {
    const signals = records.marketSignals.filter((s) =>
      inWindow(iso(s.observed_at), win.from, win.to),
    );
    const byKind = new Map<string, number[]>();
    for (const s of signals) {
      if (s.numeric_value == null) continue;
      const list = byKind.get(String(s.signal_kind)) ?? [];
      list.push(Number(s.numeric_value));
      byKind.set(String(s.signal_kind), list);
    }
    const latestAt = newest(records.marketSignals, "observed_at");
    const state = resolveMetricStatus({
      counted: signals.length,
      minSample: MIN_SAMPLE_MEDIAN,
      latestAt,
      staleAfterDays: 30,
      now,
    });
    metrics.push({
      key: "market_signals",
      title: "Talent availability signals",
      question: "Is the shape of this role realistic for the market I am hiring in?",
      status: state.status,
      statusReason:
        signals.length === 0
          ? "No market or availability signals have been recorded for your roles. We only report signals we observed ourselves during your searches — we do not buy or model market data."
          : state.reason,
      value: signals.length ? String(signals.length) : null,
      valueNote: signals.length ? "observed signals in window" : null,
      tone: "neutral",
      comparison: null,
      freshness: fresh(latestAt, 30),
      explanation:
        "Signals are recorded during real searches on your roles — availability, compensation expectations and response behaviour we actually observed. Nothing is bought in, modelled or benchmarked against outside datasets.",
      action: null,
      link: positionLink(records.positionId),
      chart: byKind.size
        ? {
            kind: "bars",
            unit: "median value",
            valueHeading: "Median observed",
            points: Array.from(byKind.entries()).map(([kind, values]) => ({
              key: kind,
              label: kind.replace(/_/g, " "),
              value: Number((median(values) ?? 0).toFixed(1)),
              tone: "neutral" as const,
              note: `Median of ${values.length} observation${values.length === 1 ? "" : "s"}`,
            })),
          }
        : null,
      sample: { counted: signals.length, expected: null, unit: "observed signals" },
    });
  }

  const recommendations = deriveRecommendations({
    positions: records.positions,
    matches: records.matches,
    history: records.history,
    scoreRuns: records.scoreRuns,
    evidenceItems: records.evidenceItems,
    agentRuns: records.agentRuns,
    signals: {
      tasks: records.tasks ?? [],
      outreachTouches: records.outreachTouches ?? [],
    },
    window: win,
    positionId: records.positionId,
    now,
  });

  return {
    window: win,
    computedAt,
    metrics,
    recommendations,
    bestPractices: BEST_PRACTICES,
    emptyWorkspace:
      records.positions.length === 0 &&
      records.matches.length === 0 &&
      records.scoreRuns.length === 0,
  };

}
