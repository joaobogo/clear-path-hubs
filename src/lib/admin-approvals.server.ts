/**
 * Approvals inbox — data layer.
 *
 * Every group is derived from real row state, so an item leaves the inbox only
 * because the underlying record changed. Approving runs the same canonical paths
 * used in-place elsewhere:
 *   • candidate visibility / shortlist share → publish gate + evidence gate +
 *     `approve_candidate_match` RPC (single transaction, idempotent)
 *   • contact release → `candidate_matches.contact_released_at` (requires the
 *     candidate to already be client-visible)
 *   • publish position → `positions.status = active` + `published_at`
 *
 * Every decision, approve or decline, writes an audit_events row with actor,
 * target and (for declines) the required reason.
 */
import {
  ageDays,
  groupApprovals,
  type ApprovalItem,
  type ApprovalsPayload,
} from "./admin-approvals";
import { loadTestScope } from "./admin-test-scope.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = { from: (t: string) => any; rpc: (n: string, a?: unknown) => any };

const PENDING_POSITION_STATUSES = ["submitted", "under_review", "approved"];

function personName(row: Any | undefined): string | null {
  if (!row) return null;
  return (row.full_name as string) || (row.email as string) || null;
}

async function resolvePeople(admin: Admin, ids: (string | null)[]) {
  const unique = [...new Set(ids.filter(Boolean) as string[])];
  const map = new Map<string, { name: string; isStaff: boolean }>();
  if (unique.length === 0) return map;

  const [profilesRes, staffRes] = await Promise.all([
    admin.from("profiles").select("auth_user_id, full_name, email").in("auth_user_id", unique),
    admin.rpc("is_platform_staff_bulk", { _users: unique }),
  ]);

  const staffIds = new Set((staffRes.data ?? []) as string[]);

  for (const r of (profilesRes.data ?? []) as Any[]) {
    const name = personName(r);
    if (name) {
      map.set(r.auth_user_id as string, {
        name,
        isStaff: staffIds.has(r.auth_user_id as string),
      });
    }
  }
  return map;
}

/** Latest audit actor per entity — used as the requester when there is no explicit one. */
async function resolveLastActors(admin: Admin, entityType: string, ids: string[]) {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const res = await admin
    .from("audit_events")
    .select("entity_id, actor_user_id, created_at")
    .eq("entity_type", entityType)
    .in("entity_id", ids)
    .order("created_at", { ascending: false })
    .limit(2000);
  for (const r of (res.data ?? []) as Any[]) {
    const id = r.entity_id as string;
    if (!map.has(id) && r.actor_user_id) map.set(id, r.actor_user_id as string);
  }
  return map;
}

const MATCH_SELECT = [
  "id, organization_id, position_id, application_id, candidate_profile_id",
  "admin_status, client_visibility, processing_state, updated_at, created_at",
  "contact_released_at, current_score_run_id, approved_score_run_id",
  "candidate_profiles(id, full_name, email)",
  "positions(id, title, status, organizations(id, name))",
].join(",");

function matchBlockers(m: Any): string[] {
  const out: string[] = [];
  if (!m.approved_score_run_id && !m.current_score_run_id) out.push("No score run yet");
  if (["failed", "provider_blocked", "ocr_required"].includes(String(m.processing_state)))
    out.push(`Processing ${String(m.processing_state).replace(/_/g, " ")}`);
  const pos = (m.positions ?? null) as Any | null;
  if (!pos?.title) out.push("Position missing");
  else if (pos.status === "archived") out.push("Position archived");
  if (!(m.candidate_profiles as Any)?.full_name) out.push("Candidate name missing");
  return out;
}

function matchLabel(m: Any): string {
  return ((m.candidate_profiles as Any)?.full_name as string) || "Unnamed candidate";
}

