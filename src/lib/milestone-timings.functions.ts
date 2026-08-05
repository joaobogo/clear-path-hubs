// Time-to-milestone reporting for /admin/operations.
// Reads the canonical timing views (v_position_time_to_submission and
// v_match_milestone_timings) and aggregates them with the pure statistics in
// milestone-timings.ts, so every figure carries its own sample size.
// Staff-gated. Test/internal organizations are excluded by default.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  buildSegment,
  emptyValues,
  type MilestoneKey,
  type TimingSegment,
} from "./milestone-timings";
import { loadTestScope } from "./admin-test-scope.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AnyRow;
}

async function requireStaff(userId: string) {
  const s = await getAdmin();
  const { data } = await s.rpc("is_platform_staff", { _user: userId });
  if (data !== true) throw new Error("forbidden");
}

export type MilestoneTimingReport = {
  period_days: number;
  from: string;
  overall: TimingSegment;
  by_client: TimingSegment[];
  by_role_family: TimingSegment[];
  /** Segments that exist but had no milestone reach the minimum sample. */
  suppressed_segments: number;
};

const input = z.object({
  period_days: z.union([z.literal(30), z.literal(90), z.literal(180), z.literal(365)]).default(90),
  include_test: z.boolean().default(false),
});

/**
 * Median + interquartile days per milestone for the period, segmented by client
 * and by role family. Segmentation is computed from the same rows as the
 * overall figures, so the two always reconcile.
 */
export const getMilestoneTimingReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => input.parse(i ?? {}))
  .handler(async ({ data, context }): Promise<MilestoneTimingReport> => {
    await requireStaff(context.userId);
    const s = await getAdmin();

    const from = new Date(Date.now() - data.period_days * 86_400_000).toISOString();
    const scope = await loadTestScope(s, data.include_test);
    const excludedOrgs = new Set(scope.orgIds);

    // Milestone completion is dated by the *end* of each interval, so a role
    // only enters the period once the milestone actually finished.
    const [posRes, matchRes] = await Promise.all([
      s
        .from("v_position_time_to_submission")
        .select(
          "position_id, organization_id, position_title, role_family, first_delivered_at, days_intake_to_first_submission",
        )
        .not("days_intake_to_first_submission", "is", null)
        .gte("first_delivered_at", from)
        .limit(5000),
      s
        .from("v_match_milestone_timings")
        .select(
          "match_id, organization_id, position_id, position_title, role_family, decided_at, first_scheduled_at, offer_sent_at, start_date, days_submission_to_decision, days_decision_to_interview, days_interview_to_offer, days_offer_to_start",
        )
        .or(
          "days_submission_to_decision.not.is.null,days_decision_to_interview.not.is.null,days_interview_to_offer.not.is.null,days_offer_to_start.not.is.null",
        )
        .limit(20000),
    ]);
    if (posRes.error) throw new Error(posRes.error.message);
    if (matchRes.error) throw new Error(matchRes.error.message);

    const orgNames = new Map<string, string>();
    const orgIds = new Set<string>();
    for (const r of [...(posRes.data ?? []), ...(matchRes.data ?? [])] as AnyRow[]) {
      if (r.organization_id) orgIds.add(r.organization_id as string);
    }
    if (orgIds.size > 0) {
      const { data: orgs } = await s
        .from("organizations")
        .select("id, name")
        .in("id", [...orgIds])
        .limit(1000);
      for (const o of (orgs ?? []) as AnyRow[]) orgNames.set(o.id as string, o.name as string);
    }

    type Bucket = { values: Record<MilestoneKey, number[]>; positions: string[]; label: string };
    const overall: Bucket = { values: emptyValues(), positions: [], label: "All delivery" };
    const clients = new Map<string, Bucket>();
    const families = new Map<string, Bucket>();

    function bucket(map: Map<string, Bucket>, id: string, label: string): Bucket {
      let b = map.get(id);
      if (!b) {
        b = { values: emptyValues(), positions: [], label };
        map.set(id, b);
      }
      return b;
    }

    function record(
      key: MilestoneKey,
      days: unknown,
      row: AnyRow,
      completedAt: string | null | undefined,
    ) {
      const value = typeof days === "number" ? days : Number(days);
      if (!Number.isFinite(value) || value < 0) return;
      if (excludedOrgs.has(row.organization_id as string)) return;
      // Each interval is dated by its own completion moment.
      if (!completedAt || completedAt < from) return;
      const positionId = row.position_id as string;
      overall.values[key].push(value);
      overall.positions.push(positionId);
      const org = (row.organization_id as string) ?? "unknown";
      const cb = bucket(clients, org, orgNames.get(org) ?? "Unknown client");
      cb.values[key].push(value);
      cb.positions.push(positionId);
      const fam = ((row.role_family as string) ?? "other") || "other";
      const fb = bucket(families, fam, fam.replace(/_/g, " "));
      fb.values[key].push(value);
      fb.positions.push(positionId);
    }

    for (const r of (posRes.data ?? []) as AnyRow[]) {
      record("intake_to_first_submission", r.days_intake_to_first_submission, r, r.first_delivered_at);
    }
    for (const r of (matchRes.data ?? []) as AnyRow[]) {
      record("submission_to_decision", r.days_submission_to_decision, r, r.decided_at);
      record("decision_to_interview", r.days_decision_to_interview, r, r.first_scheduled_at);
      record("interview_to_offer", r.days_interview_to_offer, r, r.offer_sent_at);
      record(
        "offer_to_start",
        r.days_offer_to_start,
        r,
        r.start_date ? new Date(`${r.start_date}T00:00:00Z`).toISOString() : null,
      );
    }

    const toSegments = (map: Map<string, Bucket>) =>
      [...map.entries()]
        .map(([id, b]) => buildSegment(id, b.label, b.values, b.positions))
        .sort((a, b) => b.total_instances - a.total_instances);

    const clientSegments = toSegments(clients);
    const familySegments = toSegments(families);
    const reportable = (seg: TimingSegment) => seg.stats.some((st) => !st.suppressed);
    const suppressed =
      clientSegments.filter((s2) => !reportable(s2)).length +
      familySegments.filter((s2) => !reportable(s2)).length;

    return {
      period_days: data.period_days,
      from,
      overall: buildSegment("overall", overall.label, overall.values, overall.positions),
      // Only segments with at least one reportable milestone are returned —
      // low-sample segments are suppressed, not shown with a caveat.
      by_client: clientSegments.filter(reportable),
      by_role_family: familySegments.filter(reportable),
      suppressed_segments: suppressed,
    };
  });
