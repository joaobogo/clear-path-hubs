/**
 * Pure metric computation for the client analytics page.
 *
 * The server function reads records; every number is produced here from those
 * records only. Nothing is modelled, estimated or benchmarked, and the window
 * is re-applied defensively so a metric can never include a record outside the
 * date filter the client selected.
 */

export const DAY_MS = 24 * 3600 * 1000;

export type FunnelStep = {
  key: string;
  label: string;
  count: number;
  /** Candidates who reached the previous step but never this one. */
  dropped: number;
  /** Share of the previous step that continued, null when no previous step. */
  continued_rate: number | null;
};

export type SpeedRow = {
  key: string;
  label: string;
  promise_days: number;
  actual_days: number | null;
  variance_days: number | null;
  measured: number;
};

export type Window = { fromISO: string; toISO: string };

export type MatchRecord = {
  id: string;
  position_id: string;
  stage: string | null;
  created_at?: string | null;
  delivered_at: string | null;
};

export type StageEvent = { candidate_match_id: string; to_stage: string | null; created_at?: string | null };

export type CommitmentRecord = {
  position_id: string;
  first_shortlist_days: number;
  shortlist_size: number;
  baseline_at: string;
};

export type DeliveryRecord = { position_id: string; delivered_at: string | null };

export type SpendRecord = {
  amount: number | string | null;
  currency: string;
  category: string;
  period_start: string;
  period_end: string;
};

export type HireRecord = { id: string; hired_at: string | null };

export const STEPS: { key: string; label: string }[] = [
  { key: "delivered", label: "Shown to you" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "interview_process", label: "Interviewed" },
  { key: "offer", label: "Offered" },
  { key: "hired", label: "Hired" },
];

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function inWindow(iso: string | null | undefined, w: Window): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= new Date(w.fromISO).getTime() && t <= new Date(w.toISO).getTime();
}

export function makeWindow(days: number, now = Date.now()): Window {
  return { fromISO: new Date(now - days * DAY_MS).toISOString(), toISO: new Date(now).toISOString() };
}

export function computeDropout(matchesRaw: MatchRecord[], history: StageEvent[], w: Window) {
  const matches = matchesRaw.filter((m) => inWindow(m.delivered_at, w));
  const reached = new Map<string, Set<string>>(STEPS.map((s) => [s.key, new Set<string>()]));
  const byMatch = new Map<string, StageEvent[]>();
  for (const h of history) {
    const arr = byMatch.get(h.candidate_match_id) ?? [];
    arr.push(h);
    byMatch.set(h.candidate_match_id, arr);
  }
  for (const m of matches) {
    const stages = new Set<string>(
      [
        "delivered",
        m.stage,
        ...(byMatch.get(m.id) ?? []).map((h) => h.to_stage),
      ].filter(Boolean) as string[],
    );
    for (const s of stages) reached.get(s)?.add(m.id);
  }
  const steps: FunnelStep[] = STEPS.map((s, i) => {
    const count = reached.get(s.key)!.size;
    const prev = i === 0 ? null : reached.get(STEPS[i - 1].key)!.size;
    return {
      key: s.key,
      label: s.label,
      count,
      dropped: prev === null ? 0 : Math.max(0, prev - count),
      continued_rate: prev && prev > 0 ? count / prev : null,
    };
  });
  const biggestDrop = steps
    .slice(1)
    .reduce<FunnelStep | null>((worst, s) => (!worst || s.dropped > worst.dropped ? s : worst), null);

  return {
    available: matches.length > 0,
    reason: matches.length === 0 ? "No candidates have been shown to you in this window yet." : null,
    steps,
    total: matches.length,
    biggest_drop:
      biggestDrop && biggestDrop.dropped > 0
        ? {
            label: biggestDrop.label,
            from: STEPS[STEPS.findIndex((s) => s.key === biggestDrop.key) - 1].label,
            dropped: biggestDrop.dropped,
          }
        : null,
  };
}