export async function loadApprovals(
  admin: Admin,
  opts: { includeTest?: boolean } = {},
): Promise<ApprovalsPayload> {
  const scope = await loadTestScope(admin, opts.includeTest ?? false);
  const now = Date.now();
  const items: ApprovalItem[] = [];

  const excludeOrgs = <T,>(q: T): T => {
    if (scope.orgIds.length === 0) return q;
    return (q as Any).not("organization_id", "in", `(${scope.orgIds.join(",")})`) as T;
  };

  // ── 1. Candidate visible to client ────────────────────────────────────────
  const visRes = await excludeOrgs(
    admin
      .from("candidate_matches")
      .select(MATCH_SELECT)
      .eq("admin_status", "approved")
      .eq("client_visibility", "hidden")
      .order("updated_at", { ascending: true })
      .limit(300),
  );
  if (visRes.error) throw new Error(visRes.error.message);
  const visRows = (visRes.data ?? []) as Any[];

  // ── 2. Contact release requests ───────────────────────────────────────────
  const reqRes = await excludeOrgs(
    admin
      .from("client_decisions")
      .select("id, candidate_match_id, organization_id, actor_user_id, feedback, created_at")
      .eq("decision", "request_contact_release")
      .is("reversed_at", null)
      .order("created_at", { ascending: true })
      .limit(300),
  );
  if (reqRes.error) throw new Error(reqRes.error.message);
  const reqRows = (reqRes.data ?? []) as Any[];

  // ── 3. Active shortlist shares ────────────────────────────────────────────
  const shareRes = await excludeOrgs(
    admin
      .from("shortlist_shares")
      .select("id, title, organization_id, position_id, match_ids, created_by, created_at, expires_at")
      .is("revoked_at", null)
      .order("created_at", { ascending: true })
      .limit(200),
  );
  if (shareRes.error) throw new Error(shareRes.error.message);
  const shareRows = ((shareRes.data ?? []) as Any[]).filter(
    (s) => !s.expires_at || Date.parse(s.expires_at as string) > now,
  );

  // ── 4. Positions waiting to be published ──────────────────────────────────
  const posRes = await excludeOrgs(
    admin
      .from("positions")
      .select("id, title, status, organization_id, created_at, updated_at, submitted_at, organizations(id, name)")
      .in("status", PENDING_POSITION_STATUSES)
      .is("published_at", null)
      .order("created_at", { ascending: true })
      .limit(200),
  );
  if (posRes.error) throw new Error(posRes.error.message);
  const posRows = (posRes.data ?? []) as Any[];

  // Extra match rows needed by the contact-release and share groups.
  const extraMatchIds = [
    ...new Set([
      ...reqRows.map((r) => r.candidate_match_id as string).filter(Boolean),
      ...shareRows.flatMap((s) => ((s.match_ids ?? []) as string[])),
    ]),
  ].filter((id) => !visRows.some((v) => v.id === id));
  let extraMatches: Any[] = [];
  if (extraMatchIds.length > 0) {
    const res = await admin.from("candidate_matches").select(MATCH_SELECT).in("id", extraMatchIds);
    if (res.error) throw new Error(res.error.message);
    extraMatches = (res.data ?? []) as Any[];
  }
  const matchById = new Map<string, Any>();
  for (const m of [...visRows, ...extraMatches]) matchById.set(m.id as string, m);

  const [people, matchActors, positionActors] = await Promise.all([
    resolvePeople(admin, [
      ...reqRows.map((r) => r.actor_user_id as string | null),
      ...shareRows.map((s) => s.created_by as string | null),
    ]),
    resolveLastActors(
      admin,
      "candidate_match",
      visRows.map((v) => v.id as string),
    ),
    resolveLastActors(
      admin,
      "position",
      posRows.map((p) => p.id as string),
    ),
  ]);
  const actorNames = await resolvePeople(admin, [
    ...matchActors.values(),
    ...positionActors.values(),
  ]);

  const orgNameOf = (m: Any): string | null =>
    ((m?.positions as Any)?.organizations?.name as string) ??
    ((m?.organizations as Any)?.name as string) ??
    null;

  for (const m of visRows) {
    const actorId = matchActors.get(m.id as string) ?? null;
    const actor = actorId ? actorNames.get(actorId) : null;
    items.push({
      id: `candidate_visible:${m.id}`,
      kind: "candidate_visible",
      target_type: "candidate_match",
      target_id: m.id as string,
      target_label: matchLabel(m),
      context_label: ((m.positions as Any)?.title as string) ?? null,
      organization_id: (m.organization_id as string) ?? null,
      org_name: orgNameOf(m),
      position_id: (m.position_id as string) ?? null,
      position_title: ((m.positions as Any)?.title as string) ?? null,
      requester_name: actor ? (actor.isStaff ? `${actor.name} (Staff)` : actor.name) : "the client workspace",
      requested_at: (m.updated_at ?? m.created_at) as string,
      age_days: ageDays((m.updated_at ?? m.created_at) as string, now),
      match_ids: [m.id as string],
      blockers: matchBlockers(m),
      link: `/admin/candidates/${m.id}`,
    });
  }

  for (const r of reqRows) {
    const m = matchById.get(r.candidate_match_id as string);
    if (!m) continue;
    if (m.contact_released_at) continue;
    const blockers: string[] = [];
    if (m.client_visibility !== "visible")
      blockers.push("Candidate is not client-visible yet — approve visibility first");
    const actor = r.actor_user_id ? people.get(r.actor_user_id as string) : null;
    items.push({
      id: `contact_release:${r.id}`,
      kind: "contact_release",
      target_type: "candidate_match",
      target_id: m.id as string,
      target_label: matchLabel(m),
      context_label: ((m.positions as Any)?.title as string) ?? null,
      organization_id: (m.organization_id as string) ?? null,
      org_name: orgNameOf(m),
      position_id: (m.position_id as string) ?? null,
      position_title: ((m.positions as Any)?.title as string) ?? null,
      requester_name: actor ? (actor.isStaff ? `${actor.name} (Staff)` : actor.name) : "the client workspace",
      requested_at: r.created_at as string,
      age_days: ageDays(r.created_at as string, now),
      match_ids: [m.id as string],
      blockers,
      link: `/admin/candidates/${m.id}`,
    });
  }

  for (const s of shareRows) {
    const ids = (s.match_ids ?? []) as string[];
    const hidden = ids
      .map((id) => matchById.get(id))
      .filter((m): m is Any => !!m && m.client_visibility !== "visible");
    if (hidden.length === 0) continue;
    const blockers = [...new Set(hidden.flatMap((m) => matchBlockers(m)))];
    const actor = s.created_by ? people.get(s.created_by as string) : null;
    items.push({
      id: `shortlist_share:${s.id}`,
      kind: "shortlist_share",
      target_type: "shortlist_share",
      target_id: s.id as string,
      target_label: (s.title as string) || "Shortlist share",
      context_label: `${hidden.length} candidate${hidden.length === 1 ? "" : "s"} not visible yet`,
      organization_id: (s.organization_id as string) ?? null,
      org_name: orgNameOf(hidden[0]),
      position_id: (s.position_id as string) ?? null,
      position_title: ((hidden[0]?.positions as Any)?.title as string) ?? null,
      requester_name: actor ? (actor.isStaff ? `${actor.name} (Staff)` : actor.name) : "the client workspace",
      requested_at: s.created_at as string,
      age_days: ageDays(s.created_at as string, now),
      match_ids: hidden.map((m) => m.id as string),
      blockers,
      link: s.position_id ? `/admin/positions/${s.position_id}` : null,
    });
  }

  for (const p of posRows) {
    const actorId = positionActors.get(p.id as string) ?? null;
    const actor = actorId ? actorNames.get(actorId) : null;
    const at = (p.submitted_at ?? p.created_at) as string;
    items.push({
      id: `publish_position:${p.id}`,
      kind: "publish_position",
      target_type: "position",
      target_id: p.id as string,
      target_label: (p.title as string) || "Untitled position",
      context_label: `Status: ${String(p.status).replace(/_/g, " ")}`,
      organization_id: (p.organization_id as string) ?? null,
      org_name: ((p.organizations as Any)?.name as string) ?? null,
      position_id: p.id as string,
      position_title: (p.title as string) ?? null,
      requester_name: actor ? (actor.isStaff ? `${actor.name} (Staff)` : actor.name) : "the client workspace",
      requested_at: at,
      age_days: ageDays(at, now),
      match_ids: [],
      blockers: [],
      link: `/admin/positions/${p.id}`,
    });
  }


  const groups = groupApprovals(items);
  return {
    groups,
    total: items.length,
    include_test: scope.includeTest,
    generated_at: new Date().toISOString(),
  };
}

