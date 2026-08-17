/**
 * Candidate audit history loader.
 *
 * Read-only. Pulls the five recorded sources for one candidate match and maps
 * each row to a timeline event without inventing anything:
 *
 *   audit_events            — entity_type candidate_match / candidate_profile
 *   candidate_stage_history — every stage move with reason
 *   score_decisions         — approve / reject / adjust on a score run
 *   evidence_overrides      — manual evidence corrections (before/after/reason)
 *   client_decisions        — client-side decisions, plus recorded reversals
 *
 * There are no write paths in this module: history cannot be edited or deleted
 * from the product.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  HISTORY_SOURCE_LIMIT,
  sortHistory,
  type HistoryEvent,
  type HistoryFieldChange,
} from "./candidate-history";

type Admin = SupabaseClient<never, never, never>;
type Row = Record<string, unknown>;

export type CandidateHistory = {
  match_id: string;
  candidate_name: string;
  events: HistoryEvent[];
  /** True when a source hit the per-source ceiling (oldest rows omitted). */
  truncated: boolean;
  generated_at: string;
};

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.length ? v : null;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}

function display(v: unknown): string | null {
  const s = str(v);
  if (s !== null) return s;
  if (v === null || v === undefined) return null;
  try {
    const json = JSON.stringify(v);
    return json && json !== "{}" && json !== "[]" ? json.slice(0, 400) : null;
  } catch {
    return null;
  }
}

function humanize(action: string): string {
  const cleaned = action.replace(/[._]/g, " ").trim();
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : action;
}

/** Field-level diff between two recorded JSON states. Unchanged keys dropped. */
function diffStates(before: unknown, after: unknown): HistoryFieldChange[] {
  const b = (before && typeof before === "object" ? before : {}) as Row;
  const a = (after && typeof after === "object" ? after : {}) as Row;
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)])).sort();
  const out: HistoryFieldChange[] = [];
  for (const key of keys) {
    const bv = display(b[key]);
    const av = display(a[key]);
    if (bv === av) continue;
    out.push({ field: key, before: bv, after: av });
  }
  return out;
}

function contextFrom(source: Row, fields: string[]): HistoryFieldChange[] {
  const out: HistoryFieldChange[] = [];
  for (const field of fields) {
    const value = display(source[field]);
    if (value === null) continue;
    out.push({ field, before: null, after: value });
  }
  return out;
}

function fail(results: Array<{ error?: { message: string } | null }>) {
  for (const r of results) {
    if (r?.error) throw new Error(r.error.message);
  }
}

