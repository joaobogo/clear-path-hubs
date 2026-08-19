import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";
const DAY = 86400000;
export const NUDGE_ACTION = "client_decision.nudge_sent";
export const OFFLINE_DECISION_ACTION = "client_decision.recorded_offline";
export const DECISION_ENTITY = "candidate_match";
/** Rate limit: one nudge per candidate per 48 hours. */
export const NUDGE_COOLDOWN_MS = 48 * 3600000;
function dayCount(fromMs, nowMs) {
    return Math.max(0, Math.floor((nowMs - fromMs) / DAY));
}
export async function loadDecisionBacklog(admin, opts = {}) {
    const nowMs = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = admin;
    let matchQuery = a
        .from("candidate_matches")
        .select("id, organization_id, position_id, candidate_profile_id, stage, delivered_at, is_test_record")
        .eq("client_visibility", "visible")
        .not("delivered_at", "is", null)
        .order("delivered_at", { ascending: true })
        .limit(500);
    if (opts.organizationId)
        matchQuery = matchQuery.eq("organization_id", opts.organizationId);
    const matchRes = await matchQuery;
    if (matchRes.error)
        throw new Error(matchRes.error.message);
    const allMatches = (matchRes.data ?? []);
    const matches = allMatches.filter((m) => opts.includeTest || m["is_test_record"] !== true);
    if (matches.length === 0) {
        return { rows: [], generated_at: new Date().toISOString() };
    }
    const matchIds = matches.map((m) => String(m["id"]));
    const positionIds = Array.from(new Set(matches.map((m) => String(m["position_id"]))));
    const orgIds = Array.from(new Set(matches.map((m) => String(m["organization_id"]))));
    const profileIds = Array.from(new Set(matches
        .map((m) => m["candidate_profile_id"])
        .filter((v) => typeof v === "string" && v.length > 0)));
    const [decRes, posRes, orgRes, candRes, notifRes, nudgeRes] = await Promise.all([
        a.from("client_decisions").select("candidate_match_id").in("candidate_match_id", matchIds),
        a.from("positions").select("id, title, is_test_record, organization_id").in("id", positionIds),
        a.from("organizations").select("id, name, is_test_record").in("id", orgIds),
        profileIds.length
            ? a.from("candidate_profiles").select("id, full_name").in("id", profileIds)
            : Promise.resolve({ data: [], error: null }),
        a
            .from("notifications")
            .select("recipient_user_id, audience, created_at, event_id, notification_events!inner(candidate_match_id)")
            .eq("audience", "client")
            .in("notification_events.candidate_match_id", matchIds),
        a
            .from("audit_events")
            .select("entity_id, actor_user_id, created_at")
            .eq("entity_type", DECISION_ENTITY)
            .eq("action", NUDGE_ACTION)
            .in("entity_id", matchIds)
            .order("created_at", { ascending: false }),
    ]);
    for (const r of [decRes, posRes, orgRes, candRes, notifRes, nudgeRes]) {
        const err = r.error;
        if (err)
            throw new Error(err.message);
    }
    const decided = new Set((decRes.data ?? []).map((d) => String(d["candidate_match_id"])));
    const positions = new Map((posRes.data ?? []).map((p) => [String(p["id"]), p]));
    const orgs = new Map((orgRes.data ?? []).map((o) => [String(o["id"]), o]));
    const candidateName = new Map((candRes.data ?? []).map((c) => [
        String(c["id"]),
        String(c["full_name"] ?? "Unnamed candidate"),
    ]));
    // Notified client users per match.
    const notifRows = (notifRes.data ?? []);
    const nudgeRows = (nudgeRes.data ?? []);
    const staffIds = Array.from(new Set(nudgeRows
        .map((r) => r["actor_user_id"])
        .filter((v) => typeof v === "string" && v.length > 0)));
    const recipientIds = Array.from(new Set(notifRows
        .map((r) => r["recipient_user_id"])
        .filter((v) => typeof v === "string" && v.length > 0)));
    const peopleIds = Array.from(new Set([...staffIds, ...recipientIds]));
    const profRes = peopleIds.length
        ? await a
            .from("profiles")
            .select("auth_user_id, full_name, email")
            .in("auth_user_id", peopleIds)
        : { data: [], error: null };
    if (profRes.error) {
        throw new Error(profRes.error.message);
    }
    const personName = new Map((profRes.data ?? []).map((p) => [p.auth_user_id, p.full_name || p.email || "Unknown user"]));
    const notifiedByMatch = new Map();
    for (const n of notifRows) {
        const event = n["notification_events"];
        const matchId = event ? event["candidate_match_id"] : null;
        if (typeof matchId !== "string")
            continue;
        const uid = n["recipient_user_id"];
        const list = notifiedByMatch.get(matchId) ?? [];
        const name = typeof uid === "string" ? (personName.get(uid) ?? "Client user") : "Client user";
        if (!list.some((x) => x.name === name)) {
            list.push({ name, notified_at: String(n["created_at"]) });
        }
        notifiedByMatch.set(matchId, list);
    }
    const nudgeByMatch = new Map();
    for (const r of nudgeRows) {
        const id = String(r["entity_id"]);
        if (nudgeByMatch.has(id))
            continue; // ordered desc — latest wins
        const actor = r["actor_user_id"];
        nudgeByMatch.set(id, {
            at: String(r["created_at"]),
            by: typeof actor === "string" ? (personName.get(actor) ?? "Unknown staff") : null,
        });
    }
    const rows = [];
    for (const m of matches) {
        const matchId = String(m["id"]);
        if (decided.has(matchId))
            continue;
        const position = positions.get(String(m["position_id"]));
        const org = orgs.get(String(m["organization_id"]));
        const isTest = m["is_test_record"] === true ||
            position?.["is_test_record"] === true ||
            org?.["is_test_record"] === true;
        if (isTest && !opts.includeTest)
            continue;
        const submittedAt = String(m["delivered_at"]);
        const nudge = nudgeByMatch.get(matchId) ?? null;
        const nudgeMs = nudge ? new Date(nudge.at).getTime() : null;
        const nextAllowedMs = nudgeMs === null ? null : nudgeMs + NUDGE_COOLDOWN_MS;
        const profileId = m["candidate_profile_id"];
        rows.push({
            match_id: matchId,
            organization_id: String(m["organization_id"]),
            client_name: String(org?.["name"] ?? "Unknown client"),
            position_id: String(m["position_id"]),
            position_title: String(position?.["title"] ?? "Untitled position"),
            candidate_name: typeof profileId === "string"
                ? (candidateName.get(profileId) ?? "Unnamed candidate")
                : "Unnamed candidate",
            stage: String(m["stage"] ?? "delivered"),
            submitted_at: submittedAt,
            days_waiting: dayCount(new Date(submittedAt).getTime(), nowMs),
            notified: notifiedByMatch.get(matchId) ?? [],
            last_nudge_at: nudge?.at ?? null,
            last_nudge_by: nudge?.by ?? null,
            nudge_allowed: nextAllowedMs === null ? true : nowMs >= nextAllowedMs,
            nudge_available_at: nextAllowedMs === null ? null : new Date(nextAllowedMs).toISOString(),
            is_test_record: isTest,
        });
    }
    rows.sort((x, y) => y.days_waiting - x.days_waiting || x.client_name.localeCompare(y.client_name));
    return { rows, generated_at: new Date().toISOString() };
}
async function loadMatchForAction(
// eslint-disable-next-line @typescript-eslint/no-explicit-any
a, matchId) {
    const { data, error } = await a
        .from("candidate_matches")
        .select("id, organization_id, position_id, candidate_profile_id, application_id, stage")
        .eq("id", matchId)
        .maybeSingle();
    if (error)
        throw new Error(error.message);
    if (!data)
        throw new Error("Candidate not found");
    return data;
}
/**
 * Sends a follow-up through the existing notification path. Rate limited
 * server-side to one nudge per candidate per 48 hours.
 */
