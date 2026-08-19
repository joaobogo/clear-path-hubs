/**
 * Weekly operating review — decision-oriented, deterministic aggregation.
 *
 * Every figure is bounded by a fixed Monday 00:00 UTC → next Monday 00:00 UTC
 * window and derived only from stored timestamps inside that window. Nothing is
 * relative to "now", so re-loading a past week returns identical numbers unless
 * the underlying rows are corrected. Each metric also returns the records it
 * counted, so every figure drills through to its list.
 *
 * No narrative commentary and no invented targets: SLA breaches come from the
 * client's own `position_commitments` row, and "regressed" is strictly a
 * week-over-week drop in delivered candidates.
 */
import { loadTestScope, excludeTestOrgs, type TestScope } from "./admin-test-scope.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const DAY = 86_400_000;
const WEEK = 7 * DAY;

export type {
  ReviewRowKind,
  ReviewRecord,
  ReviewMetric,
  RegressedRole,
  WeeklyReview,
} from "./wbr-review";

import type {
  ReviewRecord,
  ReviewMetric,
  RegressedRole,
  WeeklyReview,
} from "./wbr-review";

const CAP = 200;

/** Monday 00:00 UTC of the week containing `at`. */
export function mondayUtc(at: Date | string): Date {
  const d = new Date(at);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const daysFromMon = (new Date(midnight).getUTCDay() + 6) % 7;
  return new Date(midnight - daysFromMon * DAY);
}

export function currentWeekStart(): string {
  return mondayUtc(new Date()).toISOString().slice(0, 10);
}

function metric(
  key: string,
  label: string,
  basis: string,
  current: ReviewRecord[],
  previousCount: number,
): ReviewMetric {
  return {
    key,
    label,
    basis,
    current: current.length,
    previous: previousCount,
    records: current.slice(0, CAP),
    truncated: current.length > CAP,
  };
}

type Ctx = {
  s: Any;
  scope: TestScope;
  start: string;
  end: string;
  prevStart: string;
};

async function rows(
  { s, scope }: Ctx,
  table: string,
  select: string,
  build: (q: Any) => Any,
): Promise<Any[]> {
  const { data, error } = await build(
    excludeTestOrgs(s.from(table).select(select), scope),
  ).limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []) as Any[];
}

const orgName = (row: Any): string | null => row?.organizations?.name ?? null;

async function positionsOpened(ctx: Ctx, from: string, to: string) {
  return rows(ctx, "positions", "id,title,created_at,organizations(name)", (q) =>
    q.gte("created_at", from).lt("created_at", to).order("created_at"),
  );
}

async function positionsClosed(ctx: Ctx, from: string, to: string) {
  return rows(ctx, "positions", "id,title,closed_at,status,organizations(name)", (q) =>
    q.gte("closed_at", from).lt("closed_at", to).order("closed_at"),
  );
}

async function intakes(ctx: Ctx, from: string, to: string) {
  return rows(
    ctx,
    "intake_submissions",
    "id,role_title,status,position_id,created_at,organizations(name)",
    (q) => q.gte("created_at", from).lt("created_at", to).order("created_at"),
  );
}

async function delivered(ctx: Ctx, from: string, to: string) {
  return rows(
    ctx,
    "candidate_matches",
    "id,delivered_at,position_id,candidate_profiles(full_name),positions(title,organizations(name))",
    (q) => q.gte("delivered_at", from).lt("delivered_at", to).order("delivered_at"),
  );
}

async function decisions(ctx: Ctx, from: string, to: string) {
  return rows(
    ctx,
    "client_decisions",
    "id,decision,created_at,candidate_match_id,candidate_matches(position_id,candidate_profiles(full_name),positions(title,organizations(name)))",
    (q) => q.gte("created_at", from).lt("created_at", to).order("created_at"),
  );
}

async function hires(ctx: Ctx, from: string, to: string) {
  return rows(
    ctx,
    "hire_records",
    "id,hired_at,position_id,candidate_profiles(full_name),positions(title,organizations(name))",
    (q) => q.eq("status", "hire_confirmed").gte("hired_at", from).lt("hired_at", to).order("hired_at"),
  );
}

/**
 * First-shortlist commitments whose deadline (baseline_at + agreed days) fell
 * inside the window and were still unmet at that deadline. Both sides of the
 * comparison are stored timestamps, so a past week never changes.
 */
