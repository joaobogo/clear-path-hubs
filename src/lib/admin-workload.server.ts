/**
 * Recruiter workload and ownership.
 *
 * Every number is counted from real rows at query time: positions (ownership),
 * candidate_matches (active pipeline, submissions, pending scoring reviews),
 * tasks (overdue), candidate_stage_history (last touch). There is no
 * productivity score, no ranking, no leaderboard — this view exists only to
 * show how work is distributed and which roles have no owner.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

type Admin = SupabaseClient<never, never, never>;

/** Statuses that count as "open" work for an owner. */
export const OPEN_STATUSES = ["approved", "active", "paused"] as const;

/** Stages where a candidate is still moving through the process. */
export const ACTIVE_STAGES = [
  "reviewing",
  "delivered",
  "shortlisted",
  "interview_process",
  "offer",
] as const;

export const UNASSIGNED_KEY = "__unassigned__";

const DAY = 86_400_000;

export type WorkloadRow = {
  /** Staff auth user id, or UNASSIGNED_KEY for the ownerless aggregate row. */
  key: string;
  name: string;
  email: string | null;
  role: string | null;
  is_unassigned: boolean;
  open_positions: number;
  active_candidates: number;
  submissions_this_week: number;
  pending_scoring_reviews: number;
  overdue_tasks: number;
  /** Oldest owned position by days since anything last happened on it. */
  oldest_untouched: {
    position_id: string;
    title: string;
    organization_name: string | null;
    days_untouched: number;
  } | null;
};

export type WorkloadTable = {
  rows: WorkloadRow[];
  totals: {
    open_positions: number;
    active_candidates: number;
    submissions_this_week: number;
  };
  generated_at: string;
};

function bumpMax(cur: number | null, iso: string | null | undefined): number | null {
  if (!iso) return cur;
  const t = new Date(iso).getTime();
  return cur === null || t > cur ? t : cur;
}

