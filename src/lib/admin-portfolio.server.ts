/**
 * Portfolio health for the admin overview.
 *
 * Every number here is derived from existing tables — positions,
 * candidate_matches, client_decisions, subscriptions — plus the canonical
 * `v_portfolio_rollup` view for open/filled position counts. No score out of
 * 100, no trend, no invented benchmark: each column is a raw count or an age in
 * days that an operator can verify by opening the account.
 *
 * "Submitted candidate" means a candidate_match that has been delivered to the
 * client (`delivered_at` is set) — the same definition the client workspace
 * uses. A pending client decision is a delivered match still sitting in the
 * `delivered` stage, i.e. waiting on the client to act.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const DAY = 86_400_000;

/** Positions that are live work for the delivery team. */
const OPEN_POSITION_STATUSES = [
  "submitted",
  "under_review",
  "needs_clarification",
  "approved",
  "active",
  "paused",
] as const;

export type HealthBand = "at_risk" | "watch" | "healthy";

export type PortfolioHealthRow = {
  organization_id: string;
  organization_name: string;
  plan_label: string | null;
  subscription_state: string | null;
  open_positions: number;
  positions_without_submissions: number;
  oldest_open_position_days: number | null;
  submissions_last_7_days: number;
  pending_client_decisions: number;
  days_since_client_visible_activity: number | null;
  is_test_record: boolean;
  /** Live, unacknowledged commitment breaches for this account (P-x defect 5). */
  sla_breaches: number;
  /** Worst breach age in days across those commitments. */
  worst_sla_days_over: number | null;
  band: HealthBand;
  /** Human-readable reasons the band was assigned. Never colour-only. */
  band_reasons: string[];
};

export type PortfolioHealth = {
  rows: PortfolioHealthRow[];
  include_test: boolean;
  generated_at: string;
};

/** Thresholds are stated on the surface so the band is auditable. */
export const HEALTH_RULES = {
  stale_position_days: { at_risk: 14, watch: 7 },
  pending_decisions: { at_risk: 5, watch: 3 },
  quiet_days: { at_risk: 10, watch: 5 },
} as const;

function band(row: Omit<PortfolioHealthRow, "band" | "band_reasons">): {
  band: HealthBand;
  band_reasons: string[];
} {
  const R = HEALTH_RULES;
  const atRisk: string[] = [];
  const watch: string[] = [];

  // A promised commitment that is already missed outranks every other signal:
  // an account with a live breach can never read Healthy.
  if (row.sla_breaches > 0) {
    const days = row.worst_sla_days_over ?? 0;
    atRisk.push(
      `${row.sla_breaches} breached commitment${row.sla_breaches === 1 ? "" : "s"}${
        days > 0 ? `, worst ${days} day${days === 1 ? "" : "s"} over` : ""
      }`,
    );
  }

  const staleAge = row.positions_without_submissions > 0 ? row.oldest_open_position_days : null;
  if (staleAge !== null) {
    if (staleAge > R.stale_position_days.at_risk) {
      atRisk.push(`Open position with no submitted candidates, ${staleAge} days old`);
    } else if (staleAge > R.stale_position_days.watch) {
      watch.push(`Open position with no submitted candidates, ${staleAge} days old`);
    }
  }

  if (row.pending_client_decisions > R.pending_decisions.at_risk) {
    atRisk.push(`${row.pending_client_decisions} candidates waiting on a client decision`);
  } else if (row.pending_client_decisions > R.pending_decisions.watch) {
    watch.push(`${row.pending_client_decisions} candidates waiting on a client decision`);
  }

  const quiet = row.days_since_client_visible_activity;
  if (quiet !== null) {
    if (quiet >= R.quiet_days.at_risk) {
      atRisk.push(`No client-visible activity for ${quiet} days`);
    } else if (quiet >= R.quiet_days.watch) {
      watch.push(`No client-visible activity for ${quiet} days`);
    }
  }

  if (atRisk.length) return { band: "at_risk", band_reasons: atRisk };
  if (watch.length) return { band: "watch", band_reasons: watch };
  return { band: "healthy", band_reasons: ["No stalled positions, backlog or silence"] };
}

const daysSince = (iso: string | null): number | null =>
  iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY)) : null;

