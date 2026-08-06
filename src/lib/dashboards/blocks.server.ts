/**
 * Server-only work behind personalised dashboards.
 *
 * Two responsibilities:
 *  1. Deciding whether an organisation is entitled to dashboards. This is the
 *     commercial boundary, so it is decided here — never in the browser.
 *  2. Loading each block from the records that already exist. Blocks return
 *     null when there is genuinely nothing yet; they never invent a zero.
 */
import { findPlan } from "@/lib/payments-catalog";
import {
  type BlockData,
  type BlockId,
  type BlockResult,
  BLOCK_LIBRARY,
} from "@/lib/dashboards/blocks";

type AnySupabase = {
  from: (t: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: any; error: any }>;
};

export type DashboardEntitlement = {
  allowed: boolean;
  /** Why they have it, or why they do not. */
  reason:
    | "annual_subscription"
    | "staff_grant"
    | "paid_addon"
    | "not_entitled";
  source_label: string | null;
  expires_at: string | null;
};

/**
 * Included on annual subscriptions; otherwise a grant recorded by staff
 * (a negotiated deal, or a paid add-on once the scope is agreed).
 */
export async function resolveDashboardEntitlement(
  supabase: AnySupabase,
  organizationId: string,
): Promise<DashboardEntitlement> {
  const { data: grant } = await supabase
    .from("dashboard_grants")
    .select("source, note, expires_at, starts_at")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (grant) {
    const live = !grant.expires_at || new Date(grant.expires_at).getTime() > Date.now();
    if (live) {
      return {
        allowed: true,
        reason: grant.source === "addon" ? "paid_addon" : "staff_grant",
        source_label:
          grant.source === "addon"
            ? "Paid add-on, scoped with our team"
            : (grant.note ?? "Granted by our team"),
        expires_at: grant.expires_at ?? null,
      };
    }
  }

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("price_id, status, current_period_end")
    .eq("organization_id", organizationId)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sub) {
    const plan = findPlan(sub.price_id);
    if (plan?.interval === "year") {
      return {
        allowed: true,
        reason: "annual_subscription",
        source_label: `Included on ${plan.label}`,
        expires_at: sub.current_period_end ?? null,
      };
    }
  }

  return { allowed: false, reason: "not_entitled", source_label: null, expires_at: null };
}

// ─── Block loaders ──────────────────────────────────────────────────────────

const STAGE_LABEL: Record<string, string> = {
  reviewing: "In review",
  delivered: "With you",
  shortlisted: "Shortlisted",
  interview_process: "Interviewing",
  offer: "Offer",
  hired: "Hired",
  not_moving_forward: "Not moving forward",
};

function days(from: string, to: string) {
  return (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
}

async function pipelineByStage(sb: AnySupabase, org: string): Promise<BlockData | null> {
  const { data } = await sb
    .from("candidate_matches")
    .select("stage")
    .eq("organization_id", org)
    .eq("client_visibility", "visible");
  const rows = (data ?? []) as Array<{ stage: string }>;
  if (rows.length === 0) return null;
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.stage, (counts.get(r.stage) ?? 0) + 1);
  const order = [
    "delivered",
    "shortlisted",
    "interview_process",
    "offer",
    "hired",
    "not_moving_forward",
  ];
  return {
    kind: "series",
    total: rows.length,
    points: order
      .filter((s) => counts.has(s))
      .map((s) => ({
        label: STAGE_LABEL[s] ?? s,
        value: counts.get(s) ?? 0,
        href: "/client/candidates",
      })),
  };
}

async function decisionsWaiting(sb: AnySupabase, org: string): Promise<BlockData | null> {
  const { data } = await sb
    .from("candidate_matches")
    .select("id, delivered_at")
    .eq("organization_id", org)
    .eq("client_visibility", "visible")
    .eq("stage", "delivered")
    .not("delivered_at", "is", null);
  const rows = (data ?? []) as Array<{ delivered_at: string }>;
  if (rows.length === 0) return null;
  const oldest = rows
    .map((r) => days(r.delivered_at, new Date().toISOString()))
    .sort((a, b) => b - a)[0];
  return {
    kind: "stat",
    value: String(rows.length),
    caption: rows.length === 1 ? "candidate waiting on you" : "candidates waiting on you",
    sub: `Longest wait ${Math.max(0, Math.round(oldest))} day${Math.round(oldest) === 1 ? "" : "s"}`,
  };
}

