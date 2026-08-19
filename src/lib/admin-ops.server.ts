// Admin operations reads: work queues, payments/pilot panel, review queue.
// Server-only. Every query reads real records — nothing is simulated.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Any;
}

export async function requireStaff(userId: string) {
  const s = await admin();
  const { data } = await s.rpc("is_platform_staff", { _user: userId });
  if (data !== true) throw new Error("forbidden");
}

export type {
  QueueTarget,
  QueueOwner,
  QueueClaim,
  QueueItem,
  QueueSeeAll,
  WorkQueue,
} from "./admin-ops-types";
import type { QueueClaim, QueueItem, QueueOwner, QueueRef, WorkQueue } from "./admin-ops-types";
import { PAID_PAYMENT_STATES } from "@/lib/publish-gate";


const ISO = (ms: number) => new Date(Date.now() - ms).toISOString();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function ageTone(iso: string | null, warnDays: number, dangerDays: number): QueueItem["tone"] {
  if (!iso) return "default";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "default";
  const days = (Date.now() - date.getTime()) / DAY;
  if (days >= dangerDays) return "danger";
  if (days >= warnDays) return "warning";
  return "default";
}

/** The operator queues, each with an exact count and one direct action. */
export async function loadWorkQueues(raw: { includeTest?: boolean } = {}): Promise<WorkQueue[]> {
  const opts = raw || {};
  const s = await admin();
  const { loadTestScope, excludeTestOrgs, loadAgingIntakes } = await import(
    "./admin-test-scope.server"
  );
  const scope = await loadTestScope(s, opts.includeTest ?? false);

  const [unpaid, setup, review, readyForDecision, delivered, interviews, blocked, aging, stale] = await Promise.all([
    // 1 — submitted roles that have not been paid for (or are stuck mid-checkout).
    excludeTestOrgs(
      s
        .from("positions")
        .select("id,title,status,payment_status,owner_user_id,created_at,updated_at,organization_id,organizations(id,name)", {
          count: "exact",
        })
        .in("payment_status", ["unpaid", "pending"])
        .not("status", "in", "(draft,archived,closed,filled)")
        .order("updated_at", { ascending: true })
        .limit(8),
      scope,
    ),

    // 2 — paid, exempt or plan-covered roles still waiting on platform setup.
    excludeTestOrgs(
      s
        .from("positions")
        .select("id,title,status,payment_status,owner_user_id,created_at,organization_id,organizations(id,name)", { count: "exact" })
        .in("status", ["submitted", "needs_clarification"])
        .in("payment_status", [...PAID_PAYMENT_STATES])
        .order("created_at", { ascending: true })

        .limit(8),
      scope,
    ),

    // 3 — candidates awaiting decision (scored).
    // Scoping must exactly match loadReviewQueueIds for counter agreement.
    excludeTestOrgs(
      s
        .from("candidate_matches")
        .select(
          "id,updated_at,processing_state,candidate_profiles(full_name),positions(id,title,owner_user_id,organizations(id,name)),score_runs!candidate_matches_current_score_run_id_fkey(score)",
          { count: "exact" },
        )
        .eq("admin_status", "pending")
        .eq("processing_state", "scored")
        .order("updated_at", { ascending: true })
        .limit(8),
      scope,
    ),

    // 3.5 — ready for client decision (admin already approved).
    // Derived from matches in delivered+ status with no client decision row.
    (async () => {
      const { loadDecisionBacklog } = await import("./admin-decision-backlog.server");
      const backlog = await loadDecisionBacklog(s, { includeTest: opts.includeTest ?? false });
      return { data: [], count: backlog.rows.length };
    })(),

    // 4 — shared with the client, no decision recorded yet.
    // The work-queue "Client decisions overdue" tile uses this.
    // We slice to 8 for the preview list but the count reflects the whole backlog.
    (async () => {
      const { loadDecisionBacklog } = await import("./admin-decision-backlog.server");
      const backlog = await loadDecisionBacklog(s, { includeTest: opts.includeTest ?? false });
      return { data: backlog.rows, count: backlog.rows.length };
    })(),



    // 5 — interviews requested, or happening in the next 48h.
    // Inner join on positions and organizations to ensure we only count actionable interviews.
    excludeTestOrgs(
      s
        .from("interviews")
        .select(
          "id,status,requested_at,scheduled_at,candidate_match_id,candidate_matches!inner(candidate_profiles(full_name),positions!inner(id,title,owner_user_id,organizations!inner(id,name)))",
          { count: "exact" },
        )
        .or(
          `status.eq.requested,and(status.eq.scheduled,scheduled_at.lte.${new Date(Date.now() + 48 * HOUR).toISOString()})`,
        )
        .order("requested_at", { ascending: true })
        .limit(8),
      scope,
    ),

    // 6 — delivery failures that need a retry or a new address.
    (async () => {
      const { loadDeliveryFailures } = await import("./notification-failures.server");
      const failures = await loadDeliveryFailures(s);
      return { data: failures.items, count: failures.items.length };
    })(),

    // 6 — real client briefs sitting in the inbox for more than three days.
    loadAgingIntakes(s, { includeTest: opts.includeTest ?? false, olderThanDays: 3, limit: 8 }),
    // 7 — P-006: candidates with stale scores.
    excludeTestOrgs(
      s
        .from("candidate_matches")
        .select(
          "id,score_stale_at,score_stale_reasons,candidate_profiles(full_name),positions(id,title,owner_user_id,organizations(id,name))",
          { count: "exact" },
        )
        .eq("score_stale", true)
        .order("score_stale_at", { ascending: true })
        .limit(8),
      scope,
    ),
  ]);


  const overdue = (delivered.data ?? []) as any[];

  // 11. Reconciliation: Identify hired candidates to ensure rollup agreement.
  const hiredCount = (await s
    .from("candidate_matches")
    .select("id", { count: "exact", head: true })
    .eq("stage", "hired")
    .not("delivered_at", "is", null)).count ?? 0;


  const agingIntakes = aging as {
    items: Array<{
      id: string;
      org_name: string | null;
      role_title: string | null;
      owner_user_id: string | null;
      created_at: string;
      days_waiting: number;
    }>;
    count: number;
  };

  // One profile read for every owner id on the page, so each row can show who
  // holds it without a second click.
  const ownerIds = new Set<string>();
  const addOwner = (v: unknown) => {
    if (typeof v === "string" && v) ownerIds.add(v);
  };
  for (const p of (unpaid.data ?? []) as Any[]) addOwner(p.owner_user_id);
  for (const p of (setup.data ?? []) as Any[]) addOwner(p.owner_user_id);
  for (const m of (review.data ?? []) as Any[]) addOwner(m.positions?.owner_user_id);
  for (const m of overdue) addOwner(m.owner_user_id);
  for (const iv of (interviews.data ?? []) as Any[])
    addOwner(iv.candidate_matches?.positions?.owner_user_id);
  for (const i of agingIntakes.items) addOwner(i.owner_user_id);
  for (const m of (stale.data ?? []) as Any[]) addOwner(m.positions?.owner_user_id);


  const ownerName = new Map<string, string>();
  if (ownerIds.size) {
    const { data: profiles } = await s
      .from("profiles")
      .select("auth_user_id,full_name,email")
      .in("auth_user_id", [...ownerIds]);
    for (const pr of (profiles ?? []) as Any[]) {
      ownerName.set(pr.auth_user_id, pr.full_name || pr.email || "Unknown staff");
    }
  }
  // An owner id with no profile row is a stale pointer (deleted account, old
  // seed). Showing "Unknown staff" would both assert a person who does not
  // exist and hide the Claim action, leaving the row unassignable — so an
  // unresolvable owner reads as unassigned and stays claimable.
  const owner = (id: unknown): QueueOwner =>
    typeof id === "string" && id && ownerName.has(id)
      ? { user_id: id, name: ownerName.get(id)! }
      : null;

  const positionClaim = (id: unknown): QueueClaim =>
    typeof id === "string" && id ? { kind: "position" as const, id } : null;

  // Linkable refs for the row title/subtitle. An id we do not have degrades to
  // plain text rather than rendering a dead link.
  const posRef = (id: unknown, label: unknown): QueueRef =>
    typeof id === "string" && id
      ? { kind: "position", id, label: String(label ?? "Role") }
      : { kind: "text", label: String(label ?? "—") };
  const orgRef = (id: unknown, label: unknown): QueueRef =>
    typeof id === "string" && id
      ? { kind: "organization", id, label: String(label ?? "Client") }
      : { kind: "text", label: String(label ?? "—") };

  const queues: WorkQueue[] = [
    {
      key: "intakes_aging",
      label: "Intakes awaiting action",
      description: "Client briefs submitted more than three days ago with no position yet.",
      count: agingIntakes.count,
      action_hint: "Open the brief: convert it to a role, ask for clarification, or reject it.",
      see_all: { to: "/admin/intake" },
      items: agingIntakes.items.map((i) => ({
        id: i.id,
        title: i.org_name ?? "Client",
        subtitle: i.role_title ?? "Role not stated",
        meta: `${i.days_waiting} day${i.days_waiting === 1 ? "" : "s"} waiting`,
        waiting_since: i.created_at,
        target: { kind: "intake" as const, id: i.id },
        action_label: "Open intake",
        owner: owner(i.owner_user_id),
        claim: { kind: "intake" as const, id: i.id },
        tone: ageTone(i.created_at, 3, 7),
      })),
    },

    {
      key: "unpaid",
      label: "Unpaid submissions",
      description: "Roles submitted but not paid for. Nothing publishes until this clears.",
      count: unpaid.count ?? 0,
      action_hint: "Open the role to chase payment or grant an exemption.",
      see_all: { to: "/admin/payments" },
      items: ((unpaid.data ?? []) as Any[]).map((p) => ({
        id: p.id,
        title: p.title,
        title_ref: posRef(p.id, p.title),
        subtitle: p.organizations?.name ?? "—",
        subtitle_refs: [orgRef(p.organization_id ?? p.organizations?.id, p.organizations?.name)],
        meta: p.payment_status === "pending" ? "checkout started" : "no checkout yet",
        waiting_since: p.updated_at ?? p.created_at,
        target: { kind: "position" as const, id: p.id },
        action_label: "Resolve payment",
        owner: owner(p.owner_user_id),
        claim: positionClaim(p.id),
        tone: ageTone(p.updated_at ?? p.created_at, 2, 5),
      })),
    },
    {
      key: "setup",
      label: "Roles awaiting setup",
      description: "Paid or exempt roles that still need approval and configuration.",
      count: setup.count ?? 0,
      action_hint: "Open the role, complete setup, approve it.",
      see_all: { to: "/admin/positions" },
      items: ((setup.data ?? []) as any[]).map((p) => ({
        id: p.id,
        title: p.title,
        title_ref: posRef(p.id, p.title),
        subtitle: p.organizations?.name ?? "—",
        subtitle_refs: [orgRef(p.organization_id ?? p.organizations?.id, p.organizations?.name)],
        meta: String(p.status).replace(/_/g, " "),
        waiting_since: p.created_at,
        target: { kind: "position" as const, id: p.id },
        action_label: "Set up role",
        owner: owner(p.owner_user_id),
        claim: positionClaim(p.id),
        tone: ageTone(p.created_at, 1, 3),
      })),
    },
    {
      key: "review",
      label: "Candidates awaiting decision",
      description: "Scored candidates awaiting an admin approve, hold, or reject decision.",
      count: review.count ?? 0,
      action_hint: "Review evidence and recorded fit labels to make a decision.",
      see_all: { to: "/admin/candidates" },
      secondary_badge: {
        label: `${readyForDecision.count ?? 0} ready for decision`,
        tone: (readyForDecision.count ?? 0) > 0 ? "default" : "neutral",
      },
      items: ((review.data ?? []) as Any[]).map((m) => ({
        id: m.id,
        title: m.candidate_profiles?.full_name ?? "Candidate",
        subtitle: `${m.positions?.title ?? "—"} · ${m.positions?.organizations?.name ?? "—"}`,
        subtitle_refs: [
          posRef(m.positions?.id, m.positions?.title),
          orgRef(m.positions?.organizations?.id, m.positions?.organizations?.name),
        ],
        meta: m.score_runs?.score != null ? `score ${Math.round(Number(m.score_runs.score))}` : null,
        waiting_since: m.updated_at,
        target: { kind: "review" as const, matchId: m.id },
        action_label: "Review",
        owner: owner(m.positions?.owner_user_id),
        claim: positionClaim(m.positions?.id),
        tone: ageTone(m.updated_at, 1, 3),
      })),
    },

    {
      key: "client_overdue",
      label: "Client decisions overdue",
      description: "Shared with the client, still no decision recorded.",
      count: delivered.count ?? 0,
      action_hint: "Nudge the client or call it — the candidate is waiting.",
      see_all: { to: "/admin/operations" },
      items: overdue.slice(0, 8).map((m) => ({
        id: m.match_id,
        title: m.candidate_name ?? "Candidate",
        subtitle: `${m.position_title ?? "—"} · ${m.client_name ?? "—"}`,
        subtitle_refs: [
          posRef(m.position_id, m.position_title),
          orgRef(m.organization_id, m.client_name),
        ],
        meta: String(m.stage).replace(/_/g, " "),
        waiting_since: m.submitted_at,
        target: { kind: "match" as const, id: m.match_id },
        action_label: "Chase decision",
        owner: owner(m.owner_user_id),
        claim: positionClaim(m.position_id),
        tone: ageTone(m.submitted_at, 5, 8),
      })),
    },

    {
      key: "interviews",
      label: "Interviews to coordinate",
      description: "Requested but unscheduled, or happening within 48 hours.",
      count: interviews.count ?? 0,
      action_hint: "Confirm the slot and tell both sides.",
      see_all: { to: "/admin/candidates" },
      items: ((interviews.data ?? []) as Any[]).map((iv) => ({
        id: iv.id,
        title: iv.candidate_matches?.candidate_profiles?.full_name ?? "Candidate",
        subtitle: `${iv.candidate_matches?.positions?.title ?? "—"} · ${
          iv.candidate_matches?.positions?.organizations?.name ?? "—"
        }`,
        subtitle_refs: [
          posRef(iv.candidate_matches?.positions?.id, iv.candidate_matches?.positions?.title),
          orgRef(
            iv.candidate_matches?.positions?.organizations?.id,
            iv.candidate_matches?.positions?.organizations?.name,
          ),
        ],
        meta: iv.status === "requested" ? "awaiting slot" : "scheduled soon",
        waiting_since: iv.scheduled_at ?? iv.requested_at,
        target: { kind: "match" as const, id: iv.candidate_match_id },
        action_label: "Coordinate",
        owner: owner(iv.candidate_matches?.positions?.owner_user_id),
        claim: positionClaim(iv.candidate_matches?.positions?.id),
        tone: iv.status === "requested" ? "warning" : "default",
      })),
    },
    {
      key: "delivery_failures",
      label: "Delivery failures (7d)",
      description: "Email or message failures in the last 7 days that need a retry or a new address.",
      count: blocked.count ?? 0,

      action_hint: "Retry the delivery or update the recipient's email.",
      see_all: { to: "/admin/operations" },
      items: ((blocked.data ?? []) as any[]).map((d) => ({
        id: d.id,
        title: d.title ?? "Delivery failure",
        subtitle: (d.reasonDetail ?? d.reason ?? "").replace(/_/g, " "),
        meta: d.audience ?? null,
        waiting_since: d.lastAttemptAt,
        target: { kind: "match" as const, id: d.id },
        action_label: "Fix",
        owner: null,
        claim: null,
        tone: "danger" as const,
      })),
    },
    {
      key: "score_stale",
      label: "Stale scores",
      description: "Candidates whose score inputs changed after assessment.",
      count: stale.count ?? 0,
      action_hint: "Recompute scores to clear out-of-date banners.",
      see_all: { to: "/admin/scoring/review" as any },
      items: ((stale.data ?? []) as any[]).map((m) => ({
        id: m.id,
        title: m.candidate_profiles?.full_name ?? "Candidate",
        subtitle: `${m.positions?.title ?? "—"} · ${m.positions?.organizations?.name ?? "—"}`,
        subtitle_refs: [
          posRef(m.positions?.id, m.positions?.title),
          orgRef(m.positions?.organizations?.id, m.positions?.organizations?.name),
        ],
        meta: Array.isArray(m.score_stale_reasons) ? m.score_stale_reasons.join(", ") : "Inputs changed",
        waiting_since: m.score_stale_at,
        key: "score_stale",
        target: { kind: "review" as const, matchId: m.id },
        action_label: "Recompute",
        owner: owner(m.positions?.owner_user_id),
        claim: positionClaim(m.positions?.id),
        tone: "warning" as const,
      })),
    },
    {
      key: "hires_pending",
      label: "Hires confirmed (Total)",
      description: "Candidates currently in the 'hired' stage across the portfolio.",
      count: hiredCount,
      action_hint: "View confirmed hires and start dates.",
      see_all: { to: "/admin/candidates" },
      items: [], // Summary tile only
    },
  ];

  return annotateWithSlaBreaches(queues, opts.includeTest ?? false);
}

