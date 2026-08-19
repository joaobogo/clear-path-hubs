/**
 * SLA breach list.
 *
 * Every row is derived at query time from `position_commitments` joined to the
 * real pipeline rows that prove (or disprove) the commitment:
 *   - first shortlist days  → earliest client-visible delivered candidate_match
 *   - shortlist size        → count of client-visible delivered candidate_matches
 *   - interview slots hours → interviews.requested_at vs slots offered/booked
 *
 * A breach is only ever "actual exceeds target as of now". No forecasting.
 * Acknowledgements are read back from audit_events so the maths stays
 * reproducible from source rows alone.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

type Admin = SupabaseClient<never, never, never>;

const DAY = 86_400_000;
const HOUR = 3_600_000;

export const SLA_ACK_ACTION = "sla.breach_acknowledged";
export const SLA_ACK_ENTITY = "position_commitment";

export type SlaMetricKey = "first_shortlist" | "shortlist_size" | "interview_slots";

export const SLA_METRIC_LABEL: Record<SlaMetricKey, string> = {
  first_shortlist: "First shortlist",
  shortlist_size: "Shortlist size",
  interview_slots: "Interview slots",
};

export type SlaBreachRow = {
  /** Stable per-row id: commitment id + metric. */
  id: string;
  commitment_id: string;
  metric: SlaMetricKey;
  metric_label: string;
  position_id: string;
  position_title: string;
  organization_id: string;
  client_name: string;
  owner_user_id: string | null;
  owner_name: string;
  /** Target expressed in its own unit. */
  target_value: number;
  target_unit: "days" | "count" | "hours";
  target_label: string;
  /** Actual to date in the same unit as the target. */
  actual_value: number;
  actual_label: string;
  /** Whole days past the moment the commitment was first missed. */
  days_over: number;
  /** The instant the commitment tipped into breach. */
  first_breach_at: string;
  /** How the numbers were derived, for auditability. */
  basis: string;
  acknowledged: {
    at: string;
    by: string;
    note: string;
  } | null;
};

export type SlaBreachList = {
  rows: SlaBreachRow[];
  commitments_monitored: number;
  generated_at: string;
};

function daysOver(fromMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - fromMs) / DAY));
}

function num(value: number): string {
  return String(Math.round(value * 10) / 10);
}

