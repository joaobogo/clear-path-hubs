import { CLOSE_FILLED_BLOCKED, guaranteeWindow, isLiveOffer, qualifiesAsHire, summarise, } from "./offer-hire";
import { loadTestScope } from "./admin-test-scope.server";
const HIRE_ENTITY = "hire_records";
const POSITION_ENTITY = "position";
const HIRE_COLS = "id, candidate_match_id, candidate_profile_id, organization_id, position_id, status, owner_user_id, start_date, guarantee_days, guarantee_starts_on, close_reason, close_reason_notes, sent_at, accepted_at, declined_at, hired_at, updated_at";
function check(res) {
    if (res.error)
        throw new Error(res.error.message);
}
async function hydrate(a, hires) {
    if (hires.length === 0)
        return [];
    const profileIds = uniq(hires.map((h) => h["candidate_profile_id"]));
    const positionIds = uniq(hires.map((h) => h["position_id"]));
    const orgIds = uniq(hires.map((h) => h["organization_id"]));
    const ownerIds = uniq(hires.map((h) => h["owner_user_id"]));
    const [candRes, posRes, orgRes, profRes] = await Promise.all([
        profileIds.length
            ? a.from("candidate_profiles").select("id, full_name").in("id", profileIds)
            : Promise.resolve({ data: [], error: null }),
        positionIds.length
            ? a.from("positions").select("id, title").in("id", positionIds)
            : Promise.resolve({ data: [], error: null }),
        orgIds.length
            ? a.from("organizations").select("id, name").in("id", orgIds)
            : Promise.resolve({ data: [], error: null }),
        ownerIds.length
            ? a
                .from("profiles")
                .select("auth_user_id, full_name, email")
                .in("auth_user_id", ownerIds)
            : Promise.resolve({ data: [], error: null }),
    ]);
    check(candRes);
    check(posRes);
    check(orgRes);
    check(profRes);
    const names = map(candRes["data"], "id", (r) => String(r["full_name"] ?? "Candidate"));
    const titles = map(posRes["data"], "id", (r) => String(r["title"] ?? "Untitled position"));
    const orgs = map(orgRes["data"], "id", (r) => String(r["name"] ?? "Client"));
    const owners = map(profRes["data"], "auth_user_id", (r) => String(r["full_name"] || r["email"] || "Unassigned"));
    return hires.map((h) => {
        const guarantee = guaranteeWindow({
            start_date: h["start_date"] ?? null,
            guarantee_starts_on: h["guarantee_starts_on"] ?? null,
            guarantee_days: h["guarantee_days"] ?? null,
        });
        return {
            hire_id: String(h["id"]),
            candidate_match_id: String(h["candidate_match_id"]),
            candidate_profile_id: String(h["candidate_profile_id"]),
            candidate_name: names.get(String(h["candidate_profile_id"])) ?? "Candidate",
            organization_id: String(h["organization_id"]),
            organization_name: orgs.get(String(h["organization_id"])) ?? "Client",
            position_id: String(h["position_id"]),
            position_title: titles.get(String(h["position_id"])) ?? "Untitled position",
            status: h["status"],
            owner_name: h["owner_user_id"] ? (owners.get(String(h["owner_user_id"])) ?? null) : null,
            start_date: h["start_date"] ? String(h["start_date"]).slice(0, 10) : null,
            guarantee,
            close_reason: (h["close_reason"] ?? null),
            close_reason_notes: h["close_reason_notes"] ?? null,
            sent_at: h["sent_at"] ?? null,
            accepted_at: h["accepted_at"] ?? null,
            declined_at: h["declined_at"] ?? null,
            hired_at: h["hired_at"] ?? null,
            updated_at: String(h["updated_at"]),
        };
    });
}
function uniq(values) {
    return Array.from(new Set(values.filter((v) => typeof v === "string" && v.length > 0)));
}
function map(rows, key, toValue) {
    return new Map((rows ?? []).map((r) => [String(r[key]), toValue(r)]));
}
/** Offers for a single position, plus the close-as-filled gate state. */
export async function loadPositionOfferTracking(admin, positionId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = admin;
    const [posRes, hireRes] = await Promise.all([
        a.from("positions").select("id, title, status").eq("id", positionId).maybeSingle(),
        a
            .from("hire_records")
            .select(HIRE_COLS)
            .eq("position_id", positionId)
            .order("updated_at", { ascending: false })
            .limit(200),
    ]);
    check(posRes);
    check(hireRes);
    const pos = (posRes.data ?? null);
    if (!pos)
        throw new Error("Position not found");
    const offers = await hydrate(a, (hireRes.data ?? []));
    const totals = summarise(offers);
    const canClose = totals.hires_confirmed > 0;
    return {
        position_id: String(pos["id"]),
        position_title: String(pos["title"] ?? "Untitled position"),
        position_status: String(pos["status"] ?? "draft"),
        offers,
        totals,
        can_close_filled: canClose,
        close_blocked_reason: canClose ? null : CLOSE_FILLED_BLOCKED,
        generated_at: new Date().toISOString(),
    };
}
/** Portfolio-wide offer + hire rollup for /admin. */
export async function loadOfferHireRollup(admin, opts = {}) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = admin;
    const scope = await loadTestScope(admin, opts.includeTest ?? false);
    let hireQ = a
        .from("hire_records")
        .select(HIRE_COLS)
        .order("updated_at", { ascending: false })
        .limit(1000);
    if (scope.orgIds.length > 0)
        hireQ = hireQ.not("organization_id", "in", `(${scope.orgIds.join(",")})`);
    let closedQ = a
        .from("positions")
        .select("id, title, organization_id, status, closed_at")
        .eq("status", "filled")
        .order("closed_at", { ascending: false, nullsFirst: false })
        .limit(200);
    if (scope.orgIds.length > 0)
        closedQ = closedQ.not("organization_id", "in", `(${scope.orgIds.join(",")})`);
    const [hireRes, closedRes] = await Promise.all([hireQ, closedQ]);
    check(hireRes);
    check(closedRes);
    const offers = await hydrate(a, (hireRes.data ?? []));
    const totals = summarise(offers);
    const confirmedPositions = new Set(offers.filter((o) => qualifiesAsHire(o.status)).map((o) => o.position_id));
    const closedRows = (closedRes.data ?? []);
    const orgNames = closedRows.length
        ? await (async () => {
            const res = await a
                .from("organizations")
                .select("id, name")
                .in("id", uniq(closedRows.map((p) => p["organization_id"])));
            check(res);
            return map(res.data, "id", (r) => String(r["name"] ?? "Client"));
        })()
        : new Map();
    const missing_hire_records = closedRows
        .filter((p) => !confirmedPositions.has(String(p["id"])))
        .map((p) => ({
        position_id: String(p["id"]),
        position_title: String(p["title"] ?? "Untitled position"),
        organization_id: String(p["organization_id"]),
        organization_name: orgNames.get(String(p["organization_id"])) ?? "Client",
        status: String(p["status"]),
        closed_at: p["closed_at"] ?? null,
    }));
    const upcoming_starts = offers
        .filter((o) => o.start_date != null &&
        (o.status === "offer_accepted" || o.status === "hire_confirmed") &&
        o.guarantee?.state === "not_started")
        .sort((x, y) => (x.start_date < y.start_date ? -1 : 1))
        .slice(0, 25);
    const guarantees_active = offers
        .filter((o) => o.guarantee?.state === "active" && qualifiesAsHire(o.status))
        .sort((x, y) => (x.guarantee.ends_on < y.guarantee.ends_on ? -1 : 1))
        .slice(0, 25);
    return {
        totals,
        missing_hire_records,
        upcoming_starts,
        guarantees_active,
        generated_at: new Date().toISOString(),
    };
}
async function loadHire(a, hireId) {
    const res = await a.from("hire_records")
        .select(HIRE_COLS)
        .eq("id", hireId)
        .maybeSingle();
    check(res);
    const hire = res["data"];
    if (!hire)
        throw new Error("Offer not found");
    return hire;
}
/** Maps a hire outcome to the candidate stage it implies. */
function stageForOutcome(outcome) {
    if (outcome === "hire_confirmed" || outcome === "offer_accepted")
        return "hired";
    // A declined offer or a closed-lost outcome (e.g. "Closed lost — Candidate declined")
    // moves the candidate out of the active pipeline. Sticking at "hired" is a bug.
    if (outcome === "offer_declined" || outcome === "closed_lost")
        return "not_moving_forward";
    // Transition back to offer if we were negotiating/sent and somehow moved stage.
    if (outcome === "offer_sent" || outcome === "offer_negotiating")
        return "offer";
    return null;
}
/** Records an offer outcome. Declines and losses require a reason. */
export async function recordOfferOutcome(admin, args) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = admin;
    const hire = await loadHire(a, args.hireId);
    if ((args.outcome === "offer_declined" || args.outcome === "closed_lost") &&
        !args.closeReason) {
        throw new Error("A reason is required to record a declined or lost offer");
    }
    const patch = { status: args.outcome };
    if (args.outcome === "hire_confirmed") {
        patch["hired_at"] = new Date().toISOString();
    }
    if (args.closeReason)
        patch["close_reason"] = args.closeReason;
    if (args.notes !== undefined)
        patch["close_reason_notes"] = args.notes || null;
    const upd = await a.from("hire_records").update(patch).eq("id", args.hireId);
    check(upd);
    // Keep the candidate's pipeline stage in lock-step with the hire outcome so
    // dashboard, role, and portfolio counts always agree on whether the candidate
    // is still an active hire.
    const nextStage = stageForOutcome(args.outcome);
    if (nextStage && hire["candidate_match_id"]) {
        await a
            .from("candidate_matches")
            .update({ stage: nextStage })
            .eq("id", hire["candidate_match_id"]);
    }
    const audit = await a.from("audit_events").insert({
        entity_type: HIRE_ENTITY,
        entity_id: args.hireId,
        organization_id: hire["organization_id"],
        actor_user_id: args.actorUserId,
        action: `hire.${args.outcome}`,
        before_state: { status: hire["status"], stage: hire["candidate_match_id"] ? null : undefined },
        after_state: { ...patch, stage: nextStage },
    });
    check(audit);
    return { ok: true };
}
/** Sets the confirmed start date. The guarantee window is derived from it. */
export async function setHireStartDate(admin, args) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = admin;
    const hire = await loadHire(a, args.hireId);
    if (!isLiveOffer(String(hire["status"])) && !qualifiesAsHire(String(hire["status"]))) {
        throw new Error("Start dates can only be set on live or confirmed offers");
    }
    // A start date must be a real date and cannot precede acceptance.
    const { validateStartDate } = await import("./hire-handoff");
    const invalid = validateStartDate(args.startDate, hire["accepted_at"] ?? null);
    if (invalid)
        throw new Error(invalid);
    const patch = {
        start_date: args.startDate,
        // The guarantee always starts on the recorded start date.
        guarantee_starts_on: args.startDate,
    };
    if (typeof args.guaranteeDays === "number")
        patch["guarantee_days"] = args.guaranteeDays;
    const upd = await a.from("hire_records").update(patch).eq("id", args.hireId);
    check(upd);
    const audit = await a.from("audit_events").insert({
        entity_type: HIRE_ENTITY,
        entity_id: args.hireId,
        organization_id: hire["organization_id"],
        actor_user_id: args.actorUserId,
        action: "hire.start_date_set",
        before_state: {
            start_date: hire["start_date"] ?? null,
            guarantee_starts_on: hire["guarantee_starts_on"] ?? null,
        },
        after_state: patch,
    });
    check(audit);
    return { ok: true };
}
/** True when at least one confirmed hire exists on the position. */
export async function positionHasConfirmedHire(admin, positionId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = admin;
    const res = await a
        .from("hire_records")
        .select("id", { count: "exact", head: true })
        .eq("position_id", positionId)
        .eq("status", "hire_confirmed");
    check(res);
    return Number(res.count ?? 0) > 0;
}
/**
 * Closes a position with an outcome reason.
 * Closing as `filled` is blocked without a confirmed hire record.
 */
export async function closePositionWithOutcome(admin, args) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = admin;
    const posRes = await a
        .from("positions")
        .select("id, organization_id, status")
        .eq("id", args.positionId)
        .maybeSingle();
    check(posRes);
    const pos = (posRes.data ?? null);
    if (!pos)
        throw new Error("Position not found");
    if (args.outcome === "filled" && !(await positionHasConfirmedHire(admin, args.positionId))) {
        throw new Error(CLOSE_FILLED_BLOCKED);
    }
    const closedAt = new Date().toISOString();
    const upd = await a
        .from("positions")
        .update({ status: args.outcome, closed_at: closedAt })
        .eq("id", args.positionId);
    check(upd);
    const audit = await a.from("audit_events").insert({
        entity_type: POSITION_ENTITY,
        entity_id: args.positionId,
        organization_id: pos["organization_id"],
        actor_user_id: args.actorUserId,
        action: args.outcome === "filled" ? "position.mark_filled" : "position.close",
        before_state: { status: pos["status"] },
        after_state: { status: args.outcome, closed_at: closedAt, reason: args.reason },
    });
    check(audit);
    return { ok: true };
}
