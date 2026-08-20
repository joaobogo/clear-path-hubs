/**
 * Loads the client update readiness snapshot for one organization.
 *
 * All rows come from source tables at query time:
 *   - submitted candidates → candidate_matches.delivered_at
 *   - decisions received   → client_decisions.created_at
 *   - interviews           → interviews (created / completed)
 *   - stage moves          → candidate_stage_history
 *   - blockers             → visible+delivered matches with no decision
 *   - shareable notes      → internal_notes (client_shareable, current revision)
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  REVERT_WINDOW_MS,
  UPDATE_ENTITY,
  UPDATE_SENT_ACTION,
  UPDATE_SENT_REVERTED_ACTION,
  type ReadinessItem,
  type ReadinessSection,
  type UpdateReadiness,
} from "./client-update-readiness";
import { APP_LOCALE, WORKSPACE_TIMEZONE, formatDateTime } from "@/lib/format/datetime";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function check(res: { error?: { message: string } | null }) {
  if (res.error) throw new Error(res.error.message);
}

function stageLabel(s: unknown): string {
  return String(s ?? "unknown").replace(/_/g, " ");
}

export async function loadUpdateReadiness(
  admin: Admin,
  organizationId: string,
): Promise<UpdateReadiness> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = admin as unknown as { from: (t: string) => any };

  const orgRes = await a.from("organizations").select("id, name, created_at").eq("id", organizationId).maybeSingle();
  check(orgRes);
  const org = orgRes.data as Row | null;
  if (!org) throw new Error("Organization not found");

  // ── Baseline ────────────────────────────────────────────────────────────
  const [sentRes, revertRes] = await Promise.all([
    a
      .from("audit_events")
      .select("id, created_at, after_state")
      .eq("entity_type", UPDATE_ENTITY)
      .eq("entity_id", organizationId)
      .eq("action", UPDATE_SENT_ACTION)
      .order("created_at", { ascending: false })
      .limit(50),
    a
      .from("audit_events")
      .select("after_state")
      .eq("entity_type", UPDATE_ENTITY)
      .eq("entity_id", organizationId)
      .eq("action", UPDATE_SENT_REVERTED_ACTION)
      .limit(200),
  ]);
  check(sentRes);
  check(revertRes);
  const reverted = new Set(
    ((revertRes.data ?? []) as Row[])
      .map((r) => (r["after_state"] as Row | null)?.["event_id"])
      .filter((v): v is string => typeof v === "string"),
  );
  const activeMarker = ((sentRes.data ?? []) as Row[]).find((r) => !reverted.has(String(r["id"])));

  let baselineAt: string;
  let baselineSource: UpdateReadiness["baseline_source"];
  let revertEventId: string | null = null;
  let revertUntil: string | null = null;

  if (activeMarker) {
    baselineAt = String(activeMarker["created_at"]);
    baselineSource = "update_sent";
    const untilMs = new Date(baselineAt).getTime() + REVERT_WINDOW_MS;
    if (untilMs > Date.now()) {
      revertEventId = String(activeMarker["id"]);
      revertUntil = new Date(untilMs).toISOString();
    }
  } else {
    const [lastDelivered, lastDecision] = await Promise.all([
      a
        .from("candidate_matches")
        .select("delivered_at")
        .eq("organization_id", organizationId)
        .eq("client_visibility", "visible")
        .not("delivered_at", "is", null)
        .order("delivered_at", { ascending: false })
        .limit(1),
      a
        .from("client_decisions")
        .select("created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    check(lastDelivered);
    check(lastDecision);
    const candidates = [
      (lastDelivered.data ?? [])[0]?.["delivered_at"],
      (lastDecision.data ?? [])[0]?.["created_at"],
    ].filter((v): v is string => typeof v === "string");
    if (candidates.length > 0) {
      baselineAt = candidates.sort().at(-1) as string;
      baselineSource = "client_activity";
    } else {
      baselineAt = String(org["created_at"]);
      baselineSource = "organization_created";
    }
  }

  // ── Activity since baseline ─────────────────────────────────────────────
  const [submittedRes, decisionsRes, ivCreatedRes, ivDoneRes, stageRes, notesRes, openRes] =
    await Promise.all([
      a
        .from("candidate_matches")
        .select("id, position_id, candidate_profile_id, stage, delivered_at, is_test_record")
        .eq("organization_id", organizationId)
        .eq("client_visibility", "visible")
        .gt("delivered_at", baselineAt)
        .order("delivered_at", { ascending: false })
        .limit(200),
      a
        .from("client_decisions")
        .select("id, candidate_match_id, decision, feedback, created_at")
        .eq("organization_id", organizationId)
        .gt("created_at", baselineAt)
        .order("created_at", { ascending: false })
        .limit(200),
      a
        .from("interviews")
        .select("id, candidate_match_id, position_id, interview_type, status, scheduled_at, created_at")
        .eq("organization_id", organizationId)
        .gt("created_at", baselineAt)
        .order("created_at", { ascending: false })
        .limit(200),
      a
        .from("interviews")
        .select("id, candidate_match_id, position_id, interview_type, status, completed_at")
        .eq("organization_id", organizationId)
        .not("completed_at", "is", null)
        .gt("completed_at", baselineAt)
        .order("completed_at", { ascending: false })
        .limit(200),
      a
        .from("candidate_stage_history")
        .select("id, candidate_match_id, position_id, from_stage, to_stage, reason, created_at")
        .eq("organization_id", organizationId)
        .gt("created_at", baselineAt)
        .order("created_at", { ascending: false })
        .limit(200),
      a
        .from("internal_notes")
        .select("id, entity_type, entity_id, note_type, body, created_at")
        .eq("organization_id", organizationId)
        .eq("client_shareable", true)
        .is("superseded_at", null)
        .gt("created_at", baselineAt)
        .order("created_at", { ascending: false })
        .limit(100),
      a
        .from("candidate_matches")
        .select("id, position_id, candidate_profile_id, stage, delivered_at, is_test_record")
        .eq("organization_id", organizationId)
        .eq("client_visibility", "visible")
        .not("delivered_at", "is", null)
        .order("delivered_at", { ascending: true })
        .limit(200),
    ]);
  for (const r of [submittedRes, decisionsRes, ivCreatedRes, ivDoneRes, stageRes, notesRes, openRes]) {
    check(r);
  }

  const submitted = ((submittedRes.data ?? []) as Row[]).filter((m) => m["is_test_record"] !== true);
  const openMatches = ((openRes.data ?? []) as Row[]).filter((m) => m["is_test_record"] !== true);

  // Names for referenced records.
  const matchIds = Array.from(
    new Set(
      [
        ...submitted.map((m) => String(m["id"])),
        ...openMatches.map((m) => String(m["id"])),
        ...((decisionsRes.data ?? []) as Row[]).map((d) => String(d["candidate_match_id"])),
        ...((ivCreatedRes.data ?? []) as Row[]).map((i) => i["candidate_match_id"]),
        ...((ivDoneRes.data ?? []) as Row[]).map((i) => i["candidate_match_id"]),
        ...((stageRes.data ?? []) as Row[]).map((s) => String(s["candidate_match_id"])),
        ...((notesRes.data ?? []) as Row[])
          .filter((n) => n["entity_type"] === "candidate_match")
          .map((n) => String(n["entity_id"])),
      ].filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  );

  const matchRes = matchIds.length
    ? await a
        .from("candidate_matches")
        .select("id, position_id, candidate_profile_id")
        .in("id", matchIds)
    : { data: [], error: null };
  check(matchRes);
  const matchRows = new Map(((matchRes.data ?? []) as Row[]).map((m) => [String(m["id"]), m]));

  const profileIds = Array.from(
    new Set(
      Array.from(matchRows.values())
        .map((m) => m["candidate_profile_id"])
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  );
  const positionIds = Array.from(
    new Set(
      [
        ...Array.from(matchRows.values()).map((m) => m["position_id"]),
        ...((ivCreatedRes.data ?? []) as Row[]).map((i) => i["position_id"]),
        ...((ivDoneRes.data ?? []) as Row[]).map((i) => i["position_id"]),
        ...((stageRes.data ?? []) as Row[]).map((s) => s["position_id"]),
        ...((notesRes.data ?? []) as Row[])
          .filter((n) => n["entity_type"] === "position")
          .map((n) => n["entity_id"]),
      ].filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  );

  const [candRes, posRes, decidedRes] = await Promise.all([
    profileIds.length
      ? a.from("candidate_profiles").select("id, full_name").in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    positionIds.length
      ? a.from("positions").select("id, title").in("id", positionIds)
      : Promise.resolve({ data: [], error: null }),
    openMatches.length
      ? a
          .from("client_decisions")
          .select("candidate_match_id")
          .in("candidate_match_id", openMatches.map((m) => String(m["id"])))
      : Promise.resolve({ data: [], error: null }),
  ]);
  check(candRes);
  check(posRes);
  check(decidedRes);

  const candidateName = new Map(
    ((candRes.data ?? []) as Row[]).map((c) => [String(c["id"]), String(c["full_name"] ?? "Unnamed candidate")]),
  );
  const positionTitle = new Map(
    ((posRes.data ?? []) as Row[]).map((p) => [String(p["id"]), String(p["title"] ?? "Untitled position")]),
  );
  const decided = new Set(
    ((decidedRes.data ?? []) as Row[]).map((d) => String(d["candidate_match_id"])),
  );

  const nameForMatch = (matchId: unknown): string => {
    const m = typeof matchId === "string" ? matchRows.get(matchId) : undefined;
    const pid = m?.["candidate_profile_id"];
    return (typeof pid === "string" ? candidateName.get(pid) : undefined) ?? "Candidate";
  };
  const titleForMatch = (matchId: unknown): string | null => {
    const m = typeof matchId === "string" ? matchRows.get(matchId) : undefined;
    const pid = m?.["position_id"];
    return (typeof pid === "string" ? positionTitle.get(pid) : undefined) ?? null;
  };

  const sections: ReadinessSection[] = [];

  sections.push({
    key: "submitted",
    title: "New candidates submitted",
    items: submitted.map<ReadinessItem>((m) => ({
      id: `submitted:${String(m["id"])}`,
      label: nameForMatch(m["id"]),
      detail: titleForMatch(m["id"]),
      at: String(m["delivered_at"]),
      link_kind: "candidate",
      link_id: String(m["id"]),
    })),
  });

  sections.push({
    key: "decisions",
    title: "Decisions received",
    items: ((decisionsRes.data ?? []) as Row[]).map<ReadinessItem>((d) => ({
      id: `decision:${String(d["id"])}`,
      label: `${nameForMatch(d["candidate_match_id"])} — ${stageLabel(d["decision"])}`,
      detail: typeof d["feedback"] === "string" && d["feedback"].trim() ? d["feedback"] : titleForMatch(d["candidate_match_id"]),
      at: String(d["created_at"]),
      link_kind: "candidate",
      link_id: String(d["candidate_match_id"]),
    })),
  });

  const interviewItems: ReadinessItem[] = [
    ...((ivCreatedRes.data ?? []) as Row[]).map<ReadinessItem>((i) => ({
      id: `interview-scheduled:${String(i["id"])}`,
      label: `${nameForMatch(i["candidate_match_id"])} — interview ${String(i["status"] ?? "requested")}`,
      detail: i["scheduled_at"]
        ? `${String(i["interview_type"] ?? "interview")} on ${formatDateTime(Date(String(i["scheduled_at"])))}`
        : String(i["interview_type"] ?? "interview"),
      at: String(i["created_at"]),
      link_kind: typeof i["candidate_match_id"] === "string" ? "candidate" : "position",
      link_id: String(i["candidate_match_id"] ?? i["position_id"]),
    })),
    ...((ivDoneRes.data ?? []) as Row[]).map<ReadinessItem>((i) => ({
      id: `interview-completed:${String(i["id"])}`,
      label: `${nameForMatch(i["candidate_match_id"])} — interview completed`,
      detail: String(i["interview_type"] ?? "interview"),
      at: String(i["completed_at"]),
      link_kind: typeof i["candidate_match_id"] === "string" ? "candidate" : "position",
      link_id: String(i["candidate_match_id"] ?? i["position_id"]),
    })),
  ].sort((x, y) => (x.at < y.at ? 1 : -1));

  sections.push({ key: "interviews", title: "Interviews scheduled or completed", items: interviewItems });

  sections.push({
    key: "stage_moves",
    title: "Stage moves",
    items: ((stageRes.data ?? []) as Row[]).map<ReadinessItem>((s) => ({
      id: `stage:${String(s["id"])}`,
      label: `${nameForMatch(s["candidate_match_id"])} — ${stageLabel(s["from_stage"] ?? "new")} → ${stageLabel(s["to_stage"])}`,
      detail: typeof s["reason"] === "string" && s["reason"].trim() ? s["reason"] : titleForMatch(s["candidate_match_id"]),
      at: String(s["created_at"]),
      link_kind: "candidate",
      link_id: String(s["candidate_match_id"]),
    })),
  });

  sections.push({
    key: "blockers",
    title: "Open blockers",
    items: openMatches
      .filter((m) => !decided.has(String(m["id"])))
      .map<ReadinessItem>((m) => {
        const days = Math.max(
          0,
          Math.floor((Date.now() - new Date(String(m["delivered_at"])).getTime()) / 86_400_000),
        );
        return {
          id: `blocker:${String(m["id"])}`,
          label: `${nameForMatch(m["id"])} — awaiting client decision`,
          detail: `${days} day${days === 1 ? "" : "s"} waiting${titleForMatch(m["id"]) ? ` · ${titleForMatch(m["id"])}` : ""}`,
          at: String(m["delivered_at"]),
          link_kind: "candidate",
          link_id: String(m["id"]),
        };
      }),
  });

  sections.push({
    key: "notes",
    title: "Shareable notes",
    items: ((notesRes.data ?? []) as Row[]).map<ReadinessItem>((n) => {
      const isMatch = n["entity_type"] === "candidate_match";
      return {
        id: `note:${String(n["id"])}`,
        label: isMatch
          ? `${nameForMatch(n["entity_id"])} — ${stageLabel(n["note_type"])}`
          : `${positionTitle.get(String(n["entity_id"])) ?? "Position"} — ${stageLabel(n["note_type"])}`,
        detail: String(n["body"] ?? "").slice(0, 400),
        at: String(n["created_at"]),
        link_kind: isMatch ? "candidate" : "position",
        link_id: String(n["entity_id"]),
      };
    }),
  });

  return {
    organization_id: organizationId,
    organization_name: String(org["name"] ?? "Client"),
    baseline_at: baselineAt,
    baseline_source: baselineSource,
    revert_event_id: revertEventId,
    revert_available_until: revertUntil,
    sections,
    total_items: sections.reduce((n, s) => n + s.items.length, 0),
    generated_at: new Date().toISOString(),
  };
}

/** Records a new baseline. Returns the created marker id. */
export async function markUpdateSent(
  admin: Admin,
  organizationId: string,
  actorUserId: string,
  previousBaselineAt: string | null,
): Promise<{ event_id: string; baseline_at: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = admin as unknown as { from: (t: string) => any };
  const res = await a
    .from("audit_events")
    .insert({
      entity_type: UPDATE_ENTITY,
      entity_id: organizationId,
      organization_id: organizationId,
      actor_user_id: actorUserId,
      action: UPDATE_SENT_ACTION,
      before_state: previousBaselineAt ? { baseline_at: previousBaselineAt } : null,
      after_state: { baseline_at: new Date().toISOString() },
    })
    .select("id, created_at")
    .single();
  check(res);
  const row = res.data as Row;
  return { event_id: String(row["id"]), baseline_at: String(row["created_at"]) };
}

/** Reverses an "update sent" marker inside the 24h window. */
export async function revertUpdateSent(
  admin: Admin,
  organizationId: string,
  actorUserId: string,
  eventId: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = admin as unknown as { from: (t: string) => any };
  const markerRes = await a
    .from("audit_events")
    .select("id, created_at, entity_id, action")
    .eq("id", eventId)
    .maybeSingle();
  check(markerRes);
  const marker = markerRes.data as Row | null;
  if (
    !marker ||
    String(marker["entity_id"]) !== organizationId ||
    String(marker["action"]) !== UPDATE_SENT_ACTION
  ) {
    throw new Error("Update marker not found for this client");
  }
  const ageMs = Date.now() - new Date(String(marker["created_at"])).getTime();
  if (ageMs > REVERT_WINDOW_MS) {
    throw new Error("This update can no longer be reversed (24 hour window has passed)");
  }
  const insertRes = await a.from("audit_events").insert({
    entity_type: UPDATE_ENTITY,
    entity_id: organizationId,
    organization_id: organizationId,
    actor_user_id: actorUserId,
    action: UPDATE_SENT_REVERTED_ACTION,
    before_state: { baseline_at: String(marker["created_at"]) },
    after_state: { event_id: eventId },
  });
  check(insertRes);
}