export async function loadSlaBreaches(
  admin: Admin,
  opts: { organizationId?: string; includeTest?: boolean } = {},
): Promise<SlaBreachList> {
  const nowMs = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = admin as unknown as { from: (t: string) => any };

  const commitRes = await a
    .from("position_commitments")
    .select(
      "id, position_id, organization_id, first_shortlist_days, shortlist_size, interview_slots_hours, baseline_at",
    );
  if (opts.organizationId) commitQuery = commitQuery.eq("organization_id", opts.organizationId);
  const commitRes = await commitQuery;
  const commitments = (commitRes.data ?? []) as Array<Record<string, unknown>>;
  if (commitments.length === 0) {
    return { rows: [], commitments_monitored: 0, generated_at: new Date().toISOString() };
  }

  const positionIds = Array.from(new Set(commitments.map((c) => String(c['position_id']))));
  const orgIds = Array.from(new Set(commitments.map((c) => String(c['organization_id']))));

  const [posRes, orgRes, matchRes, ivRes, ackRes] = await Promise.all([
    a
      .from("positions")
      .select("id, title, owner_user_id, organization_id, is_test_record")
      .in("id", positionIds),
    a.from("organizations").select("id, name, is_test_record").in("id", orgIds),
    a
      .from("candidate_matches")
      .select("position_id, delivered_at, client_visibility")
      .in("position_id", positionIds)
      .not("delivered_at", "is", null),
    a
      .from("interviews")
      .select("id, position_id, requested_at, created_at, scheduled_at, proposed_times, updated_at")
      .in("position_id", positionIds),
    a
      .from("audit_events")
      .select("entity_id, actor_user_id, action, after_state, created_at")
      .eq("entity_type", SLA_ACK_ENTITY)
      .eq("action", SLA_ACK_ACTION)
      .order("created_at", { ascending: false }),
  ]);
  for (const r of [posRes, orgRes, matchRes, ivRes, ackRes]) {
    const err = (r as { error?: { message: string } | null }).error;
    if (err) throw new Error(err.message);
  }

  const positions = new Map(
    ((posRes.data ?? []) as Array<Record<string, unknown>>).map((p) => [String(p['id']), p]),
  );
  const orgs = new Map(
    ((orgRes.data ?? []) as Array<Record<string, unknown>>).map((o) => [String(o['id']), o]),
  );

  // Owner names.
  const ownerIds = Array.from(
    new Set(
      Array.from(positions.values())
        .map((p) => p['owner_user_id'])
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  );
  const ackActorIds = Array.from(
    new Set(
      ((ackRes.data ?? []) as Array<Record<string, unknown>>)
        .map((r) => r['actor_user_id'])
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  );
  const profileIds = Array.from(new Set([...ownerIds, ...ackActorIds]));
  const profRes = profileIds.length
    ? await a
        .from("profiles")
        .select("auth_user_id, full_name, email")
        .in("auth_user_id", profileIds)
    : { data: [], error: null };
  if ((profRes as { error?: { message: string } | null }).error) {
    throw new Error((profRes as { error: { message: string } }).error.message);
  }
  const profileName = new Map(
    (
      (profRes.data ?? []) as Array<{
        auth_user_id: string;
        full_name: string | null;
        email: string | null;
      }>
    ).map((p) => [p.auth_user_id, p.full_name || p.email || "Unknown user"]),
  );

  // Latest acknowledgement per row id (commitment:metric).
  const ackByRow = new Map<string, { at: string; by: string; note: string }>();
  for (const r of (ackRes.data ?? []) as Array<Record<string, unknown>>) {
    const after = (r['after_state'] ?? {}) as Record<string, unknown>;
    const metric = String(after['metric'] ?? "");
    const rowId = `${String(r['entity_id'])}:${metric}`;
    if (ackByRow.has(rowId)) continue; // ordered desc, first wins
    const actor = r['actor_user_id'];
    ackByRow.set(rowId, {
      at: String(r['created_at']),
      by:
        typeof actor === "string" ? (profileName.get(actor) ?? "Unknown user") : "Unknown user",
      note: String(after['note'] ?? ""),
    });
  }

  // Client-visible deliveries per position, ascending.
  const deliveries = new Map<string, string[]>();
  for (const m of (matchRes.data ?? []) as Array<Record<string, unknown>>) {
    if (String(m['client_visibility']) !== "visible") continue;
    const pid = String(m['position_id']);
    const list = deliveries.get(pid) ?? [];
    list.push(String(m['delivered_at']));
    deliveries.set(pid, list);
  }
  for (const list of deliveries.values()) list.sort();

  const interviewsByPosition = new Map<string, Array<Record<string, unknown>>>();
  for (const iv of (ivRes.data ?? []) as Array<Record<string, unknown>>) {
    const pid = iv['position_id'];
    if (typeof pid !== "string") continue;
    const list = interviewsByPosition.get(pid) ?? [];
    list.push(iv);
    interviewsByPosition.set(pid, list);
  }

  const rows: SlaBreachRow[] = [];
  let monitored = 0;

  for (const c of commitments) {
    const positionId = String(c['position_id']);
    const position = positions.get(positionId);
    if (!position) continue;
    const org = orgs.get(String(c['organization_id']));
    const isTest =
      position['is_test_record'] === true || (org?.['is_test_record'] as boolean) === true;
    if (isTest && !opts.includeTest) continue;

    monitored += 1;

    const commitmentId = String(c['id']);
    const baselineAt = String(c['baseline_at']);
    const baselineMs = new Date(baselineAt).getTime();
    const targetDays = Number(c['first_shortlist_days']);
    const shortlistSize = Number(c['shortlist_size']);
    const slotHours = Number(c['interview_slots_hours']);
    const ownerRaw = position['owner_user_id'];
    const ownerId = typeof ownerRaw === "string" && ownerRaw ? ownerRaw : null;

    const base = {
      commitment_id: commitmentId,
      position_id: positionId,
      position_title: String(position['title'] ?? "Untitled position"),
      organization_id: String(c['organization_id']),
      client_name: String(org?.['name'] ?? "Unknown client"),
      owner_user_id: ownerId,
      owner_name: ownerId ? (profileName.get(ownerId) ?? "Unknown staff") : "Unassigned",
    };

    const push = (row: Omit<SlaBreachRow, "acknowledged" | "id" | "metric_label">) => {
      const id = `${row.commitment_id}:${row.metric}`;
      rows.push({
        ...row,
        id,
        metric_label: SLA_METRIC_LABEL[row.metric],
        acknowledged: ackByRow.get(id) ?? null,
      });
    };

    const delivered = deliveries.get(positionId) ?? [];
    const deadlineMs = baselineMs + targetDays * DAY;

    // 1 · First shortlist within N days of baseline.
    const firstDelivered = delivered[0] ?? null;
    const firstMs = firstDelivered ? new Date(firstDelivered).getTime() : null;
    const firstActualDays = ((firstMs ?? nowMs) - baselineMs) / DAY;
    if (firstActualDays > targetDays) {
      push({
        ...base,
        metric: "first_shortlist",
        target_value: targetDays,
        target_unit: "days",
        target_label: `${targetDays} days`,
        actual_value: Math.round(firstActualDays * 10) / 10,
        actual_label: firstDelivered
          ? `${num(firstActualDays)} days (delivered)`
          : `${num(firstActualDays)} days (none yet)`,
        days_over: daysOver(deadlineMs, firstMs ?? nowMs),
        first_breach_at: new Date(deadlineMs).toISOString(),
        basis: firstDelivered
          ? `Baseline ${baselineAt.slice(0, 10)} → first client-visible candidate ${firstDelivered.slice(0, 10)}`
          : `Baseline ${baselineAt.slice(0, 10)} → no client-visible candidate yet`,
      });
    }

    // 2 · Shortlist of N by the same deadline.
    if (nowMs > deadlineMs && delivered.length < shortlistSize) {
      push({
        ...base,
        metric: "shortlist_size",
        target_value: shortlistSize,
        target_unit: "count",
        target_label: `${shortlistSize} candidates`,
        actual_value: delivered.length,
        actual_label: `${delivered.length} of ${shortlistSize} delivered`,
        days_over: daysOver(deadlineMs, nowMs),
        first_breach_at: new Date(deadlineMs).toISOString(),
        basis: `${delivered.length} client-visible candidates by day ${targetDays} deadline (${new Date(deadlineMs).toISOString().slice(0, 10)})`,
      });
    }

    // 3 · Interview slots within N hours of a request — worst open/late request.
    let worst: {
      overMs: number;
      dueMs: number;
      actualHours: number;
      requestedAt: string;
      responded: boolean;
    } | null = null;
    for (const iv of interviewsByPosition.get(positionId) ?? []) {
      const requestedAt = (iv['requested_at'] ?? iv['created_at']) as string | null;
      if (!requestedAt) continue;
      const requestedMs = new Date(requestedAt).getTime();
      const dueMs = requestedMs + slotHours * HOUR;
      const proposed = iv['proposed_times'];
      const hasSlots =
        (Array.isArray(proposed) && proposed.length > 0) || Boolean(iv['scheduled_at']);
      const respondedAtRaw = hasSlots
        ? ((iv['updated_at'] ?? iv['scheduled_at']) as string | null)
        : null;
      const endMs = respondedAtRaw ? new Date(respondedAtRaw).getTime() : nowMs;
      if (endMs <= dueMs) continue;
      const candidate = {
        overMs: endMs - dueMs,
        dueMs,
        actualHours: (endMs - requestedMs) / HOUR,
        requestedAt,
        responded: Boolean(respondedAtRaw),
      };
      if (!worst || candidate.overMs > worst.overMs) worst = candidate;
    }
    if (worst) {
      push({
        ...base,
        metric: "interview_slots",
        target_value: slotHours,
        target_unit: "hours",
        target_label: `${slotHours}h`,
        actual_value: Math.round(worst.actualHours * 10) / 10,
        actual_label: `${num(worst.actualHours)}h${worst.responded ? "" : " (still open)"}`,
        days_over: daysOver(worst.dueMs, nowMs),
        first_breach_at: new Date(worst.dueMs).toISOString(),
        basis: `Interview requested ${worst.requestedAt.slice(0, 10)}, slots ${worst.responded ? "offered late" : "not offered yet"} against a ${slotHours}h promise`,
      });
    }
  }

  rows.sort((x, y) => {
    const xAck = x.acknowledged !== null;
    const yAck = y.acknowledged !== null;
    if (xAck !== yAck) return xAck ? 1 : -1;
    if (y.days_over !== x.days_over) return y.days_over - x.days_over;
    return x.client_name.localeCompare(y.client_name);
  });

  return {
    rows,
    commitments_monitored: monitored,
    generated_at: new Date().toISOString(),
  };
}

export async function acknowledgeSlaBreach(
  admin: Admin,
  args: { commitmentId: string; metric: SlaMetricKey; note: string; actorUserId: string },
): Promise<{ ok: true }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = admin as unknown as { from: (t: string) => any };
  const { data: commitment, error } = await a
    .from("position_commitments")
    .select("id, position_id, organization_id")
    .eq("id", args.commitmentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!commitment) throw new Error("Commitment not found");

  const { error: insErr } = await a.from("audit_events").insert({
    actor_user_id: args.actorUserId,
    organization_id: commitment.organization_id,
    entity_type: SLA_ACK_ENTITY,
    entity_id: args.commitmentId,
    action: SLA_ACK_ACTION,
    after_state: {
      metric: args.metric,
      note: args.note,
      position_id: commitment.position_id,
    },
  });
  if (insErr) throw new Error(insErr.message);
  return { ok: true };
}
