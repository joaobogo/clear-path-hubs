/**
 * One entry per real decision.
 *
 * Repeated writes (a double-submit, a retried job, a re-run seed) can leave
 * several identical decision rows behind. Every surface that lists or counts
 * decisions — the candidate Activity tab, the team activity feed, the "this
 * week" tiles — reads them through this collapser, so a duplicated record can
 * never inflate a figure past the number of real decisions or make a history
 * look like it repeats.
 *
 * A repeat is only genuine when a *different* decision was recorded in
 * between: shortlist → declined → shortlist is three entries, while
 * shortlist → shortlist → shortlist is one.
 */

export type DecisionLike = {
  created_at?: string | null;
  decision?: string | null;
  /** Audit-event shape uses `action` where the decision table uses `decision`. */
  action?: string | null;
  feedback?: string | null;
  reason_code?: string | null;
  /** Audit events belong to a candidate; decisions carry the match id. */
  entity_id?: string | null;
  candidate_match_id?: string | null;
};

function subject(row: DecisionLike): string {
  return String(row.candidate_match_id ?? row.entity_id ?? "");
}

function kind(row: DecisionLike): string {
  return String(row.decision ?? row.action ?? "");
}

function key(row: DecisionLike): string {
  return [
    subject(row),
    kind(row),
    (row.feedback ?? "").trim(),
    row.reason_code ?? "",
  ].join("|");
}

function time(row: DecisionLike): number {
  const t = row.created_at ? Date.parse(row.created_at) : NaN;
  return Number.isFinite(t) ? t : 0;
}

/**
 * Collapse duplicated decision records, keeping the earliest of each run.
 *
 * The returned rows keep the order they arrived in, so a newest-first list
 * stays newest-first.
 */
export function dedupeDecisions<T extends DecisionLike>(rows: T[]): T[] {
  const chronological = [...rows].sort((a, b) => time(a) - time(b));
  const keep = new Set<T>();
  /** Last decision kind kept per subject, to spot a genuine change of mind. */
  const lastKind = new Map<string, string>();
  const seen = new Set<string>();

  for (const row of chronological) {
    const s = subject(row);
    const k = key(row);
    const changedSinceLast = lastKind.get(s) !== undefined && lastKind.get(s) !== kind(row);
    if (!seen.has(k) || changedSinceLast) {
      keep.add(row);
      seen.add(k);
      lastKind.set(s, kind(row));
    }
  }

  return rows.filter((r) => keep.has(r));
}