async function shortlistBreaches(ctx: Ctx, from: string, to: string): Promise<ReviewRecord[]> {
  const commitments = await rows(
    ctx,
    "position_commitments",
    "id,position_id,first_shortlist_days,shortlist_size,baseline_at,positions(title,organizations(name))",
    (q) =>
      q
        .gte("baseline_at", new Date(new Date(from).getTime() - 400 * DAY).toISOString())
        .lt("baseline_at", to),
  );
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  const due = commitments
    .map((c) => ({
      ...c,
      deadline: new Date(c.baseline_at).getTime() + c.first_shortlist_days * DAY,
    }))
    .filter((c) => c.deadline >= fromMs && c.deadline < toMs);
  if (due.length === 0) return [];

  const positionIds = due.map((c) => c.position_id);
  const { data: matches, error } = await ctx.s
    .from("candidate_matches")
    .select("position_id,delivered_at")
    .in("position_id", positionIds)
    .not("delivered_at", "is", null)
    .limit(5000);
  if (error) throw new Error(error.message);

  const deliveredByPosition = new Map<string, number[]>();
  for (const m of (matches ?? []) as Any[]) {
    const list = deliveredByPosition.get(m.position_id) ?? [];
    list.push(new Date(m.delivered_at).getTime());
    deliveredByPosition.set(m.position_id, list);
  }

  return due
    .filter((c) => {
      const list = deliveredByPosition.get(c.position_id) ?? [];
      const byDeadline = list.filter((t) => t <= c.deadline).length;
      return byDeadline < c.shortlist_size;
    })
    .map((c) => {
      const list = deliveredByPosition.get(c.position_id) ?? [];
      const byDeadline = list.filter((t) => t <= c.deadline).length;
      return {
        id: c.position_id,
        kind: "position" as const,
        label: c.positions?.title ?? "Untitled role",
        sublabel: `${orgName(c.positions) ?? "Unknown client"} · ${byDeadline}/${c.shortlist_size} shortlisted by day ${c.first_shortlist_days}`,
        at: new Date(c.deadline).toISOString(),
      };
    });
}

