/**
 * A failed briefing never replaces a good one.
 *
 * The pipeline regenerates a candidate's briefing (candidate_evidence
 * .extracted.insights) on every run and upserts it over the previous row for
 * the same engine version. When generation fails (the AI gateway out of
 * credits, a timeout, a non-JSON reply), writing `insights: null` erased the
 * briefing the recruiter and client had been reading: on 29 Oct a rescore of
 * Group Marketing Manager blanked eight good briefings that way. On failure,
 * the most recent earlier briefing is kept, marked as carried forward with the
 * reason, and `insights_error` still records the failure.
 */

type InsightsResult<T> = { insights: T | null; insights_error: string | null };

export type PriorEvidenceRow = {
  id: string;
  created_at?: string | null;
  extracted?: unknown;
};

export type CarriedForward = {
  from_evidence_id: string;
  carried_at: string;
  reason: string | null;
};

function priorInsights(row: PriorEvidenceRow): Record<string, unknown> | null {
  const extracted = row.extracted;
  if (!extracted || typeof extracted !== "object") return null;
  const insights = (extracted as Record<string, unknown>).insights;
  return insights && typeof insights === "object" && !Array.isArray(insights)
    ? (insights as Record<string, unknown>)
    : null;
}

export function carryForwardInsights<T extends object>(
  fresh: InsightsResult<T>,
  previous: PriorEvidenceRow[],
  now: Date = new Date(),
): InsightsResult<T & { carried_forward?: CarriedForward }> {
  if (fresh.insights) return fresh;
  const newestFirst = [...previous].sort((a, b) =>
    String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
  );
  for (const row of newestFirst) {
    const insights = priorInsights(row);
    if (!insights) continue;
    return {
      insights: {
        ...insights,
        carried_forward: {
          from_evidence_id: row.id,
          carried_at: now.toISOString(),
          reason: fresh.insights_error,
        },
      } as unknown as T & { carried_forward?: CarriedForward },
      insights_error: fresh.insights_error,
    };
  }
  return fresh;
}
