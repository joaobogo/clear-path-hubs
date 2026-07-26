/**
 * Admin command centre — server-only aggregation.
 *
 * Every number here is a real count from a real query, and every row carries
 * the identifiers needed to deep-link to the record that produced it. No
 * derived "trends", no sampled estimates.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AnyRow;
}

export type CommandFilters = {
  org_id?: string;
  position_id?: string;
  owner_id?: string;
  status?: string;
  from?: string;
  to?: string;
};

export type UrgentKind =
  | "parsing_failed"
  | "intake_incomplete"
  | "screening_review"
  | "awaiting_client_release"
  | "overdue_feedback"
  | "interview_request"
  | "delivery_risk"
  | "integration_failure";

export type UrgentItem = {
  id: string;
  kind: UrgentKind;
  title: string;
  detail: string;
  occurred_at: string | null;
  severity: "critical" | "high" | "medium";
  /** Deep link target. `param` fills the single `$id` segment when present. */
  to: string;
  param?: string;
  organization_id: string | null;
  organization_name: string | null;
  position_id: string | null;
  position_title: string | null;
};

export type WorkloadPosition = {
  position_id: string;
  title: string;
  status: string;
  in_pipeline: number;
  awaiting_review: number;
  awaiting_release: number;
  interviews: number;
  issues: number;
};

export type WorkloadClient = {
  organization_id: string;
  organization_name: string;
  positions: WorkloadPosition[];
  totals: Omit<WorkloadPosition, "position_id" | "title" | "status">;
};

const OVERDUE_FEEDBACK_DAYS = 5;
const AGING_HOURS = 24;

const PIPELINE_STATES = ["queued", "parsing", "enriching", "ready_to_score", "parsed"];
const FAILED_STATES = ["failed", "provider_blocked", "ocr_required", "manual_review_required"];
const OPEN_POSITION_STATES = ["approved", "active"];

function iso(d: Date) {
  return d.toISOString();
}

/** Apply the shared filter set to a candidate_matches-shaped query. */
function applyMatchFilters(q: AnyRow, f: CommandFilters, dateCol: string) {
  if (f.org_id) q = q.eq("organization_id", f.org_id);
  if (f.position_id) q = q.eq("position_id", f.position_id);
  if (f.from) q = q.gte(dateCol, f.from);
  if (f.to) q = q.lte(dateCol, f.to);
  return q;
}

/**
 * Positions matching the client/owner/status filters. Returns null when no
 * position-scoping filter is active (meaning: do not restrict).
 */
async function scopedPositionIds(f: CommandFilters): Promise<string[] | null> {
  if (!f.owner_id && !f.status && !f.position_id) return null;
  const s = await admin();
  let q = s.from("positions").select("id");
  if (f.owner_id) q = q.eq("created_by", f.owner_id);
  if (f.status) q = q.eq("status", f.status);
  if (f.position_id) q = q.eq("id", f.position_id);
  if (f.org_id) q = q.eq("organization_id", f.org_id);
  const { data } = await q.limit(2000);
  return ((data ?? []) as AnyRow[]).map((r) => r.id as string);
}

function inScope(ids: string[] | null, positionId: string | null | undefined) {
  if (ids === null) return true;
  return positionId != null && ids.includes(positionId);
}

/** Filter option lists — real records only, so every option yields results. */
export async function loadFilterOptions() {
  const s = await admin();
  const [{ data: orgs }, { data: positions }, { data: owners }] = await Promise.all([
    s.from("organizations").select("id,name").order("name").limit(500),
    s
      .from("positions")
      .select("id,title,status,organization_id")
      .order("created_at", { ascending: false })
      .limit(500),
    s
      .from("memberships")
      .select("user_id,role,profiles:user_id(full_name,email)")
      .in("role", ["platform_admin", "operations"])
      .eq("status", "active")
      .limit(200),
  ]);

  const seen = new Set<string>();
  const ownerList: { id: string; name: string }[] = [];
  for (const m of (owners ?? []) as AnyRow[]) {
    if (!m.user_id || seen.has(m.user_id)) continue;
    seen.add(m.user_id);
    ownerList.push({
      id: m.user_id,
      name: m.profiles?.full_name || m.profiles?.email || "Staff member",
    });
  }

  return {
    organizations: ((orgs ?? []) as AnyRow[]).map((o) => ({ id: o.id, name: o.name })),
    positions: ((positions ?? []) as AnyRow[]).map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      organization_id: p.organization_id,
    })),
    owners: ownerList,
    statuses: [
      "draft",
      "submitted",
      "under_review",
      "needs_clarification",
      "approved",
      "active",
      "paused",
      "filled",
      "closed",
    ],
  };
}