export async function loadCandidateHistory(
  admin: Admin,
  args: { matchId: string },
): Promise<CandidateHistory> {
  const a = admin as unknown as {
    from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  };

  const matchRes = await a
    .from("candidate_matches")
    .select("id, candidate_profile_id, candidate_profiles(full_name)")
    .eq("id", args.matchId)
    .maybeSingle();
  fail([matchRes]);
  const match = matchRes.data as Row | null;
  if (!match) throw new Error("Candidate match not found");

  const candidateProfileId = str(match["candidate_profile_id"]);
  const profile = match["candidate_profiles"] as Row | null;
  const candidateName = str(profile?.["full_name"]) ?? "Unnamed candidate";

  const entityIds = [args.matchId, ...(candidateProfileId ? [candidateProfileId] : [])];

  const [auditRes, stageRes, scoreRes, overrideRes, clientRes] = await Promise.all([
    a
      .from("audit_events")
      .select(
        "id, action, actor_user_id, before_state, after_state, created_at, entity_type, entity_id, trace_id",
      )
      .in("entity_type", ["candidate_match", "candidate_profile"])
      .in("entity_id", entityIds)
      .order("created_at", { ascending: false })
      .limit(HISTORY_SOURCE_LIMIT),
    a
      .from("candidate_stage_history")
      .select(
        "id, from_stage, to_stage, reason, actor_user_id, actor_role, metadata, created_at, trace_id",
      )
      .eq("candidate_match_id", args.matchId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_SOURCE_LIMIT),
    a
      .from("score_decisions")
      .select("id, decision_type, approved_score, reason, actor_user_id, score_run_id, created_at")
      .eq("candidate_match_id", args.matchId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_SOURCE_LIMIT),
    a
      .from("evidence_overrides")
      .select(
        "id, evidence_item_id, before_state, after_state, reason, actor_user_id, created_at",
      )
      .eq("candidate_match_id", args.matchId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_SOURCE_LIMIT),
    a
      .from("client_decisions")
      .select(
        "id, decision, from_stage, reason_code, feedback, details, actor_user_id, created_at, reversed_at, reversed_by",
      )
      .eq("candidate_match_id", args.matchId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_SOURCE_LIMIT),
  ]);
  fail([auditRes, stageRes, scoreRes, overrideRes, clientRes]);

  const auditRows = (auditRes.data ?? []) as Row[];
  const stageRows = (stageRes.data ?? []) as Row[];
  const scoreRows = (scoreRes.data ?? []) as Row[];
  const overrideRows = (overrideRes.data ?? []) as Row[];
  const clientRows = (clientRes.data ?? []) as Row[];

  const truncated = [auditRows, stageRows, scoreRows, overrideRows, clientRows].some(
    (rows) => rows.length >= HISTORY_SOURCE_LIMIT,
  );

  const actorIds = Array.from(
    new Set(
      [
        ...auditRows.map((r) => r["actor_user_id"]),
        ...stageRows.map((r) => r["actor_user_id"]),
        ...scoreRows.map((r) => r["actor_user_id"]),
        ...overrideRows.map((r) => r["actor_user_id"]),
        ...clientRows.map((r) => r["actor_user_id"]),
        ...clientRows.map((r) => r["reversed_by"]),
      ].filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  );

  const profRes = actorIds.length
    ? await a.from("profiles").select("auth_user_id, full_name, email").in("auth_user_id", actorIds)
    : { data: [], error: null };
  fail([profRes]);
  const actorName = new Map(
    ((profRes.data ?? []) as Row[]).map((p) => [
      String(p["auth_user_id"]),
      str(p["full_name"]) ?? str(p["email"]) ?? "Unknown user",
    ]),
  );

  const nameOf = (id: unknown): { actor_user_id: string | null; actor_name: string | null } => {
    const uid = str(id);
    if (!uid) return { actor_user_id: null, actor_name: null };
    return { actor_user_id: uid, actor_name: actorName.get(uid) ?? "Unknown user" };
  };

  const { sanitizeInternalMarkers } = await import("./human-labels");
  const diffStates = (before: any, after: any) => {
    const out: any[] = [];
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    for (const k of keys) {
      if (["updated_at", "created_at", "id", "organization_id"].includes(k)) continue;
      const b = before?.[k];
      const a = after?.[k];
      if (JSON.stringify(b) !== JSON.stringify(a)) {
        out.push({
          field: k,
          before: typeof b === "string" ? (sanitizeInternalMarkers(b) ?? "—") : str(b),
          after: typeof a === "string" ? (sanitizeInternalMarkers(a) ?? "—") : str(a),
        });
      }
    }
    return out;
  };

  const events: HistoryEvent[] = [];

  for (const r of auditRows) {
    const action = String(r["action"] ?? "event");
    events.push({
      id: `audit_event:${String(r["id"])}`,
      source: "audit_event",
      at: String(r["created_at"]),
      action,
      action_label: humanize(action),
      ...nameOf(r["actor_user_id"]),
      actor_role: null,
      reason:
        str((r["after_state"] as Row | null)?.["reason"]) ??
        str((r["after_state"] as Row | null)?.["note"]) ??
        null,
      changes: diffStates(r["before_state"], r["after_state"]),
      trace_id: str(r["trace_id"]),
      context: contextFrom(r, ["entity_type"]),
    });
  }

  for (const r of stageRows) {
    events.push({
      id: `stage_history:${String(r["id"])}`,
      source: "stage_history",
      at: String(r["created_at"]),
      action: String(r["to_stage"] ?? "stage_change"),
      action_label: `${str(r["from_stage"]) ?? "start"} → ${str(r["to_stage"]) ?? "?"}`,
      ...nameOf(r["actor_user_id"]),
      actor_role: str(r["actor_role"]),
      reason: str(r["reason"]),
      changes: [
        { field: "stage", before: str(r["from_stage"]), after: str(r["to_stage"]) },
      ],
      trace_id: str(r["trace_id"]),
      context: diffStates({}, r["metadata"]),
    });
  }

  for (const r of scoreRows) {
    const action = String(r["decision_type"] ?? "decision");
    events.push({
      id: `score_decision:${String(r["id"])}`,
      source: "score_decision",
      at: String(r["created_at"]),
      action,
      action_label: humanize(action),
      ...nameOf(r["actor_user_id"]),
      actor_role: null,
      reason: str(r["reason"]),
      changes: [],
      trace_id: null,
      context: contextFrom(r, ["approved_score", "score_run_id"]),
    });
  }

  for (const r of overrideRows) {
    events.push({
      id: `evidence_override:${String(r["id"])}`,
      source: "evidence_override",
      at: String(r["created_at"]),
      action: "evidence_override",
      action_label: "Evidence corrected",
      ...nameOf(r["actor_user_id"]),
      actor_role: null,
      reason: str(r["reason"]),
      changes: diffStates(r["before_state"], r["after_state"]),
      trace_id: null,
      context: contextFrom(r, ["evidence_item_id"]),
    });
  }

  for (const r of clientRows) {
    const action = String(r["decision"] ?? "decision");
    events.push({
      id: `client_decision:${String(r["id"])}`,
      source: "client_decision",
      at: String(r["created_at"]),
      action,
      action_label: humanize(action),
      ...nameOf(r["actor_user_id"]),
      actor_role: "client",
      reason: str(r["feedback"]) ?? str(r["reason_code"]),
      changes: [],
      trace_id: null,
      context: [
        ...contextFrom(r, ["from_stage", "reason_code", "feedback"]),
        ...diffStates({}, r["details"]),
      ],
    });
    // Reversal is a recorded column pair on the same row, not an inferred event.
    const reversedAt = str(r["reversed_at"]);
    if (reversedAt) {
      events.push({
        id: `client_decision:${String(r["id"])}:reversal`,
        source: "client_decision",
        at: reversedAt,
        action: `${action}.reversed`,
        action_label: `${humanize(action)} reversed`,
        ...nameOf(r["reversed_by"]),
        actor_role: "client",
        reason: null,
        changes: [{ field: "decision", before: action, after: "reversed" }],
        trace_id: null,
        context: [{ field: "client_decision_id", before: null, after: String(r["id"]) }],
      });
    }
  }

  return {
    match_id: args.matchId,
    candidate_name: candidateName,
    events: sortHistory(events),
    truncated,
    generated_at: new Date().toISOString(),
  };
}