/**
 * Overlay live commitment breaches onto the queues so the worst promise is the
 * first thing an operator sees. Severity = whole days past the moment the
 * commitment was first missed; acknowledged breaches stop escalating.
 */
async function annotateWithSlaBreaches(
  queues: WorkQueue[],
  includeTest: boolean,
): Promise<WorkQueue[]> {
  const s = await admin();
  const { loadSlaBreaches } = await import("./admin-sla-breach.server");
  let worstByPosition = new Map<string, { metric_label: string; days_over: number }>();
  try {
    const list = await loadSlaBreaches(s, { includeTest });
    for (const r of (list?.rows ?? [])) {
      if (!r || r.acknowledged) continue;
      const posId = r.position_id;
      if (!posId) continue;
      const current = worstByPosition.get(posId);
      if (!current || r.days_over > current.days_over) {
        worstByPosition.set(posId, {
          metric_label: r.metric_label || "SLA",
          days_over: r.days_over || 0,
        });
      }
    }
  } catch {
    // A breach read failure must not blank the queues; rows simply render
    // without the escalation badge.
    worstByPosition = new Map();
  }
  if (worstByPosition.size === 0) return queues;

  return queues.map((q) => {
    const items = q.items.map((it) => {
      const positionId = it.claim?.kind === "position" ? it.claim.id : null;
      const breach = positionId ? (worstByPosition.get(positionId) ?? null) : null;
      return breach
        ? { ...it, sla_breach: breach, tone: "danger" as const }
        : { ...it, sla_breach: null };
    });
    items.sort((a, b) => {
      const ad = a.sla_breach?.days_over ?? -1;
      const bd = b.sla_breach?.days_over ?? -1;
      if (ad !== bd) return bd - ad;
      const at = a.waiting_since ? new Date(a.waiting_since).getTime() : Infinity;
      const bt = b.waiting_since ? new Date(b.waiting_since).getTime() : Infinity;
      return at - bt;
    });
    return { ...q, items };
  });
}