export async function loadWorkloadTable(
  admin: Admin,
  opts: { includeTest?: boolean } = {},
): Promise<WorkloadTable> {
  const nowMs = Date.now();
  const weekAgo = new Date(nowMs - 7 * DAY).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = admin as unknown as { from: (t: string) => any };

  const posQuery = a
    .from("positions")
    .select(
      "id, title, status, owner_user_id, organization_id, created_at, published_at, updated_at, is_test_record",
    )
    .in("status", OPEN_STATUSES as unknown as string[]);
  if (!opts.includeTest) posQuery.eq("is_test_record", false);

  const [posRes, staffRes] = await Promise.all([
    posQuery,
    a
      .from("memberships")
      .select("user_id, role, status")
      .eq("status", "active")
      .in("role", ["platform_admin", "operations"]),
  ]);
  if (posRes.error) throw new Error(posRes.error.message);
  if (staffRes.error) throw new Error(staffRes.error.message);

  const positions = (posRes.data ?? []) as Array<Record<string, unknown>>;
  const staff = (staffRes.data ?? []) as Array<{ user_id: string; role: string }>;

  const positionIds = positions.map((p) => String(p['id']));
  const orgIds = Array.from(new Set(positions.map((p) => String(p['organization_id']))));
  const staffIds = Array.from(
    new Set([
      ...staff.map((s) => s.user_id),
      ...positions
        .map((p) => p['owner_user_id'])
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ]),
  );

  const [matchRes, orgRes, profRes, taskRes, historyRes] = await Promise.all([
    positionIds.length
      ? a
          .from("candidate_matches")
          .select("id, position_id, stage, admin_status, processing_state, delivered_at, created_at")
          .in("position_id", positionIds)
      : Promise.resolve({ data: [], error: null }),
    orgIds.length
      ? a.from("organizations").select("id, name").in("id", orgIds)
      : Promise.resolve({ data: [], error: null }),
    staffIds.length
      ? a
          .from("profiles")
          .select("auth_user_id, full_name, email")
          .in("auth_user_id", staffIds)
      : Promise.resolve({ data: [], error: null }),
    staffIds.length
      ? a
          .from("tasks")
          .select("id, assignee_user_id, status, due_at, deleted_at")
          .in("assignee_user_id", staffIds)
          .in("status", ["open", "in_progress"])
          .is("deleted_at", null)
          .lt("due_at", new Date(nowMs).toISOString())
      : Promise.resolve({ data: [], error: null }),
    positionIds.length
      ? a
          .from("candidate_stage_history")
          .select("position_id, created_at")
          .in("position_id", positionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const r of [matchRes, orgRes, profRes, taskRes, historyRes]) {
    const err = (r as { error?: { message: string } | null }).error;
    if (err) throw new Error(err.message);
  }

  const orgName = new Map(
    ((orgRes.data ?? []) as Array<{ id: string; name: string }>).map((o) => [o.id, o.name]),
  );
  const profile = new Map(
    (
      (profRes.data ?? []) as Array<{
        auth_user_id: string;
        full_name: string | null;
        email: string | null;
      }>
    ).map((p) => [p.auth_user_id, p]),
  );

  // Per-position aggregates.
  type Agg = {
    active: number;
    submittedWeek: number;
    pendingReview: number;
    lastTouchAt: number | null;
  };
  const agg = new Map<string, Agg>();
  const bucket = (pid: string): Agg => {
    let b = agg.get(pid);
    if (!b) {
      b = { active: 0, submittedWeek: 0, pendingReview: 0, lastTouchAt: null };
      agg.set(pid, b);
    }
    return b;
  };
  for (const pid of positionIds) bucket(pid);

  const activeStages = new Set<string>(ACTIVE_STAGES as unknown as string[]);
  for (const m of (matchRes.data ?? []) as Array<Record<string, unknown>>) {
    const b = bucket(String(m['position_id']));
    if (activeStages.has(String(m['stage']))) b.active += 1;
    const delivered = m['delivered_at'] as string | null;
    if (delivered && delivered >= weekAgo) b.submittedWeek += 1;
    if (m['admin_status'] === "pending" && m['processing_state'] === "scored") {
      b.pendingReview += 1;
    }
    b.lastTouchAt = bumpMax(b.lastTouchAt, m['created_at'] as string | null);
    b.lastTouchAt = bumpMax(b.lastTouchAt, delivered);
  }
  for (const h of (historyRes.data ?? []) as Array<Record<string, unknown>>) {
    const b = bucket(String(h['position_id']));
    b.lastTouchAt = bumpMax(b.lastTouchAt, h['created_at'] as string | null);
  }

  const overdueByUser = new Map<string, number>();
  for (const t of (taskRes.data ?? []) as Array<{ assignee_user_id: string | null }>) {
    if (!t.assignee_user_id) continue;
    overdueByUser.set(t.assignee_user_id, (overdueByUser.get(t.assignee_user_id) ?? 0) + 1);
  }

  type Acc = WorkloadRow & { _oldestMs: number | null };
  const rowsByKey = new Map<string, Acc>();
  const makeRow = (key: string): Acc => {
    let r = rowsByKey.get(key);
    if (!r) {
      const isUnassigned = key === UNASSIGNED_KEY;
      const p = isUnassigned ? undefined : profile.get(key);
      const roleRow = isUnassigned ? undefined : staff.find((s) => s.user_id === key);
      r = {
        key,
        name: isUnassigned
          ? "Unassigned"
          : p?.full_name || p?.email || "Unknown staff member",
        email: isUnassigned ? null : (p?.email ?? null),
        role: isUnassigned ? null : (roleRow?.role ?? null),
        is_unassigned: isUnassigned,
        open_positions: 0,
        active_candidates: 0,
        submissions_this_week: 0,
        pending_scoring_reviews: 0,
        overdue_tasks: isUnassigned ? 0 : (overdueByUser.get(key) ?? 0),
        oldest_untouched: null,
        _oldestMs: null,
      };
      rowsByKey.set(key, r);
    }
    return r;
  };

  // Seed a row for every active staff member so zero-load people stay visible.
  const onlyStaffIds = new Set(staff.map((s) => s.user_id));
  for (const s of staff) makeRow(s.user_id);

  for (const p of positions) {
    const pid = String(p['id']);
    const ownerRaw = p['owner_user_id'];
    // Filter out non-staff owners from the workload table
    const key =
      typeof ownerRaw === "string" && ownerRaw && onlyStaffIds.has(ownerRaw)
        ? ownerRaw
        : UNASSIGNED_KEY;
    const row = makeRow(key);
    const b = bucket(pid);

    row.open_positions += 1;
    row.active_candidates += b.active;
    row.submissions_this_week += b.submittedWeek;
    row.pending_scoring_reviews += b.pendingReview;

    const openedAt =
      (p['published_at'] as string | null) ?? (p['created_at'] as string | null) ?? null;
    const lastTouch = b.lastTouchAt ?? (openedAt ? new Date(openedAt).getTime() : null);
    if (lastTouch !== null && (row._oldestMs === null || lastTouch < row._oldestMs)) {
      row._oldestMs = lastTouch;
      row.oldest_untouched = {
        position_id: pid,
        title: String(p['title'] ?? "Untitled position"),
        organization_name: orgName.get(String(p['organization_id'])) ?? null,
        days_untouched: Math.max(0, Math.floor((nowMs - lastTouch) / DAY)),
      };
    }
  }

  const rows = Array.from(rowsByKey.values())
    // Only show staff who either carry work or are the ownerless aggregate.
    .filter((r) => r.is_unassigned ? r.open_positions > 0 : true)
    .map(({ _oldestMs: _drop, ...r }) => r)
    .sort((x, y) => {
      if (x.is_unassigned !== y.is_unassigned) return x.is_unassigned ? 1 : -1;
      if (y.open_positions !== x.open_positions) return y.open_positions - x.open_positions;
      return x.name.localeCompare(y.name);
    });

  const totals = rows.reduce(
    (acc, r) => ({
      open_positions: acc.open_positions + r.open_positions,
      active_candidates: acc.active_candidates + r.active_candidates,
      submissions_this_week: acc.submissions_this_week + r.submissions_this_week,
    }),
    { open_positions: 0, active_candidates: 0, submissions_this_week: 0 },
  );

  return { rows, totals, generated_at: new Date().toISOString() };
}

export type OwnedPosition = {
  id: string;
  title: string;
  organization_name: string | null;
  status: string;
  owner_user_id: string | null;
};

/** The open positions behind one workload row, for inline reassignment. */
export async function loadOwnedPositions(
  admin: Admin,
  owner: string,
  opts: { includeTest?: boolean } = {},
): Promise<OwnedPosition[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = admin as unknown as { from: (t: string) => any };
  let q = a
    .from("positions")
    .select("id, title, status, owner_user_id, organization_id, is_test_record, organizations(name)")
    .in("status", OPEN_STATUSES as unknown as string[])
    .order("updated_at", { ascending: false })
    .limit(100);
  if (!opts.includeTest) q = q.eq("is_test_record", false);
  q = owner === UNASSIGNED_KEY ? q.is("owner_user_id", null) : q.eq("owner_user_id", owner);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map((p) => ({
    id: String(p['id']),
    title: String(p['title'] ?? "Untitled position"),
    organization_name:
      (p['organizations'] as { name?: string } | null)?.name ?? null,
    status: String(p['status']),
    owner_user_id: (p['owner_user_id'] as string | null) ?? null,
  }));
}
