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

/**
 * A briefing a recruiter wrote by hand (insights.authored_by set) is kept on a
 * rescore while it still covers the role's current requirements: regenerating
 * it would replace researched, verified evidence with a generic summary. Once
 * the requirements change, it no longer describes the role and is regenerated.
 */
export function recruiterBriefingStillCurrent(
  previous: PriorEvidenceRow[],
  requirementTexts: string[],
): { evidence_id: string; insights: Record<string, unknown> } | null {
  const strip = (s: string) => s.replace(/^\s*(MUST|NICE):\s*/i, "").trim().toLowerCase();
  const wanted = new Set(requirementTexts.map(strip).filter(Boolean));
  if (wanted.size === 0) return null;
  const newestFirst = [...previous].sort((a, b) =>
    String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
  );
  for (const row of newestFirst) {
    const insights = priorInsights(row);
    if (!insights) continue;
    if (typeof insights.authored_by !== "string" || !insights.authored_by.trim()) return null;
    const verdicts = Array.isArray(insights.requirement_verdicts) ? insights.requirement_verdicts : [];
    const covered = new Set(
      verdicts.map((v) => strip(String((v as Record<string, unknown>)?.requirement_text ?? ""))),
    );
    if (covered.size !== wanted.size) return null;
    for (const w of wanted) if (!covered.has(w)) return null;
    return { evidence_id: row.id, insights };
  }
  return null;
}
