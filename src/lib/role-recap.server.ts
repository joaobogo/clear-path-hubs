// Role recap — server function.
//
// Reads only recorded events on one role: stage transitions, client decisions
// and the position's own brief date. No cross-client reads, no benchmarks, no
// derived "quality" judgement. A missing event yields null so the UI can say
// "Not recorded" instead of an untrue zero.

import { REJECTION_REASONS } from "@/lib/client-decision-reasons";
import {
  RECAP_COUNT_LABEL,
  RECAP_DURATION_LABEL,
  daysBetween,
  hasRecapActivity,
  topDeclineReasons,
  type RecapCount,
  type RecapDuration,
  type RoleRecap,
} from "@/lib/role-recap";

type StageRow = { candidate_match_id: string; to_stage: string; created_at: string };
type DecisionRow = { candidate_match_id: string; decision: string; reason_code: string | null };

function reasonLabel(code: string): string {
  return REJECTION_REASONS.find((r) => r.code === code)?.label ?? code;
}

/** Earliest recorded transition into any of the given stages. */
function firstAt(rows: StageRow[], stages: string[]): string | null {
  let best: string | null = null;
  for (const r of rows) {
    if (!stages.includes(r.to_stage)) continue;
    if (!best || Date.parse(r.created_at) < Date.parse(best)) best = r.created_at;
  }
  return best;
}

/** Distinct candidates that ever reached one of the given stages, or null. */
function reachedCount(rows: StageRow[], stages: string[]): number | null {
  const ids = new Set<string>();
  for (const r of rows) if (stages.includes(r.to_stage)) ids.add(r.candidate_match_id);
  return ids.size > 0 ? ids.size : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

/** Recap for one closed role. Caller must already be authorised for candidates. */
export async function loadRoleRecap(
  supabase: Client,
  data: { orgId: string; positionId: string },
): Promise<RoleRecap | null> {

    const { data: position, error: positionError } = await supabase
      .from("positions")
      .select("id, created_at, status, closure_reason")
      .eq("id", data.positionId)
      .eq("organization_id", data.orgId)
      .maybeSingle();
    if (positionError) throw new Error(positionError.message);
    if (!position) return null;

    const briefAt = (position as { created_at: string | null }).created_at ?? null;

    const { data: stageRows, error: stageError } = await supabase
      .from("candidate_stage_history")
      .select("candidate_match_id, to_stage, created_at")
      .eq("position_id", data.positionId)
      .eq("organization_id", data.orgId)
      .order("created_at", { ascending: true });
    if (stageError) throw new Error(stageError.message);
    const stages = (stageRows as StageRow[] | null) ?? [];

    // Decisions are joined through matches so a recap never reads another role.
    const { data: decisionRows, error: decisionError } = await supabase
      .from("client_decisions")
      .select(
        "candidate_match_id, decision, reason_code, reversed_at, candidate_matches!inner(position_id)",
      )
      .eq("organization_id", data.orgId)
      .is("reversed_at", null)
      .eq("candidate_matches.position_id", data.positionId);
    if (decisionError) throw new Error(decisionError.message);
    const decisions = ((decisionRows as unknown as DecisionRow[] | null) ?? []).filter(
      (d) => d.decision === "not_moving_forward",
    );

    const shortlistAt = firstAt(stages, ["shortlisted"]);
    const interviewAt = firstAt(stages, ["interview_process"]);
    const offerAt = firstAt(stages, ["offer"]);
    const hireAt = firstAt(stages, ["hired"]);

    const durations: RecapDuration[] = [
      { key: "first_shortlist", at: shortlistAt },
      { key: "first_interview", at: interviewAt },
      { key: "offer", at: offerAt },
      { key: "hire", at: hireAt },
    ].map((d) => ({
      key: d.key as RecapDuration["key"],
      label: RECAP_DURATION_LABEL[d.key as RecapDuration["key"]],
      at: d.at,
      days: daysBetween(briefAt, d.at),
    }));

    const declinedIds = new Set(decisions.map((d) => d.candidate_match_id));
    const counts: RecapCount[] = [
      {
        key: "delivered" as const,
        value: reachedCount(stages, ["delivered", "shortlisted", "interview_process", "offer", "hired"]),
      },
      { key: "interviewed" as const, value: reachedCount(stages, ["interview_process", "offer", "hired"]) },
      { key: "declined" as const, value: declinedIds.size > 0 ? declinedIds.size : null },
    ].map((c) => ({ ...c, label: RECAP_COUNT_LABEL[c.key] }));

    const byCode = new Map<string, number>();
    for (const d of decisions) {
      const code = d.reason_code;
      if (!code) continue;
      byCode.set(code, (byCode.get(code) ?? 0) + 1);
    }
    const declineReasons = topDeclineReasons(
      [...byCode.entries()].map(([code, count]) => ({ code, label: reasonLabel(code), count })),
    );

    return {
      briefAt,
      durations,
      counts,
      declineReasons,
      hasActivity: hasRecapActivity({ durations, counts, declineReasons }),
    };
}