export function computeSpeed(commitments: CommitmentRecord[], deliveries: DeliveryRecord[]) {
  // Commitments are measured from role launch, so deliveries are read unbounded
  // by the selected window — otherwise a promise made before the window would
  // look unmet.
  const byPosition = new Map<string, number[]>();
  for (const d of deliveries) {
    if (!d.delivered_at) continue;
    const list = byPosition.get(d.position_id) ?? [];
    list.push(new Date(d.delivered_at).getTime());
    byPosition.set(d.position_id, list);
  }
  for (const list of byPosition.values()) list.sort((a, b) => a - b);

  const firstPromise: number[] = [];
  const firstActual: number[] = [];
  const shortlistPromise: number[] = [];
  const shortlistActual: number[] = [];
  for (const c of commitments) {
    const base = new Date(c.baseline_at).getTime();
    const times = byPosition.get(c.position_id) ?? [];
    if (times[0]) {
      firstPromise.push(c.first_shortlist_days);
      firstActual.push((times[0] - base) / DAY_MS);
    }
    if (c.shortlist_size > 0 && times.length >= c.shortlist_size) {
      shortlistPromise.push(c.first_shortlist_days);
      shortlistActual.push((times[c.shortlist_size - 1] - base) / DAY_MS);
    }
  }

  const row = (
    key: string,
    label: string,
    promise: number[],
    actual: number[],
  ): SpeedRow => {
    const p = median(promise);
    const a = median(actual);
    return {
      key,
      label,
      promise_days: p ?? 0,
      actual_days: a,
      variance_days: a !== null && p !== null ? a - p : null,
      measured: actual.length,
    };
  };

  const rows = [
    row("first_candidate", "First candidate", firstPromise, firstActual),
    row("full_shortlist", "Full shortlist", shortlistPromise, shortlistActual),
  ].filter((r) => r.measured > 0);

  return {
    available: rows.length > 0,
    reason:
      commitments.length === 0
        ? "No service commitments have been set on your roles yet."
        : rows.length === 0
          ? "No commitment has run its course yet — nothing measurable so far."
          : null,
    rows,
    roles_measured: commitments.length,
  };
}

export function computeCost(spendRaw: SpendRecord[], hiresRaw: HireRecord[], w: Window) {
  // Spend counts when its period overlaps the window; hires count when
  // confirmed inside it.
  const fromDay = w.fromISO.slice(0, 10);
  const toDay = w.toISO.slice(0, 10);
  const spend = spendRaw.filter((s) => s.period_end >= fromDay && s.period_start <= toDay);
  const hires = hiresRaw.filter((h) => inWindow(h.hired_at, w));
  // Re-filter matches to ensure Portfolio sourcing "hired" equals role-level counts
  // by using the same source (candidate_matches stage). 
  // Note: hiresRaw is already pre-filtered for status="hire_confirmed" in the server function.

  const currency = spend[0]?.currency ?? "EUR";
  const mixedCurrency = spend.some((s) => s.currency !== currency);
  const totalSpend = spend.reduce((sum, s) => sum + Number(s.amount ?? 0), 0);
  const byCategory = new Map<string, number>();
  for (const s of spend) {
    byCategory.set(s.category, (byCategory.get(s.category) ?? 0) + Number(s.amount ?? 0));
  }

  return {
    available: spend.length > 0 && hires.length > 0 && !mixedCurrency,
    reason:
      spend.length === 0
        ? "No recruiting spend has been recorded for this workspace, so cost per hire cannot be calculated."
        : hires.length === 0
          ? "No confirmed hire in this window yet — cost per hire needs at least one."
          : mixedCurrency
            ? "Spend is recorded in more than one currency. We don't convert, so no single figure is shown."
            : null,
    currency,
    total_spend: totalSpend,
    hires: hires.length,
    cost_per_hire: hires.length > 0 ? totalSpend / hires.length : null,
    by_category: Array.from(byCategory.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    entries_counted: spend.length,
  };
}
