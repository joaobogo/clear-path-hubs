/**
 * "Needs attention" queue for open positions.
 *
 * Every reason is derived at query time from real rows — positions,
 * candidate_matches, candidate_stage_history, client_decisions. Nothing here is
 * hand-set, there is no priority score, and nothing is auto-closed.
 *
 * A staff member can mark a position "reviewed today", which writes an
 * audit_events row; the position drops off the queue until the next UTC day.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

type Admin = SupabaseClient<never, never, never>;

export const REVIEW_ACTION = "position.attention_reviewed";
export const OWNER_ACTION = "position.owner_reassigned";

/** Thresholds, stated in one place so the UI can explain them verbatim. */
export const ATTENTION_RULES = {
  noNewCandidateDays: 7,
  zeroSubmissionsOpenDays: 10,
  noClientDecisionDays: 5,
} as const;

export type AttentionReason =
  | "no_new_candidates"
  | "zero_submissions"
  | "no_client_decision"
  | "published_without_owner"
  | "payment_gate";

export const REASON_LABEL: Record<AttentionReason, string> = {
  no_new_candidates: `No new candidate in ${ATTENTION_RULES.noNewCandidateDays} days`,
  zero_submissions: `Zero submissions, open > ${ATTENTION_RULES.zeroSubmissionsOpenDays} days`,
  no_client_decision: `Submitted, no client decision in ${ATTENTION_RULES.noClientDecisionDays} days`,
  published_without_owner: "Published without an owner",
  payment_gate: "Payment gate blocking publish",
};

export type AttentionRow = {
  position_id: string;
  title: string;
  organization_id: string;
  organization_name: string;
  days_open: number;
  owner_user_id: string | null;
  owner_name: string | null;
  candidates_sourced: number;
  submitted_to_client: number;
  in_interview: number;
  last_movement_at: string | null;
  status: string;
  visibility: string;
  payment_status: string | null;
  published_at: string | null;
  is_test_record: boolean;
  reasons: AttentionReason[];
};

export type AttentionQueue = {
  rows: AttentionRow[];
  /** How many open positions were evaluated — the denominator for the empty state. */
  checked: number;
  /** Positions already marked reviewed today (hidden from rows). */
  reviewed_today: number;
  generated_at: string;
};

const DAY = 86_400_000;
const OPEN_STATUSES = ["approved", "active", "paused"] as const;

function daysSince(iso: string | null, now: number): number | null {
  if (!iso) return null;
  return Math.floor((now - new Date(iso).getTime()) / DAY);
}

export function utcDayStart(now = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
}