// ─── Decisions ───────────────────────────────────────────────────────────────

async function audit(
  admin: Admin,
  args: {
    action: string;
    entity_type: string;
    entity_id: string;
    organization_id: string | null;
    actor_user_id: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    reason?: string | null;
  },
) {
  await admin.from("audit_events").insert({
    entity_type: args.entity_type,
    entity_id: args.entity_id,
    organization_id: args.organization_id,
    action: args.action,
    actor_user_id: args.actor_user_id,
    before_state: args.before ?? null,
    after_state: args.reason ? { ...(args.after ?? {}), reason: args.reason } : (args.after ?? null),
  });
}

export type DecisionResult = {
  ok: boolean;
  already?: boolean;
  errors: { target_id: string; message: string }[];
  approved: string[];
};

/** Publishes one match through the canonical gate + RPC path. */
async function publishMatch(admin: Admin, matchId: string, actorUserId: string, reason: string | null) {
  const { data: m, error } = await admin
    .from("candidate_matches")
    .select("id, organization_id, client_visibility, current_score_run_id, approved_score_run_id")
    .eq("id", matchId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!m) throw new Error("match_not_found");
  if (m.client_visibility === "visible") return { already: true as const };

  const runId = (m.approved_score_run_id ?? m.current_score_run_id) as string | null;
  if (!runId) throw new Error("no_score_run_yet");

  const { assertPublishGate } = await import("@/lib/scoring-service.server");
  const gate = await assertPublishGate(matchId, runId);
  if (!gate.ok) throw new Error(`publish_blocked:${gate.reason}`);

  const { evidenceGateBlockers } = await import("@/lib/evidence/completeness.server");
  const blockers = await evidenceGateBlockers(admin as never, matchId);
  if (blockers.length > 0) throw new Error(`publish_blocked:evidence_incomplete`);

  const { data: rpc, error: rpcErr } = await admin.rpc("approve_candidate_match", {
    _match_id: matchId,
    _run_id: runId,
    _actor_user_id: actorUserId,
    _reason: reason ?? "Approved from approvals inbox",
    _trace_id: `approvals-${Date.now().toString(36)}`,
  });
  if (rpcErr) throw new Error(rpcErr.message);
  const result = (rpc ?? null) as Any;
  if (!result || result.client_visibility !== "visible") throw new Error("publish_failed");
  return { already: result.already === true };
}