export type PaymentsOpsPanel = {
  paid: Array<{
    id: string;
    org: string | null;
    position: string | null;
    positionId: string | null;
    amount_cents: number;
    currency: string;
    paid_at: string | null;
    reference: string | null;
    environment: string;
  }>;
  abandoned: Array<{
    positionId: string;
    title: string;
    org: string | null;
    orgId: string;
    started_at: string | null;
    stage: "checkout_started" | "never_started";
  }>;
  pilots: Array<{
    orgId: string;
    org: string;
    status: string | null;
    started_at: string | null;
    ends_at: string | null;
    completed_at: string | null;
    days_left: number | null;
    override: boolean;
    position_title: string | null;
  }>;
  totals: { paid_cents_by_currency: Record<string, number>; paid_count: number };
};

/** Money and pilot state, from records only — no estimates, no placeholders. */
export async function loadPaymentsOpsPanel(): Promise<PaymentsOpsPanel> {
  const s = await admin();

  const [paidRes, abandonedRes, pilotRes] = await Promise.all([
    s
      .from("payments")
      .select(
        "id,amount_cents,currency,paid_at,created_at,provider_reference,provider_environment,organizations(name),positions(id,title)",
      )
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(50),
    s
      .from("positions")
      .select("id,title,organization_id,payment_status,created_at,updated_at,organizations(name)")
      .in("payment_status", ["unpaid", "pending"])
      .not("status", "in", "(draft,archived,closed,filled)")
      .order("updated_at", { ascending: false })
      .limit(50),
    s
      .from("organizations")
      .select(
        "id,name,pilot_status,pilot_started_at,pilot_ends_at,pilot_completed_at,pilot_admin_override,pilot_position_id",
      )
      .not("pilot_status", "is", null)
      .order("pilot_started_at", { ascending: false })
      .limit(50),
  ]);

  const pilotPositionIds = ((pilotRes.data ?? []) as Any[])
    .map((o) => o.pilot_position_id)
    .filter(Boolean);
  let titles: Record<string, string> = {};
  if (pilotPositionIds.length) {
    const { data } = await s.from("positions").select("id,title").in("id", pilotPositionIds);
    titles = Object.fromEntries(((data ?? []) as Any[]).map((p) => [p.id, p.title]));
  }

  const paid = ((paidRes.data ?? []) as Any[]).map((p) => ({
    id: p.id,
    org: p.organizations?.name ?? null,
    position: p.positions?.title ?? null,
    positionId: p.positions?.id ?? null,
    amount_cents: p.amount_cents,
    currency: p.currency,
    paid_at: p.paid_at ?? p.created_at,
    reference: p.provider_reference,
    environment: p.provider_environment,
  }));

  const paid_cents_by_currency: Record<string, number> = {};
  for (const p of paid) {
    const c = (p.currency ?? "usd").toUpperCase();
    paid_cents_by_currency[c] = (paid_cents_by_currency[c] ?? 0) + Number(p.amount_cents ?? 0);
  }

  return {
    paid,
    abandoned: ((abandonedRes.data ?? []) as Any[]).map((p) => ({
      positionId: p.id,
      title: p.title,
      org: p.organizations?.name ?? null,
      orgId: p.organization_id,
      started_at: p.updated_at ?? p.created_at,
      stage: p.payment_status === "pending" ? ("checkout_started" as const) : ("never_started" as const),
    })),
    pilots: ((pilotRes.data ?? []) as Any[]).map((o) => ({
      orgId: o.id,
      org: o.name,
      status: o.pilot_status,
      started_at: o.pilot_started_at,
      ends_at: o.pilot_ends_at,
      completed_at: o.pilot_completed_at,
      days_left: o.pilot_ends_at
        ? Math.ceil((new Date(o.pilot_ends_at).getTime() - Date.now()) / DAY)
        : null,
      override: o.pilot_admin_override === true,
      position_title: o.pilot_position_id ? (titles[o.pilot_position_id] ?? null) : null,
    })),
    totals: { paid_cents_by_currency, paid_count: paid.length },
  };
}

/** Ordered ids of everything awaiting decision, so the reviewer never goes back to a list. */
export async function loadReviewQueueIds(opts: { includeTest?: boolean } = {}): Promise<string[]> {
  const s = await admin();
  const { loadTestScope, excludeTestOrgs } = await import("./admin-test-scope.server");
  const scope = await loadTestScope(s, opts.includeTest ?? false);

  const { data } = await excludeTestOrgs(
    s
      .from("candidate_matches")
      .select("id,updated_at")
      .eq("admin_status", "pending")
      .eq("processing_state", "scored")
      .order("updated_at", { ascending: true })
      .limit(200),
    scope,
  );
  return ((data ?? []) as Any[]).map((m) => m.id as string);
}