export async function loadAttentionQueue(
  admin: Admin,
  opts: { includeTest?: boolean } = {},
): Promise<AttentionQueue> {
  const nowMs = Date.now();
  const a = admin as unknown as {
    from: (t: string) => any;
  };

  const posQuery = a
    .from("positions")
    .select(
      "id, title, status, visibility, payment_status, published_at, created_at, owner_user_id, organization_id, is_test_record",
    )
    .in("status", OPEN_STATUSES as unknown as string[]);
  if (!opts.includeTest) posQuery.eq("is_test_record", false);

  const [posRes, reviewRes] = await Promise.all([
    posQuery,
    a
      .from("audit_events")
      .select("entity_id")
      .eq("entity_type", "position")
      .eq("action", REVIEW_ACTION)
      .gte("created_at", utcDayStart()),
  ]);

  if (posRes.error) throw new Error(posRes.error.message);
  if (reviewRes.error) throw new Error(reviewRes.error.message);

  const positions = (posRes.data ?? []) as Array<Record<string, any>>;
  const checked = positions.length;
  if (checked === 0) {
    return { rows: [], checked: 0, reviewed_today: 0, generated_at: new Date().toISOString() };
  }

  const reviewed = new Set(
    ((reviewRes.data ?? []) as Array<{ entity_id: string | null }>)
      .map((r) => r.entity_id)
      .filter((v): v is string => Boolean(v)),
  );

  const ids = positions.map((p) => String(p['id']));
  const orgIds = Array.from(new Set(positions.map((p) => String(p['organization_id']))));
  const ownerIds = Array.from(
    new Set(positions.map((p) => p['owner_user_id']).filter((v): v is string => Boolean(v))),
  );

  const [matchRes, orgRes, ownerRes, moveRes, decisionRes] = await Promise.all([
    a
      .from("candidate_matches")
      .select("id, position_id, stage, delivered_at, created_at")
      .in("position_id", ids),
    a.from("organizations").select("id, name").in("id", orgIds),
    ownerIds.length
      ? a.from("profiles").select("auth_user_id, full_name, email").in("auth_user_id", ownerIds)
      : Promise.resolve({ data: [], error: null }),
    a
      .from("candidate_stage_history")
      .select("position_id, created_at")
      .in("position_id", ids)
      .order("created_at", { ascending: false }),
    a.from("client_decisions").select("position_id, created_at").in("position_id", ids),
  ]);

  for (const r of [matchRes, orgRes, ownerRes, moveRes, decisionRes]) {
    if (r && (r as { error?: { message: string } }).error) {
      throw new Error((r as { error: { message: string } }).error.message);
    }
  }

  const orgName = new Map(
    ((orgRes.data ?? []) as Array<{ id: string; name: string }>).map((o) => [o.id, o.name]),
  );
  const ownerName = new Map(
    (
      (ownerRes.data ?? []) as Array<{
        auth_user_id: string;
        full_name: string | null;
        email: string | null;
      }>
    ).map((p) => [p.auth_user_id, p.full_name || p.email || null]),
  );

  type Agg = {
    sourced: number;
    submitted: number;
    interview: number;
    newestCandidateAt: number | null;
    newestDeliveredAt: number | null;
    lastMovementAt: number | null;
    lastDecisionAt: number | null;
  };
  const agg = new Map<string, Agg>();
  const bucket = (pid: string): Agg => {
    let b = agg.get(pid);
    if (!b) {
      b = {
        sourced: 0,
        submitted: 0,
        interview: 0,
        newestCandidateAt: null,
        newestDeliveredAt: null,
        lastMovementAt: null,
        lastDecisionAt: null,
      };
      agg.set(pid, b);
    }
    return b;
  };
  const bump = (cur: number | null, iso: string | null) => {
    if (!iso) return cur;
    const t = new Date(iso).getTime();
    return cur === null || t > cur ? t : cur;
  };

  for (const m of (matchRes.data ?? []) as Array<Record<string, any>>) {
    const b = bucket(String(m['position_id']));
    b.sourced += 1;
    b.newestCandidateAt = bump(b.newestCandidateAt, m['created_at'] ?? null);
    if (m['delivered_at']) {
      b.submitted += 1;
      b.newestDeliveredAt = bump(b.newestDeliveredAt, m['delivered_at']);
    }
    if (m['stage'] === "interview_process") b.interview += 1;
  }
  for (const h of (moveRes.data ?? []) as Array<Record<string, any>>) {
    const b = bucket(String(h['position_id']));
    b.lastMovementAt = bump(b.lastMovementAt, h['created_at'] ?? null);
  }
  for (const d of (decisionRes.data ?? []) as Array<Record<string, any>>) {
    if (!d['position_id']) continue;
    const b = bucket(String(d['position_id']));
    b.lastDecisionAt = bump(b.lastDecisionAt, d['created_at'] ?? null);
  }

  const rows: AttentionRow[] = [];

  for (const p of positions) {
    const pid = String(p['id']);
    const b = bucket(pid);
    const openedAt = (p['published_at'] as string | null) ?? (p['created_at'] as string);
    const daysOpen = daysSince(openedAt, nowMs) ?? 0;
    const reasons: AttentionReason[] = [];

    const lastCandidateDays =
      b.newestCandidateAt === null ? null : Math.floor((nowMs - b.newestCandidateAt) / DAY);
    if (lastCandidateDays === null || lastCandidateDays >= ATTENTION_RULES.noNewCandidateDays) {
      // No candidate at all, or nothing new for a week.
      if (daysOpen >= ATTENTION_RULES.noNewCandidateDays) reasons.push("no_new_candidates");
    }
    if (b.submitted === 0 && daysOpen > ATTENTION_RULES.zeroSubmissionsOpenDays) {
      reasons.push("zero_submissions");
    }
    if (b.submitted > 0 && b.newestDeliveredAt !== null) {
      const decidedAfter =
        b.lastDecisionAt !== null && b.lastDecisionAt >= b.newestDeliveredAt;
      const sinceDeliveryDays = Math.floor((nowMs - b.newestDeliveredAt) / DAY);
      if (!decidedAfter && sinceDeliveryDays >= ATTENTION_RULES.noClientDecisionDays) {
        reasons.push("no_client_decision");
      }
    }
    if (p['published_at'] && !p['owner_user_id']) reasons.push("published_without_owner");
    const pay = (p['payment_status'] as string | null) ?? null;
    if (!p['published_at'] && (pay === "unpaid" || pay === "pending")) {
      reasons.push("payment_gate");
    }

    if (reasons.length === 0) continue;
    if (reviewed.has(pid)) continue;

    rows.push({
      position_id: pid,
      title: String(p['title'] ?? "Untitled position"),
      organization_id: String(p['organization_id']),
      organization_name: orgName.get(String(p['organization_id'])) ?? "Unknown account",
      days_open: daysOpen,
      owner_user_id: (p['owner_user_id'] as string | null) ?? null,
      owner_name: p['owner_user_id'] ? (ownerName.get(String(p['owner_user_id'])) ?? null) : null,
      candidates_sourced: b.sourced,
      submitted_to_client: b.submitted,
      in_interview: b.interview,
      last_movement_at:
        b.lastMovementAt === null ? null : new Date(b.lastMovementAt).toISOString(),
      status: String(p['status']),
      visibility: String(p['visibility']),
      payment_status: pay,
      published_at: (p['published_at'] as string | null) ?? null,
      is_test_record: Boolean(p['is_test_record']),
      reasons,
    });
  }

  // Deterministic ordering: most reasons first, then longest open. Not a score.
  rows.sort((x, y) => y.reasons.length - x.reasons.length || y.days_open - x.days_open);

  const reviewedToday = positions.filter((p) => reviewed.has(String(p['id']))).length;

  return {
    rows,
    checked,
    reviewed_today: reviewedToday,
    generated_at: new Date().toISOString(),
  };
}