export async function loadPortfolioHealth(
  supabase: Any,
  opts: { includeTest?: boolean } = {},
): Promise<PortfolioHealth> {
  const includeTest = opts.includeTest ?? false;

  // 1. Open positions define the portfolio: an account with no open position is
  //    not today's work, so it is not a row.
  const { data: positionRows, error: positionError } = await supabase
    .from("positions")
    .select("id, organization_id, status, created_at")
    .in("status", OPEN_POSITION_STATUSES as unknown as string[])
    .limit(5000);
  if (positionError) throw new Error(`Could not read positions: ${positionError.message}`);

  const positions = (positionRows ?? []) as Any[];
  const orgIds = Array.from(
    new Set(positions.map((p) => p.organization_id as string).filter(Boolean)),
  );
  if (orgIds.length === 0) {
    return { rows: [], include_test: includeTest, generated_at: new Date().toISOString() };
  }

  // Live commitment breaches, so the rollup cannot contradict the SLA panel.
  const slaByOrg = new Map<string, { count: number; worst: number }>();
  try {
    const { loadSlaBreaches } = await import("./admin-sla-breach.server");
    const list = await loadSlaBreaches(supabase as never, { includeTest });
    for (const r of list?.rows ?? []) {
      if (!r || r.acknowledged || !r.organization_id) continue;
      const cur = slaByOrg.get(r.organization_id) ?? { count: 0, worst: 0 };
      cur.count += 1;
      cur.worst = Math.max(cur.worst, r.days_over ?? 0);
      slaByOrg.set(r.organization_id, cur);
    }
  } catch {
    // A breach read failure must not blank the table; bands fall back to the
    // pipeline signals only.
    slaByOrg.clear();
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * DAY).toISOString();

  const [orgsRes, rollupRes, matchesRes, decisionsRes, subsRes] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, status, plan_name, is_test_record")
      .in("id", orgIds),
    supabase
      .from("v_portfolio_rollup")
      .select("organization_id, open_positions")
      .in("organization_id", orgIds),
    supabase
      .from("candidate_matches")
      .select("id, organization_id, position_id, stage, delivered_at, updated_at")
      .in("organization_id", orgIds)
      .not("delivered_at", "is", null)
      .limit(20000),
    supabase
      .from("client_decisions")
      .select("id, organization_id, created_at")
      .in("organization_id", orgIds)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("subscriptions")
      .select("organization_id, plan_label, status, updated_at")
      .in("organization_id", orgIds),
  ]);

  for (const [label, res] of [
    ["organizations", orgsRes],
    ["portfolio rollup", rollupRes],
    ["candidate submissions", matchesRes],
    ["client decisions", decisionsRes],
    ["subscriptions", subsRes],
  ] as const) {
    if (res.error) throw new Error(`Could not read ${label}: ${res.error.message}`);
  }

  const orgs = ((orgsRes.data ?? []) as Any[]).filter(
    (o) => includeTest || o.is_test_record !== true,
  );
  const matches = (matchesRes.data ?? []) as Any[];
  const decisions = (decisionsRes.data ?? []) as Any[];
  const subs = (subsRes.data ?? []) as Any[];
  const rollup = new Map<string, number>(
    ((rollupRes.data ?? []) as Any[]).map((r) => [
      r.organization_id as string,
      Number(r.open_positions ?? 0),
    ]),
  );

  const positionsWithSubmission = new Set(matches.map((m) => m.position_id as string));

  const rows: PortfolioHealthRow[] = orgs.map((org) => {
    const orgPositions = positions.filter((p) => p.organization_id === org.id);
    const orgMatches = matches.filter((m) => m.organization_id === org.id);
    const orgDecisions = decisions.filter((d) => d.organization_id === org.id);
    const sub = subs.find((s) => s.organization_id === org.id) ?? null;

    const withoutSubmissions = orgPositions.filter((p) => !positionsWithSubmission.has(p.id));
    // Oldest age is reported for the stalled positions when there are any,
    // otherwise for the oldest open position — the rule reads the first case.
    const ageSource = withoutSubmissions.length ? withoutSubmissions : orgPositions;
    const oldestCreatedAt = ageSource.reduce<string | null>(
      (acc, p) => (!acc || String(p.created_at) < acc ? (p.created_at as string) : acc),
      null,
    );

    const lastActivity = [
      ...orgMatches.map((m) => (m.delivered_at as string) ?? null),
      ...orgDecisions.map((d) => (d.created_at as string) ?? null),
    ].reduce<string | null>((acc, iso) => (iso && (!acc || iso > acc) ? iso : acc), null);

    const base = {
      organization_id: org.id as string,
      organization_name: (org.name as string) ?? "Unnamed account",
      plan_label: (sub?.plan_label as string) ?? (org.plan_name as string) ?? null,
      subscription_state: (sub?.status as string) ?? (org.status as string) ?? null,
      open_positions: rollup.get(org.id as string) ?? orgPositions.length,
      positions_without_submissions: withoutSubmissions.length,
      oldest_open_position_days: daysSince(oldestCreatedAt),
      submissions_last_7_days: orgMatches.filter(
        (m) => (m.delivered_at as string) >= sevenDaysAgo,
      ).length,
      pending_client_decisions: orgMatches.filter((m) => m.stage === "delivered").length,
      days_since_client_visible_activity: daysSince(lastActivity),
      is_test_record: org.is_test_record === true,
      sla_breaches: slaByOrg.get(org.id as string)?.count ?? 0,
      worst_sla_days_over: slaByOrg.get(org.id as string)?.worst ?? null,
    };

    return { ...base, ...band(base) };
  });

  const BAND_ORDER: Record<HealthBand, number> = { at_risk: 0, watch: 1, healthy: 2 };
  rows.sort(
    (a, b) =>
      BAND_ORDER[a.band] - BAND_ORDER[b.band] ||
      a.organization_name.localeCompare(b.organization_name),
  );

  return { rows, include_test: includeTest, generated_at: new Date().toISOString() };
}
