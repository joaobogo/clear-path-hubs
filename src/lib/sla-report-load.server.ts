/**
 * Loads the measured commitment performance for one organisation (optionally a
 * single role).
 *
 * This is the one measurement path. Both client surfaces read it: the Overview
 * scorecard renders it per role, and the Account plan table rolls it up. Names
 * and targets come from `@/lib/commitments/canonical`, so neither surface can
 * word the same stored number differently.
 */
import {
  addDays,
  amountLabel,
  diffDays,
  worstState,
  type RoleSla,
  type SlaMetric,
  type SlaSummary,
} from "@/lib/sla";
import { dayMetric, emptySummary, interviewSlotMetric, summarise } from "@/lib/sla-report.server";
import {
  COMMITMENT_LABEL,
  firstCandidatePromise,
  shortlistLabel,
  shortlistPromise,
} from "@/lib/commitments/canonical";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export type SlaPerformance = { roles: RoleSla[]; summary: SlaSummary };

export async function loadSlaPerformance(
  supabase: AnyClient,
  orgId: string,
  positionId?: string,
): Promise<SlaPerformance> {
  let commitmentsQuery = supabase
    .from("position_commitments")
    .select("position_id, first_shortlist_days, shortlist_size, interview_slots_hours, baseline_at")
    .eq("organization_id", orgId);
  if (positionId) commitmentsQuery = commitmentsQuery.eq("position_id", positionId);
  const { data: commitments, error } = await commitmentsQuery;
  if (error) throw new Error(error.message);

  const rows = (commitments as AnyRow[]) ?? [];
  if (rows.length === 0) return { roles: [], summary: emptySummary() };

  const positionIds = rows.map((r) => r.position_id as string);

  const { data: positions } = await supabase
    .from("positions")
    .select("id, title, status")
    .in("id", positionIds);
  const positionById = new Map<string, AnyRow>(
    ((positions as AnyRow[]) ?? []).map((p) => [p.id, p]),
  );

  const { data: matches } = await supabase
    .from("candidate_matches")
    .select("position_id, delivered_at")
    .eq("organization_id", orgId)
    .eq("client_visibility", "visible")
    .in("position_id", positionIds)
    .not("delivered_at", "is", null);
  const deliveriesByPosition = new Map<string, string[]>();
  for (const m of (matches as AnyRow[]) ?? []) {
    const list = deliveriesByPosition.get(m.position_id) ?? [];
    list.push(m.delivered_at as string);
    deliveriesByPosition.set(m.position_id, list);
  }
  for (const list of deliveriesByPosition.values()) list.sort();

  const { data: interviews } = await supabase
    .from("interviews")
    .select("position_id, requested_at, created_at, scheduled_at, proposed_times, updated_at")
    .eq("organization_id", orgId)
    .in("position_id", positionIds);
  const interviewsByPosition = new Map<string, AnyRow[]>();
  for (const iv of (interviews as AnyRow[]) ?? []) {
    if (!iv.position_id) continue;
    const list = interviewsByPosition.get(iv.position_id) ?? [];
    list.push(iv);
    interviewsByPosition.set(iv.position_id, list);
  }

  const now = Date.now();
  const roles: RoleSla[] = rows
    .filter((r) => positionById.has(r.position_id))
    .map((r) => {
      const position = positionById.get(r.position_id)!;
      const baselineAt = r.baseline_at as string;
      const deliveries = deliveriesByPosition.get(r.position_id) ?? [];
      const metrics: SlaMetric[] = [];

      // 1 · First candidate in front of you
      const firstDue = addDays(baselineAt, r.first_shortlist_days);
      metrics.push(
        dayMetric({
          key: "first_candidate",
          label: COMMITMENT_LABEL.first_candidate,
          promise: firstCandidatePromise(Number(r.first_shortlist_days)),
          baselineAt,
          dueAt: firstDue,
          actualAt: deliveries[0] ?? null,
          now,
        }),
      );

      // 2 · A full shortlist
      const shortlistDue = addDays(baselineAt, r.first_shortlist_days);
      const shortlistActual =
        deliveries.length >= r.shortlist_size ? deliveries[r.shortlist_size - 1] : null;
      metrics.push({
        ...dayMetric({
          key: "full_shortlist",
          label: shortlistLabel(Number(r.shortlist_size)),
          promise: shortlistPromise(Number(r.shortlist_size), Number(r.first_shortlist_days)),
          baselineAt,
          dueAt: shortlistDue,
          actualAt: shortlistActual ?? null,
          now,
        }),
        actual: shortlistActual
          ? amountLabel(diffDays(baselineAt, shortlistActual), "days")
          : `${deliveries.length} of ${r.shortlist_size} so far`,
      });

      // 3 · Interview slots proposed after a request
      const ivs = interviewsByPosition.get(r.position_id) ?? [];
      metrics.push(interviewSlotMetric(ivs, Number(r.interview_slots_hours), now));

      return {
        positionId: r.position_id as string,
        title: (position.title as string) ?? "Role",
        status: (position.status as string) ?? "active",
        baselineAt,
        metrics,
        state: worstState(metrics.map((m) => m.state)),
      };
    })
    .sort((a, b) => (a.baselineAt < b.baselineAt ? 1 : -1));

  return { roles, summary: summarise(roles) };
}
