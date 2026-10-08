/**
 * Pure rules for "interviews" figures. Interviews are arranged off system, so
 * a candidate reaching the interview stage is the signal we can prove. Legacy
 * `interviews` rows still count. One match counts once.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/** A stage entry (stage history or request_interview decision) as an interview-like row. */
export function stageEntryRow(e: { candidate_match_id: string; position_id?: string | null; at: string }): Row {
  return {
    id: `stage:${e.candidate_match_id}`,
    position_id: e.position_id ?? null,
    candidate_match_id: e.candidate_match_id,
    status: "interview_stage",
    scheduled_at: null,
    completed_at: null,
    cancelled_at: null,
    entered_at: e.at,
  };
}

/**
 * Legacy rows win for a match that has one; every other match that reached the
 * interview stage inside the window adds exactly one row (its earliest entry).
 */
export function mergeInterviewActivity(
  legacyRows: readonly Row[],
  stageEntries: ReadonlyArray<{ candidate_match_id: string; position_id?: string | null; at: string }>,
): Row[] {
  const covered = new Set(
    legacyRows.map((r) => r["candidate_match_id"]).filter((v): v is string => typeof v === "string"),
  );
  const earliest = new Map<string, { candidate_match_id: string; position_id?: string | null; at: string }>();
  for (const e of stageEntries) {
    if (!e.candidate_match_id || covered.has(e.candidate_match_id)) continue;
    const prev = earliest.get(e.candidate_match_id);
    if (!prev || e.at < prev.at) earliest.set(e.candidate_match_id, e);
  }
  return [...legacyRows, ...[...earliest.values()].map(stageEntryRow)];
}

/** Distinct matches across mixed rows (legacy rows may repeat a match). */
export function distinctInterviewMatches(rows: readonly Row[]): number {
  const keys = new Set<string>();
  for (const r of rows) keys.add(String(r["candidate_match_id"] ?? r["id"]));
  return keys.size;
}