async function timeToShortlist(sb: AnySupabase, org: string): Promise<BlockData | null> {
  const { data: positions } = await sb
    .from("positions")
    .select("id, title, search_live_at, published_at, created_at")
    .eq("organization_id", org)
    .order("created_at", { ascending: false })
    .limit(12);
  const posRows = (positions ?? []) as Array<Record<string, string | null>>;
  if (posRows.length === 0) return null;

  const ids = posRows.map((p) => p.id as string);
  const [{ data: commitments }, { data: matches }] = await Promise.all([
    sb
      .from("position_commitments")
      .select("position_id, first_shortlist_days, baseline_at")
      .in("position_id", ids),
    sb
      .from("candidate_matches")
      .select("position_id, delivered_at")
      .in("position_id", ids)
      .not("delivered_at", "is", null),
  ]);

  const promiseBy = new Map(
    ((commitments ?? []) as Array<Record<string, any>>).map((c) => [c.position_id, c]),
  );
  const firstDelivery = new Map<string, string>();
  for (const m of (matches ?? []) as Array<{ position_id: string; delivered_at: string }>) {
    const cur = firstDelivery.get(m.position_id);
    if (!cur || new Date(m.delivered_at) < new Date(cur)) {
      firstDelivery.set(m.position_id, m.delivered_at);
    }
  }

  const rows = posRows
    .map((p) => {
      const id = p.id as string;
      const commitment = promiseBy.get(id);
      const start = (commitment?.baseline_at ?? p.search_live_at ?? p.published_at) as
        | string
        | undefined;
      if (!start || !commitment) return null;
      const actual = firstDelivery.get(id);
      const promised = Number(commitment.first_shortlist_days);
      if (!actual) {
        const elapsed = Math.round(days(start, new Date().toISOString()));
        return {
          label: String(p.title),
          value: `Day ${elapsed} of ${promised}`,
          note: elapsed > promised ? `${elapsed - promised} days past our promise` : "Still running",
          href: `/client/positions/${id}`,
        };
      }
      const actualDays = Math.round(days(start, actual));
      const variance = actualDays - promised;
      return {
        label: String(p.title),
        value: `${actualDays}d vs ${promised}d promised`,
        note:
          variance <= 0
            ? `${Math.abs(variance)} day${Math.abs(variance) === 1 ? "" : "s"} early`
            : `${variance} day${variance === 1 ? "" : "s"} late`,
        href: `/client/positions/${id}`,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) return null;
  return { kind: "rows", rows };
}

async function offerStatus(sb: AnySupabase, org: string): Promise<BlockData | null> {
  const { data } = await sb
    .from("hire_records")
    .select("id, status, sent_at, updated_at")
    .eq("organization_id", org)
    .not("status", "in", "(hire_confirmed,closed)");
  const rows = (data ?? []) as Array<Record<string, string | null>>;
  if (rows.length === 0) return null;
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(String(r.status), (counts.get(String(r.status)) ?? 0) + 1);
  const stalled = rows.filter((r) => {
    const anchor = r.sent_at ?? r.updated_at;
    return anchor ? days(anchor, new Date().toISOString()) > 2 : false;
  }).length;
  return {
    kind: "series",
    total: rows.length,
    points: [
      ...Array.from(counts.entries()).map(([label, value]) => ({
        label: label.replace(/_/g, " "),
        value,
        href: "/client/offers",
      })),
      ...(stalled > 0
        ? [{ label: "no movement in 48h", value: stalled, href: "/client/offers" }]
        : []),
    ],
  };
}

async function outreachConversion(sb: AnySupabase, org: string): Promise<BlockData | null> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data } = await sb
    .from("outreach_touches")
    .select("id, sent_at, replied_at, direction")
    .eq("organization_id", org)
    .eq("direction", "outbound")
    .gte("created_at", since);
  const rows = (data ?? []) as Array<Record<string, string | null>>;
  const sent = rows.filter((r) => r.sent_at).length;
  if (sent === 0) return null;
  const replied = rows.filter((r) => r.replied_at).length;
  return {
    kind: "series",
    total: sent,
    points: [
      { label: "Approaches sent", value: sent, href: "/client/outreach" },
      { label: "Replies", value: replied, href: "/client/outreach" },
      { label: "Reply rate %", value: Math.round((replied / sent) * 100) },
    ],
  };
}

