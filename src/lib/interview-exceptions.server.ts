/**
 * Interview logistics exceptions — data loading and staff actions.
 *
 * Reads interviews, interview_scorecards, interview_status_history and
 * audit_events (nudge markers). Actions write real rows: recording an outcome
 * updates the interview and inserts interview_status_history, so the exception
 * clears on the next read.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CONFIRM_NUDGE_ACTION,
  CONFIRM_WINDOW_MS,
  INTERVIEW_ENTITY,
  NUDGE_COOLDOWN_MS,
  RESCHEDULE_THRESHOLD,
  SCORECARD_CHASE_ACTION,
  SCORECARD_GRACE_MS,
  confirmationState,
  hoursBetween,
  type InterviewExceptionKind,
  type InterviewExceptionRow,
  type InterviewExceptions,
  type InterviewOutcome,
} from "./interview-exceptions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function check(res: { error?: { message: string } | null }) {
  if (res.error) throw new Error(res.error.message);
}

export async function loadInterviewExceptions(
  admin: Admin,
  opts: { positionId?: string; includeTest?: boolean } = {},
): Promise<InterviewExceptions> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = admin as unknown as { from: (t: string) => any };
  const nowMs = Date.now();

  let q = a
    .from("interviews")
    .select(
      "id, organization_id, position_id, candidate_match_id, interview_type, status, scheduled_at, timezone, completed_at, cancelled_at, candidate_response, reschedule_count, participants, created_by, requested_by_user_id",
    )
    .in("status", ["requested", "scheduling", "scheduled", "completed"])
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .limit(500);
  if (opts.positionId) q = q.eq("position_id", opts.positionId);

  let cancelQ = a
    .from("interviews")
    .select("id", { count: "exact", head: true })
    .eq("status", "cancelled")
    .gte("cancelled_at", new Date(nowMs - 7 * 86_400_000).toISOString());
  if (opts.positionId) cancelQ = cancelQ.eq("position_id", opts.positionId);

  const [ivRes, cancelRes] = await Promise.all([q, cancelQ]);
  check(ivRes);
  check(cancelRes);

  const interviews = (ivRes.data ?? []) as Row[];
  const cancellations = Number((cancelRes as { count?: number }).count ?? 0);
  if (interviews.length === 0) {
    return { rows: [], cancellations_7d: cancellations, generated_at: new Date().toISOString() };
  }

  const ids = interviews.map((i) => String(i["id"]));
  const [scoreRes, nudgeRes] = await Promise.all([
    a
      .from("interview_scorecards")
      .select("interview_id, submitted_at")
      .in("interview_id", ids),
    a
      .from("audit_events")
      .select("entity_id, action, created_at")
      .eq("entity_type", INTERVIEW_ENTITY)
      .in("action", [CONFIRM_NUDGE_ACTION, SCORECARD_CHASE_ACTION])
      .in("entity_id", ids)
      .order("created_at", { ascending: false }),
  ]);
  check(scoreRes);
  check(nudgeRes);

  const submittedScorecards = new Set(
    ((scoreRes.data ?? []) as Row[])
      .filter((s) => s["submitted_at"] != null)
      .map((s) => String(s["interview_id"])),
  );
  const lastNudge = new Map<string, string>();
  const lastChase = new Map<string, string>();
  for (const e of (nudgeRes.data ?? []) as Row[]) {
    const key = String(e["entity_id"]);
    const target = e["action"] === CONFIRM_NUDGE_ACTION ? lastNudge : lastChase;
    if (!target.has(key)) target.set(key, String(e["created_at"]));
  }

  // Classify.
  const flagged: Array<{ row: Row; kinds: InterviewExceptionKind[] }> = [];
  for (const iv of interviews) {
    const kinds: InterviewExceptionKind[] = [];
    const status = String(iv["status"]);
    const scheduledAt = iv["scheduled_at"] ? String(iv["scheduled_at"]) : null;
    const completedAt = iv["completed_at"] ? String(iv["completed_at"]) : null;
    const confirmed = confirmationState(iv["candidate_response"]) === "confirmed";
    const rescheduleCount = Number(iv["reschedule_count"] ?? 0);

    if (
      status === "scheduled" &&
      scheduledAt &&
      !confirmed &&
      new Date(scheduledAt).getTime() - nowMs < CONFIRM_WINDOW_MS
    ) {
      kinds.push("unconfirmed");
    }
    if (
      status === "completed" &&
      completedAt &&
      nowMs - new Date(completedAt).getTime() > SCORECARD_GRACE_MS &&
      !submittedScorecards.has(String(iv["id"]))
    ) {
      kinds.push("missing_scorecard");
    }
    if (rescheduleCount >= RESCHEDULE_THRESHOLD && status !== "completed") {
      kinds.push("reschedules");
    }
    if (kinds.length > 0) flagged.push({ row: iv, kinds });
  }

  if (flagged.length === 0) {
    return { rows: [], cancellations_7d: cancellations, generated_at: new Date().toISOString() };
  }

  const matchIds = Array.from(
    new Set(
      flagged
        .map((f) => f.row["candidate_match_id"])
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  );
  const positionIds = Array.from(new Set(flagged.map((f) => String(f.row["position_id"]))));
  const orgIds = Array.from(new Set(flagged.map((f) => String(f.row["organization_id"]))));
  const staffIds = Array.from(
    new Set(
      flagged
        .flatMap((f) => [f.row["created_by"], f.row["requested_by_user_id"]])
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  );

  const [matchRes, posRes, orgRes, profRes] = await Promise.all([
    matchIds.length
      ? a
          .from("candidate_matches")
          .select("id, candidate_profile_id, is_test_record")
          .in("id", matchIds)
      : Promise.resolve({ data: [], error: null }),
    a.from("positions").select("id, title, is_test_record").in("id", positionIds),
    a.from("organizations").select("id, name, is_test_record").in("id", orgIds),
    staffIds.length
      ? a.from("profiles").select("auth_user_id, full_name, email").in("auth_user_id", staffIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  check(matchRes);
  check(posRes);
  check(orgRes);
  check(profRes);

  const matches = new Map(((matchRes.data ?? []) as Row[]).map((m) => [String(m["id"]), m]));
  const positions = new Map(((posRes.data ?? []) as Row[]).map((p) => [String(p["id"]), p]));
  const orgs = new Map(((orgRes.data ?? []) as Row[]).map((o) => [String(o["id"]), o]));
  const people = new Map(
    ((profRes.data ?? []) as Row[]).map((p) => [
      String(p["auth_user_id"]),
      String(p["full_name"] || p["email"] || "Unknown user"),
    ]),
  );

  const profileIds = Array.from(
    new Set(
      Array.from(matches.values())
        .map((m) => m["candidate_profile_id"])
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  );
  const candRes = profileIds.length
    ? await a.from("candidate_profiles").select("id, full_name").in("id", profileIds)
    : { data: [], error: null };
  check(candRes);
  const candidateName = new Map(
    ((candRes.data ?? []) as Row[]).map((c) => [
      String(c["id"]),
      String(c["full_name"] ?? "Unnamed candidate"),
    ]),
  );

  const rows: InterviewExceptionRow[] = [];
  for (const { row: iv, kinds } of flagged) {
    const orgRow = orgs.get(String(iv["organization_id"]));
    const posRow = positions.get(String(iv["position_id"]));
    const matchRow =
      typeof iv["candidate_match_id"] === "string" ? matches.get(iv["candidate_match_id"]) : null;
    const isTest =
      orgRow?.["is_test_record"] === true ||
      posRow?.["is_test_record"] === true ||
      matchRow?.["is_test_record"] === true;
    if (isTest && !opts.includeTest) continue;

    const scheduledAt = iv["scheduled_at"] ? String(iv["scheduled_at"]) : null;
    const completedAt = iv["completed_at"] ? String(iv["completed_at"]) : null;
    const nudgeAt = lastNudge.get(String(iv["id"])) ?? null;
    const chaseAt = lastChase.get(String(iv["id"])) ?? null;
    const participants = Array.isArray(iv["participants"]) ? (iv["participants"] as unknown[]) : [];
    const firstParticipant = participants
      .map((p) =>
        typeof p === "string"
          ? p
          : p && typeof p === "object"
            ? String((p as Row)["name"] ?? (p as Row)["email"] ?? "")
            : "",
      )
      .find((s) => s.length > 0);

    const profileId = matchRow?.["candidate_profile_id"];

    rows.push({
      interview_id: String(iv["id"]),
      kinds,
      organization_id: String(iv["organization_id"]),
      organization_name: String(orgRow?.["name"] ?? "Unknown client"),
      position_id: String(iv["position_id"]),
      position_title: String(posRow?.["title"] ?? "Untitled position"),
      candidate_match_id:
        typeof iv["candidate_match_id"] === "string" ? iv["candidate_match_id"] : null,
      candidate_name:
        (typeof profileId === "string" ? candidateName.get(profileId) : undefined) ?? "Candidate",
      interviewer:
        firstParticipant ??
        (typeof iv["created_by"] === "string" ? (people.get(iv["created_by"]) ?? null) : null),
      interview_type: iv["interview_type"] ? String(iv["interview_type"]) : null,
      status: String(iv["status"]),
      scheduled_at: scheduledAt,
      timezone: iv["timezone"] ? String(iv["timezone"]) : null,
      completed_at: completedAt,
      confirmation_state:
        String(iv["status"]) === "completed"
          ? "not_applicable"
          : confirmationState(iv["candidate_response"]),
      reschedule_count: Number(iv["reschedule_count"] ?? 0),
      hours_to_slot: scheduledAt ? -hoursBetween(scheduledAt, nowMs) : null,
      hours_since_completed: completedAt ? hoursBetween(completedAt, nowMs) : null,
      last_confirmation_nudge_at: nudgeAt,
      last_scorecard_chase_at: chaseAt,
      nudge_allowed: !nudgeAt || nowMs - new Date(nudgeAt).getTime() > NUDGE_COOLDOWN_MS,
      chase_allowed: !chaseAt || nowMs - new Date(chaseAt).getTime() > NUDGE_COOLDOWN_MS,
    });
  }

  rows.sort((x, y) => {
    const ax = x.scheduled_at ?? x.completed_at ?? "";
    const ay = y.scheduled_at ?? y.completed_at ?? "";
    return ax < ay ? -1 : 1;
  });

  return { rows, cancellations_7d: cancellations, generated_at: new Date().toISOString() };
}

async function loadInterview(a: { from: (t: string) => Row }, interviewId: string): Promise<Row> {
  const res = await (
    a.from("interviews") as unknown as {
      select: (s: string) => { eq: (c: string, v: string) => { maybeSingle: () => Promise<Row> } };
    }
  )
    .select("id, organization_id, status, scheduled_at, timezone, reschedule_count")
    .eq("id", interviewId)
    .maybeSingle();
  check(res as { error?: { message: string } | null });
  const iv = (res as Row)["data"] as Row | null;
  if (!iv) throw new Error("Interview not found");
  return iv;
}

/** Records a nudge or a scorecard chase as an audit event (rate limited). */
export async function recordInterviewNudge(
  admin: Admin,
  args: { interviewId: string; actorUserId: string; kind: "confirmation" | "scorecard"; note?: string },
): Promise<{ ok: true }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = admin as unknown as { from: (t: string) => any };
  const iv = await loadInterview(a, args.interviewId);
  const action = args.kind === "confirmation" ? CONFIRM_NUDGE_ACTION : SCORECARD_CHASE_ACTION;

  const lastRes = await a
    .from("audit_events")
    .select("created_at")
    .eq("entity_type", INTERVIEW_ENTITY)
    .eq("entity_id", args.interviewId)
    .eq("action", action)
    .order("created_at", { ascending: false })
    .limit(1);
  check(lastRes);
  const last = (lastRes.data ?? [])[0]?.["created_at"];
  if (typeof last === "string" && Date.now() - new Date(last).getTime() <= NUDGE_COOLDOWN_MS) {
    throw new Error("A nudge was already sent in the last 24 hours");
  }

  const insertRes = await a.from("audit_events").insert({
    entity_type: INTERVIEW_ENTITY,
    entity_id: args.interviewId,
    organization_id: iv["organization_id"],
    actor_user_id: args.actorUserId,
    action,
    after_state: { note: args.note ?? null },
  });
  check(insertRes);
  return { ok: true };
}

