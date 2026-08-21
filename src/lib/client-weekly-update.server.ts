import {
  WEEKLY_WINDOW_DAYS,
  metricLabel,
  plural,
  type WeeklyAwaitingRole,
  type WeeklyMetric,
  type WeeklyNextStep,
  type WeeklyUpdate,
} from "@/lib/client-weekly-update";

/**
 * Builds the weekly client update from stored events only.
 *
 * Takes whichever Supabase client the caller already has: the user-scoped
 * client for the dashboard card (RLS applies), the admin client for the digest
 * job. Same queries either way, so the card and the email cannot disagree.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/** Position statuses a client considers "live work in progress". */
const LIVE_STATUSES = ["active", "approved", "sourcing", "interviewing", "offer"];

function uniqueTitles(rows: Row[], titleOf: (r: Row) => string | undefined): string[] {
  const out: string[] = [];
  for (const r of rows) {
    const t = titleOf(r);
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

export async function buildWeeklyUpdate(
  client: AnyClient,
  orgId: string,
  now: Date = new Date(),
): Promise<WeeklyUpdate> {
  const windowEnd = now;
  const windowStart = new Date(now.getTime() - WEEKLY_WINDOW_DAYS * 86_400_000);
  const startIso = windowStart.toISOString();
  const endIso = windowEnd.toISOString();

  const [positionsRes, deliveredRes, interviewsRes, decisionsRes, awaitingRes, infoRes, upcomingRes] =
    await Promise.all([
      // Live roles, for titles and for the blocker reason on a quiet week.
      client
        .from("positions")
        .select("id, title, status, created_at")
        .eq("organization_id", orgId)
        .in("status", LIVE_STATUSES),

      // Candidates delivered in the window.
      client
        .from("candidate_matches")
        .select("id, position_id, delivered_at, positions(title)")
        .eq("organization_id", orgId)
        .not("delivered_at", "is", null)
        .gte("delivered_at", startIso)
        .lte("delivered_at", endIso)
        .order("delivered_at", { ascending: true }),

      // Interviews actually held — completed, not merely booked.
      client
        .from("interviews")
        .select("id, position_id, completed_at, positions(title)")
        .eq("organization_id", orgId)
        .not("completed_at", "is", null)
        .gte("completed_at", startIso)
        .lte("completed_at", endIso)
        .order("completed_at", { ascending: true }),

      // Client decisions that stuck (a reversed decision is not a decision).
      // Decisions hang off the match, so the role comes through that join.
      // P40: We count distinct candidates decided upon in the window to prevent
      // double-counting multiple updates/history rows as separate decisions.
      client
        .from("client_decisions")
        .select(
          "candidate_match_id, created_at, reversed_at, candidate_matches(position_id, positions(title))",
        )
        .eq("organization_id", orgId)
        .is("reversed_at", null)
        .gte("created_at", startIso)
        .lte("created_at", endIso)
        .order("created_at", { ascending: true }),

      // Candidates sitting with the client right now.
      client
        .from("candidate_matches")
        .select("id, position_id, delivered_at, submitted_to_client_at, positions(title)")
        .eq("organization_id", orgId)
        .eq("stage", "delivered"),

      // Open information requests — the other thing that blocks a role.
      client
        .from("position_info_requests")
        .select("id, position_id, brief_field, created_at, positions(title)")
        .eq("organization_id", orgId)
        .eq("status", "open"),

      // Interviews booked ahead: a recorded commitment for next week.
      client
        .from("interviews")
        .select("id, position_id, scheduled_at, positions(title)")
        .eq("organization_id", orgId)
        .not("scheduled_at", "is", null)
        .gte("scheduled_at", endIso)
        .lte("scheduled_at", new Date(windowEnd.getTime() + 7 * 86_400_000).toISOString()),
    ]);

  const positions = (positionsRes.data ?? []) as Row[];
  const titleById = new Map<string, string>();
  for (const p of positions) titleById.set(p.id as string, (p.title as string) ?? "Role");

  const titleOf = (r: Row): string | undefined => {
    const nested = (r.candidate_matches as Row | null) ?? null;
    return (
      ((r.positions as Row | null)?.title as string | undefined) ??
      ((nested?.positions as Row | null)?.title as string | undefined) ??
      titleById.get((r.position_id ?? nested?.position_id) as string)
    );
  };

  const delivered = (deliveredRes.data ?? []) as Row[];
  const held = (interviewsRes.data ?? []) as Row[];
  const decisionRows = (decisionsRes.data ?? []) as Row[];
  // Deduplicate by match_id to count one decision event per candidate.
  const decisions = Array.from(
    new Map(decisionRows.map((d) => [d.candidate_match_id, d])).values(),
  );
  const awaitingMatches = (awaitingRes.data ?? []) as Row[];
  const infoRequests = (infoRes.data ?? []) as Row[];
  const upcoming = (upcomingRes.data ?? []) as Row[];

  const metrics: WeeklyMetric[] = [
    {
      key: "delivered",
      label: metricLabel("delivered", delivered.length),
      count: delivered.length,
      roles: uniqueTitles(delivered, titleOf),
    },
    {
      key: "interviews_held",
      label: metricLabel("interviews_held", held.length),
      count: held.length,
      roles: uniqueTitles(held, titleOf),
    },
    {
      key: "decisions_made",
      label: metricLabel("decisions_made", decisions.length),
      count: decisions.length,
      roles: uniqueTitles(decisions, titleOf),
    },
  ];

  // ── Awaiting client action ────────────────────────────────────────────────
  // One entry per role, naming the earliest thing that started the wait.
  const awaiting = new Map<string, WeeklyAwaitingRole>();

  const byPosition = new Map<string, Row[]>();
  for (const m of awaitingMatches) {
    const pid = m.position_id as string;
    byPosition.set(pid, [...(byPosition.get(pid) ?? []), m]);
  }
  for (const [pid, rows] of byPosition) {
    const since = rows
      .map((r) => (r.submitted_to_client_at as string | null) ?? (r.delivered_at as string | null))
      .filter(Boolean)
      .sort()[0] as string | undefined;
    awaiting.set(pid, {
      position_id: pid,
      title: titleOf(rows[0]!) ?? "Role",
      reason: `${rows.length} ${plural(rows.length, "candidate", "candidates")} awaiting your decision`,
      waiting_since: since ?? null,
    });
  }

  for (const r of infoRequests) {
    const pid = r.position_id as string;
    const existing = awaiting.get(pid);
    const reason = "Information needed to keep sourcing";
    const since = (r.created_at as string | null) ?? null;
    if (existing) {
      existing.reason = `${existing.reason} · ${reason.toLowerCase()}`;
      if (since && (!existing.waiting_since || since < existing.waiting_since)) {
        existing.waiting_since = since;
      }
    } else {
      awaiting.set(pid, {
        position_id: pid,
        title: titleOf(r) ?? "Role",
        reason,
        waiting_since: since,
      });
    }
  }

  // ── What happens next week ────────────────────────────────────────────────
  // Derived from records: booked interviews, candidates with you, open
  // requests, otherwise sourcing continues on live roles.
  const nextWeek: WeeklyNextStep[] = [];
  const upcomingByPosition = new Map<string, number>();
  for (const i of upcoming) {
    const pid = i.position_id as string;
    upcomingByPosition.set(pid, (upcomingByPosition.get(pid) ?? 0) + 1);
  }
  for (const [pid, count] of upcomingByPosition) {
    nextWeek.push({
      position_id: pid,
      title: titleById.get(pid) ?? null,
      text: `${count} booked ${plural(count, "interview", "interviews")} to run and write up`,
    });
  }
  if (infoRequests.length > 0) {
    nextWeek.push({
      position_id: null,
      title: null,
      text: `Sourcing resumes on ${infoRequests.length} ${plural(infoRequests.length, "role", "roles")} once the open ${plural(infoRequests.length, "question", "questions")} ${plural(infoRequests.length, "is", "are")} answered`,
    });
  }
  const sourcingRoles = positions.filter(
    (p) => !awaiting.has(p.id as string) && !upcomingByPosition.has(p.id as string),
  );
  if (sourcingRoles.length > 0) {
    nextWeek.push({
      position_id: null,
      title: null,
      text: `Sourcing and screening continues on ${sourcingRoles.length} live ${plural(sourcingRoles.length, "role", "roles")}`,
    });
  }

  // ── Quiet week, stated plainly ────────────────────────────────────────────
  const movement = delivered.length + held.length + decisions.length;
  let reason: string | null = null;
  if (movement === 0) {
    if (infoRequests.length > 0) {
      reason = `we are waiting on ${infoRequests.length} answer${infoRequests.length === 1 ? "" : "s"} from you before sourcing can continue`;
    } else if (awaiting.size > 0) {
      reason = `${awaiting.size} ${plural(awaiting.size, "role is", "roles are")} waiting on your decision`;
    } else if (positions.length === 0) {
      reason = "you have no live roles open with us";
    }
  }

  return {
    organization_id: orgId,
    window_start: startIso,
    window_end: endIso,
    metrics,
    awaiting_client: Array.from(awaiting.values()).sort((a, b) =>
      (a.waiting_since ?? "").localeCompare(b.waiting_since ?? ""),
    ),
    next_week: nextWeek,
    no_movement: movement === 0,
    no_movement_reason: reason,
    generated_at: now.toISOString(),
  };
}