async function spendPerHire(sb: AnySupabase, org: string): Promise<BlockData | null> {
  const [{ data: payments }, { data: hires }] = await Promise.all([
    sb.from("payments").select("amount_cents, currency, status").eq("organization_id", org),
    sb.from("hire_records").select("id").eq("organization_id", org).eq("status", "hire_confirmed"),
  ]);
  const paid = ((payments ?? []) as Array<Record<string, any>>).filter((p) => p.status === "paid");
  if (paid.length === 0) return null;
  const total = paid.reduce((sum, p) => sum + Number(p.amount_cents ?? 0), 0) / 100;
  const currency = String(paid[0].currency ?? "gbp").toUpperCase();
  const hireCount = ((hires ?? []) as unknown[]).length;
  const fmt = (n: number) =>
    `${currency === "GBP" ? "£" : currency === "USD" ? "$" : `${currency} `}${Math.round(n).toLocaleString()}`;
  if (hireCount === 0) {
    return {
      kind: "stat",
      value: fmt(total),
      caption: "invested so far",
      sub: "No confirmed hire yet, so there is no per-hire figure to show.",
    };
  }
  return {
    kind: "stat",
    value: fmt(total / hireCount),
    caption: "per confirmed hire",
    sub: `${fmt(total)} across ${hireCount} hire${hireCount === 1 ? "" : "s"}`,
  };
}

async function talentPoolGrowth(sb: AnySupabase, org: string): Promise<BlockData | null> {
  const since = new Date(Date.now() - 56 * 86_400_000).toISOString();
  const { data } = await sb
    .from("candidate_matches")
    .select("created_at")
    .eq("organization_id", org)
    .gte("created_at", since);
  const rows = (data ?? []) as Array<{ created_at: string }>;
  if (rows.length === 0) return null;
  const buckets = new Array(8).fill(0);
  for (const r of rows) {
    const weeksAgo = Math.floor(days(r.created_at, new Date().toISOString()) / 7);
    const idx = 7 - Math.min(7, Math.max(0, weeksAgo));
    buckets[idx] += 1;
  }
  return {
    kind: "series",
    total: rows.length,
    points: buckets.map((value, i) => ({
      label: i === 7 ? "This week" : `${7 - i}w ago`,
      value,
    })),
  };
}

async function teamActivity(sb: AnySupabase, org: string): Promise<BlockData | null> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data: members }, { data: history }] = await Promise.all([
    sb
      .from("memberships")
      .select("user_id, role, profiles:user_id(full_name, email)")
      .eq("organization_id", org)
      .eq("status", "active"),
    sb
      .from("candidate_stage_history")
      .select("actor_user_id, created_at")
      .eq("organization_id", org)
      .gte("created_at", since),
  ]);
  const memberRows = (members ?? []) as Array<Record<string, any>>;
  if (memberRows.length === 0) return null;
  const counts = new Map<string, number>();
  for (const h of (history ?? []) as Array<Record<string, any>>) {
    if (!h.actor_user_id) continue;
    counts.set(h.actor_user_id, (counts.get(h.actor_user_id) ?? 0) + 1);
  }
  return {
    kind: "rows",
    rows: memberRows.map((m) => {
      const n = counts.get(m.user_id) ?? 0;
      return {
        label: m.profiles?.full_name ?? m.profiles?.email ?? "Team member",
        value: `${n} decision${n === 1 ? "" : "s"}`,
        note: String(m.role).replace(/_/g, " "),
        href: "/client/account?tab=team",
      };
    }),
  };
}

const LOADERS: Record<BlockId, (sb: AnySupabase, org: string) => Promise<BlockData | null>> = {
  pipeline_by_stage: pipelineByStage,
  decisions_waiting: decisionsWaiting,
  time_to_shortlist: timeToShortlist,
  offer_status: offerStatus,
  outreach_conversion: outreachConversion,
  spend_per_hire: spendPerHire,
  talent_pool_growth: talentPoolGrowth,
  team_activity: teamActivity,
};

export async function loadBlocks(
  supabase: AnySupabase,
  organizationId: string,
  blockIds: BlockId[],
): Promise<BlockResult[]> {
  return Promise.all(
    blockIds.map(async (id): Promise<BlockResult> => {
      try {
        const data = await LOADERS[id](supabase, organizationId);
        return { id, data };
      } catch {
        return {
          id,
          data: null,
          unavailable: `We could not read ${BLOCK_LIBRARY[id].title.toLowerCase()} just now. Nothing is lost — try again shortly.`,
        };
      }
    }),
  );
}