export async function sendDecisionNudge(admin, args) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = admin;
    const match = await loadMatchForAction(a, args.matchId);
    const { data: recent, error: recentErr } = await a
        .from("audit_events")
        .select("created_at")
        .eq("entity_type", DECISION_ENTITY)
        .eq("entity_id", args.matchId)
        .eq("action", NUDGE_ACTION)
        .order("created_at", { ascending: false })
        .limit(1);
    if (recentErr)
        throw new Error(recentErr.message);
    const lastAt = (recent ?? [])[0]?.created_at;
    if (lastAt) {
        const nextMs = new Date(lastAt).getTime() + NUDGE_COOLDOWN_MS;
        if (Date.now() < nextMs) {
            throw new Error(`A follow-up was already sent for this candidate. The next one can go out after ${new Date(nextMs).toLocaleString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE })}.`);
        }
    }
    const sentAt = new Date().toISOString();
    const { emitEventFromServer } = await import("./notifications.functions");
    await emitEventFromServer({
        event: "approval_needed",
        scope: `decision_nudge:${args.matchId}:${sentAt}`,
        organization_id: String(match["organization_id"]),
        position_id: String(match["position_id"]),
        candidate_match_id: args.matchId,
        candidate_profile_id: match["candidate_profile_id"] ?? null,
        actor_user_id: args.actorUserId,
        link_path: `/client/candidates/${args.matchId}`,
        payload: { reason: "decision_backlog_nudge", note: args.note?.trim() || null },
    });
    const { error: insErr } = await a.from("audit_events").insert({
        actor_user_id: args.actorUserId,
        organization_id: match["organization_id"],
        entity_type: DECISION_ENTITY,
        entity_id: args.matchId,
        action: NUDGE_ACTION,
        after_state: { note: args.note?.trim() || null, sent_at: sentAt },
    });
    if (insErr)
        throw new Error(insErr.message);
    return { ok: true, sent_at: sentAt };
}
/**
 * Records a decision the client gave outside the product (call, email).
 * Always attributed to the staff member, never presented as client-authored.
 */