/** The urgent queue: everything genuinely blocking delivery, newest first. */
export async function loadUrgentQueue(f: CommandFilters): Promise<UrgentItem[]> {
  const s = await admin();
  const positionIds = await scopedPositionIds(f);
  if (positionIds !== null && positionIds.length === 0) return [];

  const now = Date.now();
  const overdueCut = iso(new Date(now - OVERDUE_FEEDBACK_DAYS * 86400_000));
  const agingCut = iso(new Date(now - AGING_HOURS * 3600_000));
  const soon = iso(new Date(now + 48 * 3600_000));

  const matchSelect =
    "id,stage,admin_status,client_visibility,processing_state,processing_error_code," +
    "processing_updated_at,updated_at,delivered_at,created_at,organization_id,position_id," +
    "candidate_profiles(full_name),positions(title),organizations(name)";

  const [
    { data: failed },
    { data: intake },
    { data: review },
    { data: release },
    { data: overdue },
    { data: interviews },
    { data: openPositions },
    { data: jobs },
  ] = await Promise.all([
    applyMatchFilters(
      s.from("candidate_matches").select(matchSelect).in("processing_state", FAILED_STATES),
      f,
      "processing_updated_at",
    )
      .order("processing_updated_at", { ascending: false })
      .limit(50),

    (() => {
      let q = s
        .from("intake_submissions")
        .select("id,company_name,role_title,status,requisition_pending,created_at,organization_id,position_id")
        .is("position_id", null)
        .not("status", "in", "(approved,rejected)");
      if (f.org_id) q = q.eq("organization_id", f.org_id);
      if (f.from) q = q.gte("created_at", f.from);
      if (f.to) q = q.lte("created_at", f.to);
      return q.order("created_at", { ascending: false }).limit(50);
    })(),

    applyMatchFilters(
      s
        .from("candidate_matches")
        .select(matchSelect)
        .eq("processing_state", "scored")
        .eq("admin_status", "pending"),
      f,
      "updated_at",
    )
      .order("updated_at", { ascending: true })
      .limit(50),

    applyMatchFilters(
      s
        .from("candidate_matches")
        .select(matchSelect)
        .eq("admin_status", "approved")
        .eq("client_visibility", "hidden"),
      f,
      "updated_at",
    )
      .order("updated_at", { ascending: true })
      .limit(50),

    applyMatchFilters(
      s
        .from("candidate_matches")
        .select(matchSelect)
        .eq("client_visibility", "visible")
        .in("stage", ["new", "reviewing", "delivered"])
        .lt("delivered_at", overdueCut),
      f,
      "delivered_at",
    )
      .order("delivered_at", { ascending: true })
      .limit(50),

    (() => {
      let q = s
        .from("interviews")
        .select(
          "id,status,scheduled_at,requested_at,candidate_match_id,organization_id,position_id," +
            "candidate_matches(candidate_profiles(full_name),positions(title),organizations(name))",
        )
        .or(`status.eq.requested,and(status.eq.scheduled,scheduled_at.lte.${soon})`);
      if (f.org_id) q = q.eq("organization_id", f.org_id);
      if (f.position_id) q = q.eq("position_id", f.position_id);
      return q.order("scheduled_at", { ascending: true, nullsFirst: true }).limit(50);
    })(),

    (() => {
      let q = s
        .from("positions")
        .select("id,title,status,created_at,organization_id,organizations(name)")
        .in("status", OPEN_POSITION_STATES);
      if (f.org_id) q = q.eq("organization_id", f.org_id);
      if (f.owner_id) q = q.eq("created_by", f.owner_id);
      if (f.position_id) q = q.eq("id", f.position_id);
      return q.order("created_at", { ascending: true }).limit(200);
    })(),

    s
      .from("processing_jobs")
      .select("id,job_type,status,error_code,error_message,attempts,created_at,entity_type,entity_id")
      .eq("status", "failed")
      .gte("created_at", iso(new Date(now - 7 * 86400_000)))
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const items: UrgentItem[] = [];
  const fromMatch = (
    m: AnyRow,
    kind: UrgentKind,
    title: string,
    detail: string,
    severity: UrgentItem["severity"],
    when: string | null,
  ): UrgentItem => ({
    id: `${kind}:${m.id}`,
    kind,
    title,
    detail,
    occurred_at: when,
    severity,
    to: "/admin/candidates/$id",
    param: m.id,
    organization_id: m.organization_id ?? null,
    organization_name: m.organizations?.name ?? null,
    position_id: m.position_id ?? null,
    position_title: m.positions?.title ?? null,
  });

  for (const m of (failed ?? []) as AnyRow[]) {
    if (!inScope(positionIds, m.position_id)) continue;
    items.push(
      fromMatch(
        m,
        "parsing_failed",
        `CV processing failed — ${m.candidate_profiles?.full_name ?? "Candidate"}`,
        `${String(m.processing_error_code ?? m.processing_state).replace(/_/g, " ")} · ${m.positions?.title ?? "—"}`,
        "critical",
        m.processing_updated_at,
      ),
    );
  }

  for (const it of (intake ?? []) as AnyRow[]) {
    if (positionIds !== null) continue; // intake has no position yet
    items.push({
      id: `intake_incomplete:${it.id}`,
      kind: "intake_incomplete",
      title: `${it.requisition_pending ? "Convert" : "Complete"} intake — ${it.company_name}`,
      detail: `${it.role_title} · ${String(it.status).replace(/_/g, " ")}`,
      occurred_at: it.created_at,
      severity: it.requisition_pending ? "high" : "medium",
      to: "/admin/intake/$id",
      param: it.id,
      organization_id: it.organization_id ?? null,
      organization_name: it.company_name ?? null,
      position_id: null,
      position_title: it.role_title ?? null,
    });
  }

  for (const m of (review ?? []) as AnyRow[]) {
    if (!inScope(positionIds, m.position_id)) continue;
    items.push(
      fromMatch(
        m,
        "screening_review",
        `Screening needs review — ${m.candidate_profiles?.full_name ?? "Candidate"}`,
        `${m.positions?.title ?? "—"} · ${m.organizations?.name ?? "—"}`,
        "high",
        m.updated_at,
      ),
    );
  }

  for (const m of (release ?? []) as AnyRow[]) {
    if (!inScope(positionIds, m.position_id)) continue;
    items.push(
      fromMatch(
        m,
        "awaiting_client_release",
        `Approved, not released — ${m.candidate_profiles?.full_name ?? "Candidate"}`,
        `${m.positions?.title ?? "—"} · ${m.organizations?.name ?? "—"}`,
        "high",
        m.updated_at,
      ),
    );
  }

  for (const m of (overdue ?? []) as AnyRow[]) {
    if (!inScope(positionIds, m.position_id)) continue;
    items.push(
      fromMatch(
        m,
        "overdue_feedback",
        `No client feedback in ${OVERDUE_FEEDBACK_DAYS}+ days — ${m.candidate_profiles?.full_name ?? "Candidate"}`,
        `${m.positions?.title ?? "—"} · ${m.organizations?.name ?? "—"}`,
        "medium",
        m.delivered_at,
      ),
    );
  }

  for (const iv of (interviews ?? []) as AnyRow[]) {
    if (!inScope(positionIds, iv.position_id)) continue;
    const cm = iv.candidate_matches ?? {};
    items.push({
      id: `interview_request:${iv.id}`,
      kind: "interview_request",
      title:
        iv.status === "requested"
          ? `Interview requested — ${cm.candidate_profiles?.full_name ?? "Candidate"}`
          : `Interview within 48h — ${cm.candidate_profiles?.full_name ?? "Candidate"}`,
      detail: `${cm.positions?.title ?? "—"} · ${cm.organizations?.name ?? "—"}`,
      occurred_at: iv.scheduled_at ?? iv.requested_at,
      severity: iv.status === "requested" ? "high" : "critical",
      to: "/admin/candidates/$id",
      param: iv.candidate_match_id,
      organization_id: iv.organization_id ?? null,
      organization_name: cm.organizations?.name ?? null,
      position_id: iv.position_id ?? null,
      position_title: cm.positions?.title ?? null,
    });
  }

  // Delivery risk: an open role with nothing delivered to the client yet.
  const openIds = ((openPositions ?? []) as AnyRow[]).map((p) => p.id);
  if (openIds.length > 0) {
    const { data: delivered } = await s
      .from("candidate_matches")
      .select("position_id")
      .in("position_id", openIds)
      .eq("client_visibility", "visible")
      .limit(5000);
    const withDelivery = new Set(((delivered ?? []) as AnyRow[]).map((r) => r.position_id));
    for (const p of (openPositions ?? []) as AnyRow[]) {
      if (withDelivery.has(p.id)) continue;
      if (new Date(p.created_at).getTime() > now - AGING_HOURS * 3600_000) continue;
      items.push({
        id: `delivery_risk:${p.id}`,
        kind: "delivery_risk",
        title: `No candidates delivered — ${p.title}`,
        detail: `${p.organizations?.name ?? "—"} · open since ${new Date(p.created_at).toLocaleDateString()}`,
        occurred_at: p.created_at,
        severity: "high",
        to: "/admin/positions/$id",
        param: p.id,
        organization_id: p.organization_id ?? null,
        organization_name: p.organizations?.name ?? null,
        position_id: p.id,
        position_title: p.title,
      });
    }
  }

  // Integration failures: background jobs that exhausted their retries.
  if (positionIds === null && !f.org_id) {
    for (const j of (jobs ?? []) as AnyRow[]) {
      items.push({
        id: `integration_failure:${j.id}`,
        kind: "integration_failure",
        title: `Background job failed — ${String(j.job_type).replace(/_/g, " ")}`,
        detail: `${String(j.error_code ?? "unknown error").replace(/_/g, " ")} · ${j.attempts ?? 0} attempts`,
        occurred_at: j.created_at,
        severity: "critical",
        to: "/admin/operations",
        organization_id: null,
        organization_name: null,
        position_id: null,
        position_title: null,
      });
    }
  }

  // Aging pipeline work also counts as a parsing risk.
  const { data: stalled } = await applyMatchFilters(
    s
      .from("candidate_matches")
      .select(matchSelect)
      .in("processing_state", PIPELINE_STATES)
      .lt("processing_updated_at", agingCut),
    f,
    "processing_updated_at",
  )
    .order("processing_updated_at", { ascending: true })
    .limit(25);
  for (const m of (stalled ?? []) as AnyRow[]) {
    if (!inScope(positionIds, m.position_id)) continue;
    items.push(
      fromMatch(
        m,
        "parsing_failed",
        `Stalled in ${String(m.processing_state).replace(/_/g, " ")} — ${m.candidate_profiles?.full_name ?? "Candidate"}`,
        `No progress for over ${AGING_HOURS}h · ${m.positions?.title ?? "—"}`,
        "high",
        m.processing_updated_at,
      ),
    );
  }

  const rank = { critical: 0, high: 1, medium: 2 } as const;
  items.sort((a, b) => {
    const r = rank[a.severity] - rank[b.severity];
    if (r !== 0) return r;
    return (b.occurred_at ?? "").localeCompare(a.occurred_at ?? "");
  });
  return items;
}

/** Open work grouped by client, then by job. Counts are exact. */
export async function loadWorkload(f: CommandFilters): Promise<WorkloadClient[]> {
  const s = await admin();
  const positionIds = await scopedPositionIds(f);
  if (positionIds !== null && positionIds.length === 0) return [];

  let posQ = s
    .from("positions")
    .select("id,title,status,organization_id,organizations(name)")
    .not("status", "in", "(closed,draft,archived,filled)");
  if (f.org_id) posQ = posQ.eq("organization_id", f.org_id);
  if (f.status) posQ = posQ.eq("status", f.status);
  if (f.owner_id) posQ = posQ.eq("created_by", f.owner_id);
  if (f.position_id) posQ = posQ.eq("id", f.position_id);
  const { data: positions } = await posQ.order("title").limit(400);

  const ids = ((positions ?? []) as AnyRow[]).map((p) => p.id);
  if (ids.length === 0) return [];

  let matchQ = s
    .from("candidate_matches")
    .select("id,position_id,processing_state,admin_status,client_visibility,stage,created_at")
    .in("position_id", ids);
  if (f.from) matchQ = matchQ.gte("created_at", f.from);
  if (f.to) matchQ = matchQ.lte("created_at", f.to);
  const [{ data: matches }, { data: interviews }] = await Promise.all([
    matchQ.limit(10000),
    s
      .from("interviews")
      .select("id,position_id,status")
      .in("position_id", ids)
      .in("status", ["requested", "scheduled"])
      .limit(5000),
  ]);

  const perPosition = new Map<string, WorkloadPosition>();
  for (const p of (positions ?? []) as AnyRow[]) {
    perPosition.set(p.id, {
      position_id: p.id,
      title: p.title,
      status: p.status,
      in_pipeline: 0,
      awaiting_review: 0,
      awaiting_release: 0,
      interviews: 0,
      issues: 0,
    });
  }
  for (const m of (matches ?? []) as AnyRow[]) {
    const row = perPosition.get(m.position_id);
    if (!row) continue;
    if (PIPELINE_STATES.includes(m.processing_state)) row.in_pipeline += 1;
    if (m.processing_state === "scored" && m.admin_status === "pending") row.awaiting_review += 1;
    if (m.admin_status === "approved" && m.client_visibility === "hidden") row.awaiting_release += 1;
    if (FAILED_STATES.includes(m.processing_state)) row.issues += 1;
  }
  for (const iv of (interviews ?? []) as AnyRow[]) {
    const row = perPosition.get(iv.position_id);
    if (row) row.interviews += 1;
  }

  const byClient = new Map<string, WorkloadClient>();
  for (const p of (positions ?? []) as AnyRow[]) {
    const key = p.organization_id ?? "unassigned";
    let entry = byClient.get(key);
    if (!entry) {
      entry = {
        organization_id: key,
        organization_name: p.organizations?.name ?? "Unassigned",
        positions: [],
        totals: {
          in_pipeline: 0,
          awaiting_review: 0,
          awaiting_release: 0,
          interviews: 0,
          issues: 0,
        },
      };
      byClient.set(key, entry);
    }
    const row = perPosition.get(p.id)!;
    entry.positions.push(row);
    entry.totals.in_pipeline += row.in_pipeline;
    entry.totals.awaiting_review += row.awaiting_review;
    entry.totals.awaiting_release += row.awaiting_release;
    entry.totals.interviews += row.interviews;
    entry.totals.issues += row.issues;
  }

  return [...byClient.values()].sort((a, b) => {
    const aw = a.totals.issues + a.totals.awaiting_review + a.totals.awaiting_release;
    const bw = b.totals.issues + b.totals.awaiting_review + b.totals.awaiting_release;
    if (aw !== bw) return bw - aw;
    return a.organization_name.localeCompare(b.organization_name);
  });
}

/** True when the platform has no positions at all (vs. filters excluding all). */
export async function hasAnyWork(): Promise<boolean> {
  const s = await admin();
  const { count } = await s.from("positions").select("id", { count: "exact", head: true });
  return (count ?? 0) > 0;
}