export async function approveApproval(
  admin: Admin,
  args: {
    kind: string;
    target_id: string;
    match_ids?: string[];
    reason?: string | null;
    actor_user_id: string;
  },
): Promise<DecisionResult> {
  const errors: DecisionResult["errors"] = [];
  const approved: string[] = [];
  const reason = args.reason?.trim() || null;

  if (args.kind === "candidate_visible") {
    const res = await publishMatch(admin, args.target_id, args.actor_user_id, reason);
    approved.push(args.target_id);
    return { ok: true, already: res.already, errors, approved };
  }

  if (args.kind === "shortlist_share") {
    const ids = args.match_ids ?? [];
    for (const id of ids) {
      try {
        await publishMatch(admin, id, args.actor_user_id, reason);
        approved.push(id);
      } catch (e) {
        errors.push({ target_id: id, message: e instanceof Error ? e.message : "failed" });
      }
    }
    const { data: share } = await admin
      .from("shortlist_shares")
      .select("id, organization_id")
      .eq("id", args.target_id)
      .maybeSingle();
    await audit(admin, {
      action: "approvals.shortlist_share.approved",
      entity_type: "shortlist_share",
      entity_id: args.target_id,
      organization_id: (share?.organization_id as string) ?? null,
      actor_user_id: args.actor_user_id,
      after: { published_matches: approved, failed: errors },
      reason,
    });
    return { ok: errors.length === 0, errors, approved };
  }

  if (args.kind === "contact_release") {
    const { data: m, error } = await admin
      .from("candidate_matches")
      .select("id, organization_id, client_visibility, contact_released_at")
      .eq("id", args.target_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!m) throw new Error("match_not_found");
    if (m.client_visibility !== "visible")
      throw new Error("Approve this candidate for the client first — contact release requires an approved candidate.");
    if (!m.contact_released_at) {
      const releasedAt = new Date().toISOString();
      const upd = await admin
        .from("candidate_matches")
        .update({
          contact_released_at: releasedAt,
          contact_released_by: args.actor_user_id,
          contact_release_reason: reason ?? "Approved from approvals inbox",
        })
        .eq("id", args.target_id);
      if (upd.error) throw new Error(upd.error.message);
      await audit(admin, {
        action: "match.contact.released",
        entity_type: "candidate_match",
        entity_id: args.target_id,
        organization_id: (m.organization_id as string) ?? null,
        actor_user_id: args.actor_user_id,
        before: { contact_released_at: null },
        after: { contact_released_at: releasedAt, source: "approvals_inbox" },
        reason,
      });
    }
    // Clear the request so the item leaves the inbox.
    await admin
      .from("client_decisions")
      .update({ reversed_at: new Date().toISOString(), reversed_by: args.actor_user_id })
      .eq("candidate_match_id", args.target_id)
      .eq("decision", "request_contact_release")
      .is("reversed_at", null);
    return { ok: true, already: !!m.contact_released_at, errors, approved: [args.target_id] };
  }

  if (args.kind === "publish_position") {
    const { data: before, error } = await admin
      .from("positions")
      .select("id, status, visibility, organization_id, approved_at, published_at")
      .eq("id", args.target_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!before) throw new Error("position_not_found");
    if (before.published_at) return { ok: true, already: true, errors, approved: [args.target_id] };
    const nowIso = new Date().toISOString();
    const { data: after, error: updErr } = await admin
      .from("positions")
      .update({
        status: "active",
        approved_at: (before.approved_at as string | null) ?? nowIso,
        published_at: nowIso,
      })
      .eq("id", args.target_id)
      .select("id, status, published_at")
      .maybeSingle();
    if (updErr) throw new Error(updErr.message);
    await audit(admin, {
      action: "position.activate",
      entity_type: "position",
      entity_id: args.target_id,
      organization_id: (before.organization_id as string) ?? null,
      actor_user_id: args.actor_user_id,
      before: { status: before.status, published_at: before.published_at },
      after: { ...(after ?? {}), source: "approvals_inbox" },
      reason,
    });
    return { ok: true, errors, approved: [args.target_id] };
  }

  throw new Error("unknown_approval_kind");
}

