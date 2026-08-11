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
import type { QueueClaim, QueueItem, QueueOwner, WorkQueue } from "./admin-ops-types";
import { PAID_PAYMENT_STATES } from "@/lib/publish-gate";


const ISO = (ms: number) => new Date(Date.now() - ms).toISOString();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function ageTone(iso: string | null, warnDays: number, dangerDays: number): QueueItem["tone"] {
  if (!iso) return "default";
  const days = (Date.now() - new Date(iso).getTime()) / DAY;
  if (days >= dangerDays) return "danger";
  if (days >= warnDays) return "warning";
  return "default";
}

/** The operator queues, each with an exact count and one direct action. */
export async function loadWorkQueues(opts: { includeTest?: boolean } = {}): Promise<WorkQueue[]> {
  const s = await admin();
  const { loadTestScope, excludeTestOrgs, loadAgingIntakes } = await import(
    "./admin-test-scope.server"
  );
  const scope = await loadTestScope(s, opts.includeTest ?? false);

  const [unpaid, setup, review, delivered, interviews, blocked, aging] = await Promise.all([
    // 1 — submitted roles that have not been paid for (or are stuck mid-checkout).
    excludeTestOrgs(
      s
        .from("positions")
        .select("id,title,status,payment_status,owner_user_id,created_at,updated_at,organizations(name)", {
          count: "exact",
        })
        .in("payment_status", ["unpaid", "pending"])
        .not("status", "in", "(archived,closed,filled)")
        .order("updated_at", { ascending: true })
        .limit(8),
      scope,
    ),

    // 2 — paid, exempt or plan-covered roles still waiting on platform setup.
    excludeTestOrgs(
      s
        .from("positions")
        .select("id,title,status,payment_status,owner_user_id,created_at,organizations(name)", { count: "exact" })
        .in("status", ["submitted", "needs_clarification"])
        .in("payment_status", [...PAID_PAYMENT_STATES])
        .order("created_at", { ascending: true })

        .limit(8),
      scope,
    ),

    // 3 — scored candidates awaiting an admin decision.
    excludeTestOrgs(
      s
        .from("candidate_matches")
        .select(
          "id,updated_at,processing_state,candidate_profiles(full_name),positions(id,title,owner_user_id,organizations(name)),score_runs!candidate_matches_current_score_run_id_fkey(score)",
          { count: "exact" },
        )
        .eq("admin_status", "pending")
        .eq("processing_state", "scored")
        .order("updated_at", { ascending: true })
        .limit(8),
      scope,
    ),

    // 4 — shared with the client, no decision recorded yet.
    excludeTestOrgs(
      s
        .from("candidate_matches")
        .select(
          "id,updated_at,stage,candidate_profiles(full_name),positions(id,title,owner_user_id,organizations(name)),client_decisions(id)",
          { count: "exact" },
        )
        .eq("client_visibility", "visible")
        .in("stage", ["delivered", "shortlisted", "reviewing"])
        .lt("updated_at", ISO(3 * DAY))
        .order("updated_at", { ascending: true })
        .limit(20),
      scope,
    ),

    // 5 — interviews requested, or happening in the next 48h.
    excludeTestOrgs(
      s
        .from("interviews")
        .select(
          "id,status,requested_at,scheduled_at,candidate_match_id,candidate_matches(candidate_profiles(full_name),positions(id,title,owner_user_id,organizations(name)))",
          { count: "exact" },
        )
        .or(
          `status.eq.requested,and(status.eq.scheduled,scheduled_at.lte.${new Date(Date.now() + 48 * HOUR).toISOString()})`,
        )
        .order("requested_at", { ascending: true })
        .limit(8),
      scope,
    ),

    // Bonus — pipeline incidents that stop everything else.
    excludeTestOrgs(
      s
        .from("candidate_matches")
        .select(
          "id,processing_state,processing_error_code,processing_updated_at,candidate_profiles(full_name),positions(id,title,owner_user_id,organizations(name))",
          { count: "exact" },
        )
        .in("processing_state", [
          "failed",
          "provider_blocked",
          "ocr_required",
          "manual_review_required",
        ])
        .order("processing_updated_at", { ascending: true })
        .limit(8),
      scope,
    ),

    // 6 — real client briefs sitting in the inbox for more than three days.
    loadAgingIntakes(s, { includeTest: opts.includeTest ?? false, olderThanDays: 3, limit: 8 }),
  ]);


  const overdue = ((delivered.data ?? []) as Any[]).filter(
    (m) => !(m.client_decisions ?? []).length,
  );

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
  for (const m of overdue) addOwner(m.positions?.owner_user_id);
  for (const iv of (interviews.data ?? []) as Any[])
    addOwner(iv.candidate_matches?.positions?.owner_user_id);
  for (const m of (blocked.data ?? []) as Any[]) addOwner(m.positions?.owner_user_id);
  for (const i of agingIntakes.items) addOwner(i.owner_user_id);

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
  const owner = (id: unknown): QueueOwner =>
    typeof id === "string" && id
      ? { user_id: id, name: ownerName.get(id) ?? "Unknown staff" }
      : null;
  const positionClaim = (id: unknown): QueueClaim =>
    typeof id === "string" && id ? { kind: "position" as const, id } : null;

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
        subtitle: p.organizations?.name ?? "—",
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
      items: ((setup.data ?? []) as Any[]).map((p) => ({
        id: p.id,
        title: p.title,
        subtitle: p.organizations?.name ?? "—",
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
      label: "Candidates awaiting review",
      description: "Scored and waiting on an approve or reject decision.",
      count: review.count ?? 0,
      action_hint: "Review on one screen: evidence, CV and requirements together.",
      see_all: { to: "/admin/candidates" },
      items: ((review.data ?? []) as Any[]).map((m) => ({
        id: m.id,
        title: m.candidate_profiles?.full_name ?? "Candidate",
        subtitle: `${m.positions?.title ?? "—"} · ${m.positions?.organizations?.name ?? "—"}`,
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
      description: "Shared with the client three or more days ago, still no decision.",
      count: overdue.length,
      action_hint: "Nudge the client or call it — the candidate is waiting.",
      see_all: { to: "/admin/messages" },
      items: overdue.slice(0, 8).map((m) => ({
        id: m.id,
        title: m.candidate_profiles?.full_name ?? "Candidate",
        subtitle: `${m.positions?.title ?? "—"} · ${m.positions?.organizations?.name ?? "—"}`,
        meta: String(m.stage).replace(/_/g, " "),
        waiting_since: m.updated_at,
        target: { kind: "match" as const, id: m.id },
        action_label: "Chase decision",
        owner: owner(m.positions?.owner_user_id),
        claim: positionClaim(m.positions?.id),
        tone: ageTone(m.updated_at, 5, 8),
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
      key: "blocked",
      label: "Blocked in processing",
      description: "Parse, OCR or provider incidents holding candidates back.",
      count: blocked.count ?? 0,
      action_hint: "Retry the step or resolve the incident.",
      see_all: { to: "/admin/operations" },
      items: ((blocked.data ?? []) as Any[]).map((m) => ({
        id: m.id,
        title: m.candidate_profiles?.full_name ?? "Candidate",
        subtitle: `${m.positions?.title ?? "—"} · ${m.positions?.organizations?.name ?? "—"}`,
        meta: (m.processing_error_code ?? m.processing_state ?? "").replace(/_/g, " "),
        waiting_since: m.processing_updated_at,
        target: { kind: "match" as const, id: m.id },
        action_label: "Fix",
        owner: owner(m.positions?.owner_user_id),
        claim: positionClaim(m.positions?.id),
        tone: "danger" as const,
      })),
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
    for (const r of list.rows) {
      if (r.acknowledged) continue;
      const current = worstByPosition.get(r.position_id);
      if (!current || r.days_over > current.days_over) {
        worstByPosition.set(r.position_id, {
          metric_label: r.metric_label,
          days_over: r.days_over,
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
      .not("status", "in", "(archived,closed,filled)")
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

/** Ordered ids of everything awaiting review, so the reviewer never goes back to a list. */
export async function loadReviewQueueIds(): Promise<string[]> {
  const s = await admin();
  const { data } = await s
    .from("candidate_matches")
    .select("id,updated_at")
    .eq("admin_status", "pending")
    .eq("processing_state", "scored")
    .order("updated_at", { ascending: true })
    .limit(200);
  return ((data ?? []) as Any[]).map((m) => m.id as string);
}