/**
 * Records an outcome: updates the interview and writes interview_status_history.
 * No automatic rescheduling — "needs_rescheduling" only returns the interview to
 * the scheduling state for a human to handle.
 */
export async function recordInterviewOutcome(
  admin: Admin,
  args: {
    interviewId: string;
    actorUserId: string;
    outcome: InterviewOutcome;
    reason: string;
  },
): Promise<{ ok: true; status: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = admin as unknown as { from: (t: string) => any };
  const iv = await loadInterview(a, args.interviewId);
  const fromStatus = String(iv["status"]);
  const nowIso = new Date().toISOString();

  const patch: Row = { updated_at: nowIso, updated_by: args.actorUserId };
  let toStatus: string;
  switch (args.outcome) {
    case "completed":
      toStatus = "completed";
      patch["status"] = "completed";
      patch["completed_at"] = nowIso;
      break;
    case "no_show":
      toStatus = "cancelled";
      patch["status"] = "cancelled";
      patch["cancelled_at"] = nowIso;
      patch["cancel_reason"] = `candidate_no_show: ${args.reason}`;
      break;
    case "cancelled":
      toStatus = "cancelled";
      patch["status"] = "cancelled";
      patch["cancelled_at"] = nowIso;
      patch["cancel_reason"] = args.reason;
      break;
    case "needs_rescheduling":
      toStatus = "scheduling";
      patch["status"] = "scheduling";
      patch["admin_coordination_required"] = true;
      break;
  }

  const updRes = await a.from("interviews").update(patch).eq("id", args.interviewId);
  check(updRes);

  const histRes = await a.from("interview_status_history").insert({
    interview_id: args.interviewId,
    organization_id: iv["organization_id"],
    from_status: fromStatus,
    to_status: toStatus,
    reason: `${args.outcome}: ${args.reason}`,
    actor_user_id: args.actorUserId,
    actor_role: "platform_staff",
    scheduled_at: iv["scheduled_at"] ?? null,
    timezone: iv["timezone"] ?? null,
  });
  check(histRes);

  const auditRes = await a.from("audit_events").insert({
    entity_type: INTERVIEW_ENTITY,
    entity_id: args.interviewId,
    organization_id: iv["organization_id"],
    actor_user_id: args.actorUserId,
    action: "interview.outcome_recorded",
    before_state: { status: fromStatus },
    after_state: { status: toStatus, outcome: args.outcome, reason: args.reason },
  });
  check(auditRes);

  return { ok: true, status: toStatus };
}