export async function declineApproval(
  admin: Admin,
  args: { kind: string; target_id: string; reason: string; actor_user_id: string },
): Promise<{ ok: true }> {
  const reason = args.reason.trim();
  const nowIso = new Date().toISOString();

  if (args.kind === "candidate_visible") {
    const { data: before } = await admin
      .from("candidate_matches")
      .select("id, organization_id, admin_status, client_visibility")
      .eq("id", args.target_id)
      .maybeSingle();
    if (!before) throw new Error("match_not_found");
    const upd = await admin
      .from("candidate_matches")
      .update({ admin_status: "on_hold" })
      .eq("id", args.target_id);
    if (upd.error) throw new Error(upd.error.message);
    await audit(admin, {
      action: "approvals.candidate_visible.declined",
      entity_type: "candidate_match",
      entity_id: args.target_id,
      organization_id: (before.organization_id as string) ?? null,
      actor_user_id: args.actor_user_id,
      before: { admin_status: before.admin_status, client_visibility: before.client_visibility },
      after: { admin_status: "on_hold" },
      reason,
    });
    return { ok: true };
  }

  if (args.kind === "contact_release") {
    const { data: before } = await admin
      .from("candidate_matches")
      .select("id, organization_id")
      .eq("id", args.target_id)
      .maybeSingle();
    const upd = await admin
      .from("client_decisions")
      .update({ reversed_at: nowIso, reversed_by: args.actor_user_id })
      .eq("candidate_match_id", args.target_id)
      .eq("decision", "request_contact_release")
      .is("reversed_at", null);
    if (upd.error) throw new Error(upd.error.message);
    await audit(admin, {
      action: "approvals.contact_release.declined",
      entity_type: "candidate_match",
      entity_id: args.target_id,
      organization_id: (before?.organization_id as string) ?? null,
      actor_user_id: args.actor_user_id,
      after: { contact_released_at: null },
      reason,
    });
    return { ok: true };
  }

  if (args.kind === "shortlist_share") {
    const { data: before } = await admin
      .from("shortlist_shares")
      .select("id, organization_id, revoked_at")
      .eq("id", args.target_id)
      .maybeSingle();
    if (!before) throw new Error("share_not_found");
    const upd = await admin
      .from("shortlist_shares")
      .update({ revoked_at: (before.revoked_at as string | null) ?? nowIso })
      .eq("id", args.target_id);
    if (upd.error) throw new Error(upd.error.message);
    await audit(admin, {
      action: "approvals.shortlist_share.declined",
      entity_type: "shortlist_share",
      entity_id: args.target_id,
      organization_id: (before.organization_id as string) ?? null,
      actor_user_id: args.actor_user_id,
      before: { revoked_at: before.revoked_at },
      after: { revoked_at: nowIso },
      reason,
    });
    return { ok: true };
  }

  if (args.kind === "publish_position") {
    const { data: before } = await admin
      .from("positions")
      .select("id, status, organization_id")
      .eq("id", args.target_id)
      .maybeSingle();
    if (!before) throw new Error("position_not_found");
    const upd = await admin
      .from("positions")
      .update({ status: "needs_clarification" })
      .eq("id", args.target_id);
    if (upd.error) throw new Error(upd.error.message);
    await audit(admin, {
      action: "approvals.publish_position.declined",
      entity_type: "position",
      entity_id: args.target_id,
      organization_id: (before.organization_id as string) ?? null,
      actor_user_id: args.actor_user_id,
      before: { status: before.status },
      after: { status: "needs_clarification" },
      reason,
    });
    return { ok: true };
  }

  throw new Error("unknown_approval_kind");
}
