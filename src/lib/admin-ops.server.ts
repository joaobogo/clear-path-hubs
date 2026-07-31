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

export type QueueItem = {
  id: string;
  title: string;
  subtitle: string;
  meta: string | null;
  waiting_since: string | null;
  /** Route + params for the single direct action. */
  to: string;
  params: Record<string, string>;
  action_label: string;
  tone: "default" | "warning" | "danger";
};

export type WorkQueue = {
  key: string;
  label: string;
  description: string;
  count: number;
  action_hint: string;
  items: QueueItem[];
  see_all?: { to: string };
};

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

/** The five operator queues, each with an exact count and one direct action. */
export async function loadWorkQueues(): Promise<WorkQueue[]> {
  const s = await admin();

  const [unpaid, setup, review, delivered, interviews, blocked] = await Promise.all([
    // 1 — submitted roles that have not been paid for (or are stuck mid-checkout).
    s
      .from("positions")
      .select("id,title,status,payment_status,created_at,updated_at,organizations(name)", {
        count: "exact",
      })
      .in("payment_status", ["unpaid", "pending"])
      .not("status", "in", "(archived,closed,filled)")
      .order("updated_at", { ascending: true })
      .limit(8),

    // 2 — paid or exempt roles still waiting on platform setup.
    s
      .from("positions")
      .select("id,title,status,payment_status,created_at,organizations(name)", { count: "exact" })
      .in("status", ["submitted", "needs_clarification"])
      .in("payment_status", ["paid", "exempt"])
      .order("created_at", { ascending: true })
      .limit(8),

    // 3 — scored candidates awaiting an admin decision.
    s
      .from("candidate_matches")
      .select(
        "id,updated_at,processing_state,candidate_profiles(full_name),positions(title,organizations(name)),score_runs!candidate_matches_current_score_run_id_fkey(score)",
        { count: "exact" },
      )
      .eq("admin_status", "pending")
      .eq("processing_state", "scored")
      .order("updated_at", { ascending: true })
      .limit(8),

    // 4 — shared with the client, no decision recorded yet.
    s
      .from("candidate_matches")
      .select(
        "id,updated_at,stage,candidate_profiles(full_name),positions(title,organizations(name)),client_decisions(id)",
        { count: "exact" },
      )
      .eq("client_visibility", "visible")
      .in("stage", ["delivered", "shortlisted", "reviewing"])
      .lt("updated_at", ISO(3 * DAY))
      .order("updated_at", { ascending: true })
      .limit(20),

    // 5 — interviews requested, or happening in the next 48h.
    s
      .from("interviews")
      .select(
        "id,status,requested_at,scheduled_at,candidate_match_id,candidate_matches(candidate_profiles(full_name),positions(title,organizations(name)))",
        { count: "exact" },
      )
      .or(
        `status.eq.requested,and(status.eq.scheduled,scheduled_at.lte.${new Date(Date.now() + 48 * HOUR).toISOString()})`,
      )
      .order("requested_at", { ascending: true })
      .limit(8),

    // Bonus — pipeline incidents that stop everything else.
    s
      .from("candidate_matches")
      .select(
        "id,processing_state,processing_error_code,processing_updated_at,candidate_profiles(full_name),positions(title,organizations(name))",
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
  ]);

  const overdue = ((delivered.data ?? []) as Any[]).filter(
    (m) => !(m.client_decisions ?? []).length,
  );

  return [
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
        to: "/admin/positions/$id",
        params: { id: p.id },
        action_label: "Resolve payment",
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
        to: "/admin/positions/$id",
        params: { id: p.id },
        action_label: "Set up role",
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
        to: "/admin/review/$matchId",
        params: { matchId: m.id },
        action_label: "Review",
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
        to: "/admin/candidates/$id",
        params: { id: m.id },
        action_label: "Chase decision",
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
        to: "/admin/candidates/$id",
        params: { id: iv.candidate_match_id },
        action_label: "Coordinate",
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
        to: "/admin/candidates/$id",
        params: { id: m.id },
        action_label: "Fix",
        tone: "danger" as const,
      })),
    },
  ];
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