/** Staff who can own a position. */
export async function listOwnerOptions(admin: Admin) {
  const a = admin as unknown as { from: (t: string) => any };
  const [roles, staff] = await Promise.all([
    a.from("user_roles").select("user_id").eq("role", "admin"),
    a
      .from("memberships")
      .select("user_id")
      .eq("status", "active")
      .in("role", ["platform_admin", "operations"]),
  ]);
  if (roles.error) throw new Error(roles.error.message);
  if (staff.error) throw new Error(staff.error.message);
  const ids = Array.from(
    new Set(
      [...((roles.data ?? []) as Array<{ user_id: string }>), ...((staff.data ?? []) as Array<{ user_id: string }>)].map(
        (r) => r.user_id,
      ),
    ),
  );
  if (ids.length === 0) return [] as Array<{ user_id: string; name: string }>;

  const profs = await a
    .from("profiles")
    .select("auth_user_id, full_name, email")
    .in("auth_user_id", ids);
  if (profs.error) throw new Error(profs.error.message);
  return (
    (profs.data ?? []) as Array<{
      auth_user_id: string;
      full_name: string | null;
      email: string | null;
    }>
  )
    .map((p) => ({
      user_id: p.auth_user_id,
      name: p.full_name || p.email || p.auth_user_id.slice(0, 8),
    }))
    .sort((x, y) => x.name.localeCompare(y.name));
}