export async function recordOfflineDecision(admin, args) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = admin;
    const match = await loadMatchForAction(a, args.matchId);
    const { error } = await a.from("client_decisions").insert({
        candidate_match_id: args.matchId,
        organization_id: match["organization_id"],
        decision: args.decision,
        feedback: args.note,
        from_stage: match["stage"] ?? null,
        actor_user_id: args.actorUserId,
        details: {
            recorded_by_staff: true,
            source: "offline",
            received_from: args.receivedFrom,
            recorded_at: new Date().toISOString(),
        },
    });
    if (error)
        throw new Error(error.message);
    const sentAt = new Date().toISOString();
    const { emitEventFromServer } = await import("./notifications.functions");
    await emitEventFromServer({
        event: "client_feedback_submitted",
        scope: `offline_decision:${args.matchId}:${sentAt}`,
        organization_id: String(match["organization_id"]),
        position_id: String(match["position_id"]),
        candidate_match_id: args.matchId,
        candidate_profile_id: match["candidate_profile_id"] ?? null,
        actor_user_id: args.actorUserId,
        payload: {
            decision: args.decision,
            feedback: args.note,
            received_from: args.receivedFrom,
            recorded_by_staff: true
        },
    });
    const { error: insErr } = await a.from("audit_events").insert({
        actor_user_id: args.actorUserId,
        organization_id: match["organization_id"],
        entity_type: DECISION_ENTITY,
        entity_id: args.matchId,
        action: OFFLINE_DECISION_ACTION,
        after_state: {
            decision: args.decision,
            note: args.note,
            received_from: args.receivedFrom,
            recorded_by_staff: true,
        },
    });
    if (insErr)
        throw new Error(insErr.message);
    return { ok: true };
}