export async function loadWeeklyReview(
  s: Any,
  opts: { weekStart: string; includeTest?: boolean },
): Promise<WeeklyReview> {
  const start = mondayUtc(`${opts.weekStart}T00:00:00.000Z`);
  const end = new Date(start.getTime() + WEEK);
  const prevStart = new Date(start.getTime() - WEEK);
  const scope = await loadTestScope(s, opts.includeTest ?? false);
  const ctx: Ctx = {
    s,
    scope,
    start: start.toISOString(),
    end: end.toISOString(),
    prevStart: prevStart.toISOString(),
  };
  const cur = [ctx.start, ctx.end] as const;
  const prev = [ctx.prevStart, ctx.start] as const;

  const [
    openedCur,
    openedPrev,
    closedCur,
    closedPrev,
    intakeCur,
    intakePrev,
    deliveredCur,
    deliveredPrev,
    decisionCur,
    decisionPrev,
    hireCur,
    hirePrev,
    breachCur,
    breachPrev,
  ] = await Promise.all([
    positionsOpened(ctx, ...cur),
    positionsOpened(ctx, ...prev),
    positionsClosed(ctx, ...cur),
    positionsClosed(ctx, ...prev),
    intakes(ctx, ...cur),
    intakes(ctx, ...prev),
    delivered(ctx, ...cur),
    delivered(ctx, ...prev),
    decisions(ctx, ...cur),
    decisions(ctx, ...prev),
    hires(ctx, ...cur),
    hires(ctx, ...prev),
    shortlistBreaches(ctx, ...cur),
    shortlistBreaches(ctx, ...prev),
  ]);

  const intakeRecords = (list: Any[]): ReviewRecord[] =>
    list.map((r) => ({
      id: r.id,
      kind: "intake" as const,
      label: r.role_title ?? "Untitled intake",
      sublabel: orgName(r),
      at: r.created_at,
    }));

  const positionRecords = (list: Any[], at: "created_at" | "closed_at"): ReviewRecord[] =>
    list.map((r) => ({
      id: r.id,
      kind: "position" as const,
      label: r.title ?? "Untitled role",
      sublabel: orgName(r),
      at: r[at],
    }));

  const matchRecords = (list: Any[], at: string, sub?: (r: Any) => string): ReviewRecord[] =>
    list.map((r) => {
      const pos = r.positions ?? r.candidate_matches?.positions;
      const name =
        r.candidate_profiles?.full_name ??
        r.candidate_matches?.candidate_profiles?.full_name ??
        "Candidate";
      const base = `${pos?.title ?? "—"}${pos?.organizations?.name ? ` · ${pos.organizations.name}` : ""}`;
      return {
        id: r.id,
        kind: "candidate" as const,
        label: name,
        sublabel: sub ? `${sub(r)} · ${base}` : base,
        at: r[at] ?? null,
      };
    });

  const convertedCur = intakeCur.filter((r) => r.position_id);
  const convertedPrev = intakePrev.filter((r) => r.position_id);

  const metrics: ReviewMetric[] = [
    metric(
      "intakes_received",
      "Intakes received",
      "intake_submissions.created_at inside the week",
      intakeRecords(intakeCur),
      intakePrev.length,
    ),
    metric(
      "intakes_converted",
      "Intakes converted",
      "Intakes received in the week that are linked to a position",
      intakeRecords(convertedCur),
      convertedPrev.length,
    ),
    metric(
      "positions_opened",
      "Positions opened",
      "positions.created_at inside the week",
      positionRecords(openedCur, "created_at"),
      openedPrev.length,
    ),
    metric(
      "positions_closed",
      "Positions closed",
      "positions.closed_at inside the week",
      positionRecords(closedCur, "closed_at"),
      closedPrev.length,
    ),
    metric(
      "candidates_submitted",
      "Candidates submitted",
      "candidate_matches.delivered_at inside the week",
      matchRecords(deliveredCur, "delivered_at"),
      deliveredPrev.length,
    ),
    metric(
      "client_decisions",
      "Client decisions received",
      "client_decisions.created_at inside the week",
      matchRecords(decisionCur, "created_at", (r) => String(r.decision).replace(/_/g, " ")),
      decisionPrev.length,
    ),
    metric(
      "hires",
      "Hires",
      "hire_records.hired_at inside the week",
      matchRecords(hireCur, "hired_at"),
      hirePrev.length,
    ),
    {
      key: "sla_breaches",
      label: "SLA breaches",
      basis:
        "First-shortlist commitments whose agreed deadline fell in the week with the shortlist still short at that deadline",
      current: breachCur.length,
      previous: breachPrev.length,
      records: breachCur.slice(0, CAP),
      truncated: breachCur.length > CAP,
    },
  ];

  // ── Roles that regressed: fewer candidates delivered than the week before ──
  const perPosition = new Map<
    string,
    { title: string; client: string | null; cur: number; prev: number; dCur: number; dPrev: number }
  >();
  const touch = (id: string | null, pos: Any) => {
    if (!id) return null;
    const existing = perPosition.get(id);
    if (existing) return existing;
    const fresh = {
      title: pos?.title ?? "Untitled role",
      client: pos?.organizations?.name ?? null,
      cur: 0,
      prev: 0,
      dCur: 0,
      dPrev: 0,
    };
    perPosition.set(id, fresh);
    return fresh;
  };
  for (const r of deliveredCur) touch(r.position_id, r.positions)!.cur += 1;
  for (const r of deliveredPrev) touch(r.position_id, r.positions)!.prev += 1;
  for (const r of decisionCur) {
    const m = r.candidate_matches;
    const e = touch(m?.position_id ?? null, m?.positions);
    if (e) e.dCur += 1;
  }
  for (const r of decisionPrev) {
    const m = r.candidate_matches;
    const e = touch(m?.position_id ?? null, m?.positions);
    if (e) e.dPrev += 1;
  }

  const regressed_roles: RegressedRole[] = Array.from(perPosition.entries())
    .filter(([, v]) => v.cur < v.prev)
    .map(([position_id, v]) => ({
      position_id,
      title: v.title,
      client_name: v.client,
      delivered_this_week: v.cur,
      delivered_prev_week: v.prev,
      decisions_this_week: v.dCur,
      decisions_prev_week: v.dPrev,
    }))
    .sort(
      (a, b) =>
        b.delivered_prev_week - b.delivered_this_week -
        (a.delivered_prev_week - a.delivered_this_week),
    );

  const total_activity = metrics.reduce((sum, m) => sum + m.current, 0);

  return {
    week_start: ctx.start,
    week_end: ctx.end,
    prev_week_start: ctx.prevStart,
    is_closed: end.getTime() <= Date.now(),
    include_test: scope.includeTest,
    metrics,
    regressed_roles,
    total_activity,
  };
}
