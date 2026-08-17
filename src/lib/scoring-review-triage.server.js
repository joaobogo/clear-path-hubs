const HOUR = 3600000;
const DAY = 86400000;
/** A claim older than this is ignored and can be bulk-released. */
export const CLAIM_STALE_MS = 2 * HOUR;
/** A commitment due inside this window makes the review blocking. */
export const BLOCKING_WINDOW_MS = 3 * DAY;
function bandOf(row) {
    const band = row["fit_band"] ?? row["fit_label"];
    return typeof band === "string" && band.length > 0 ? band : null;
}
export async function loadReviewTriage(admin, args) {
    const nowMs = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = admin;
    // Active (non-stale) claims decide visibility, so they are read first.
    const { data: claimRows, error: claimErr } = await a
        .from("scoring_review_claims")
        .select("candidate_match_id, reviewer_user_id, claimed_at");
    if (claimErr)
        throw new Error(claimErr.message);
    const claims = (claimRows ?? []);
    const staleClaims = claims.filter((c) => nowMs - new Date(c.claimed_at).getTime() > CLAIM_STALE_MS);
    const activeClaims = new Map(claims
        .filter((c) => nowMs - new Date(c.claimed_at).getTime() <= CLAIM_STALE_MS)
        .map((c) => [c.candidate_match_id, c]));
    const hiddenIds = new Set([...activeClaims.values()]
        .filter((c) => c.reviewer_user_id !== args.viewerUserId)
        .map((c) => c.candidate_match_id));
    let query = a.from("v_scoring_review_queue").select("*", { count: "exact" });
    if (args.queueColumn)
        query = query.eq(args.queueColumn, true);
    if (args.q) {
        const { sanitizeSearchTerm } = await import("./search/postgrest-filter");
        const needle = sanitizeSearchTerm(args.q).toLowerCase();
        if (needle)
            query = query.ilike("search_text", `%${needle}%`);
    }
    if (hiddenIds.size > 0) {
        query = query.not("match_id", "in", `(${[...hiddenIds].join(",")})`);
    }
    const { data, count, error } = await query
        .order(args.sort.col, { ascending: args.sort.asc, nullsFirst: args.sort.asc })
        .order("match_id", { ascending: true })
        .range(args.offset, args.offset + args.limit - 1);
    if (error)
        throw new Error(error.message);
    const view = (data ?? []);
    const positionIds = Array.from(new Set(view
        .map((r) => r["position_id"])
        .filter((v) => typeof v === "string" && v.length > 0)));
    // Commitments + delivered counts per position → open / blocking.
    const commitmentByPosition = new Map();
    if (positionIds.length > 0) {
        const [commitRes, deliveredRes] = await Promise.all([
            a
                .from("position_commitments")
                .select("position_id, first_shortlist_days, shortlist_size, baseline_at")
                .in("position_id", positionIds),
            a
                .from("candidate_matches")
                .select("position_id")
                .in("position_id", positionIds)
                .eq("client_visibility", "visible")
                .not("delivered_at", "is", null),
        ]);
        for (const r of [commitRes, deliveredRes]) {
            const err = r.error;
            if (err)
                throw new Error(err.message);
        }
        const deliveredCount = new Map();
        for (const d of (deliveredRes.data ?? [])) {
            const pid = String(d["position_id"]);
            deliveredCount.set(pid, (deliveredCount.get(pid) ?? 0) + 1);
        }
        for (const c of (commitRes.data ?? [])) {
            const pid = String(c["position_id"]);
            const baseline = c["baseline_at"];
            const days = c["first_shortlist_days"];
            const dueAt = typeof baseline === "string" && typeof days === "number"
                ? new Date(new Date(baseline).getTime() + days * DAY).toISOString()
                : null;
            const promised = typeof c["shortlist_size"] === "number" ? c["shortlist_size"] : 1;
            const open = (deliveredCount.get(pid) ?? 0) < Math.max(1, promised);
            const prev = commitmentByPosition.get(pid);
            // Keep the tightest due date if a position carries several commitments.
            if (!prev || (dueAt && (!prev.due_at || dueAt < prev.due_at))) {
                commitmentByPosition.set(pid, { due_at: dueAt, open });
            }
        }
    }
    // Reviewer names for the claims we are about to surface.
    const claimUserIds = Array.from(new Set(view
        .map((r) => activeClaims.get(String(r["match_id"]))?.reviewer_user_id)
        .filter((v) => typeof v === "string")));
    const nameById = new Map();
    if (claimUserIds.length > 0) {
        const { data: profiles, error: profErr } = await a
            .from("profiles")
            .select("auth_user_id, full_name, email")
            .in("auth_user_id", claimUserIds);
        if (profErr)
            throw new Error(profErr.message);
        for (const p of (profiles ?? [])) {
            nameById.set(String(p["auth_user_id"]), String(p["full_name"] ?? p["email"] ?? "Reviewer"));
        }
    }
    const rows = view.map((r) => {
        const matchId = String(r["match_id"]);
        const positionId = typeof r["position_id"] === "string" ? r["position_id"] : null;
        const commitment = positionId ? (commitmentByPosition.get(positionId) ?? null) : null;
        const dueMs = commitment?.due_at ? new Date(commitment.due_at).getTime() : null;
        const blocking = Boolean(commitment?.open && dueMs !== null && dueMs - nowMs <= BLOCKING_WINDOW_MS);
        const items = Number(r["evidence_item_count"] ?? 0);
        const unresolved = Number(r["unresolved_item_count"] ?? 0);
        const scoredAt = typeof r["scored_at"] === "string" ? r["scored_at"] : null;
        const claim = activeClaims.get(matchId) ?? null;
        return {
            match_id: matchId,
            organization_id: typeof r["organization_id"] === "string" ? r["organization_id"] : null,
            position_id: positionId,
            candidate_name: String(r["full_name"] ?? "Unnamed candidate"),
            position_title: String(r["position_title"] ?? "—"),
            client_name: String(r["org_name"] ?? "—"),
            score_band: bandOf(r),
            final_score: r["final_score"] != null
                ? Number(r["final_score"])
                : r["score"] != null
                    ? Number(r["score"])
                    : null,
            evidence_items: items,
            evidence_resolved: Math.max(0, items - unresolved),
            evidence_completeness: items > 0 ? Math.max(0, items - unresolved) / items : null,
            hours_since_scored: scoredAt === null
                ? null
                : Math.max(0, Math.floor((nowMs - new Date(scoredAt).getTime()) / HOUR)),
            blocking,
            commitment_due_at: commitment?.due_at ?? null,
            commitment_days_left: dueMs === null ? null : Math.ceil((dueMs - nowMs) / DAY),
            claim: claim
                ? {
                    reviewer_user_id: claim.reviewer_user_id,
                    reviewer_name: nameById.get(claim.reviewer_user_id) ?? "Reviewer",
                    claimed_at: claim.claimed_at,
                    is_mine: claim.reviewer_user_id === args.viewerUserId,
                }
                : null,
        };
    });
    // Blocking first, then longest waiting inside each group.
    rows.sort((x, y) => {
        if (x.blocking !== y.blocking)
            return x.blocking ? -1 : 1;
        return (y.hours_since_scored ?? -1) - (x.hours_since_scored ?? -1);
    });
    return {
        rows,
        total: count ?? rows.length,
        limit: args.limit,
        offset: args.offset,
        blocking_count: rows.filter((r) => r.blocking).length,
        standard_count: rows.filter((r) => !r.blocking).length,
        hidden_claimed_count: hiddenIds.size,
        stale_claim_count: staleClaims.length,
        generated_at: new Date().toISOString(),
    };
}
/** Claims a review for this reviewer. Fails when someone else holds a fresh claim. */
export async function claimReview(admin, args) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = admin;
    const { data: existing, error } = await a
        .from("scoring_review_claims")
        .select("candidate_match_id, reviewer_user_id, claimed_at")
        .eq("candidate_match_id", args.matchId)
        .maybeSingle();
    if (error)
        throw new Error(error.message);
    if (existing) {
        const fresh = Date.now() - new Date(existing.claimed_at).getTime() <= CLAIM_STALE_MS;
        if (fresh && existing.reviewer_user_id !== args.reviewerUserId) {
            throw new Error("Another reviewer is already working on this review.");
        }
    }
    const { error: upErr } = await a.from("scoring_review_claims").upsert({
        candidate_match_id: args.matchId,
        reviewer_user_id: args.reviewerUserId,
        claimed_at: new Date().toISOString(),
    }, { onConflict: "candidate_match_id" });
    if (upErr)
        throw new Error(upErr.message);
    return { ok: true };
}
export async function releaseReview(admin, args) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = admin;
    const { error } = await a
        .from("scoring_review_claims")
        .delete()
        .eq("candidate_match_id", args.matchId);
    if (error)
        throw new Error(error.message);
    return { ok: true };
}
/** Bulk-releases every claim older than the stale window. */
export async function releaseStaleClaims(admin) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = admin;
    const cutoff = new Date(Date.now() - CLAIM_STALE_MS).toISOString();
    const { data, error } = await a
        .from("scoring_review_claims")
        .delete()
        .lt("claimed_at", cutoff)
        .select("candidate_match_id");
    if (error)
        throw new Error(error.message);
    return { released: (data ?? []).length };
}
