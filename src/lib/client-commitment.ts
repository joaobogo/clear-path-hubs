/**
 * Per-role service commitment: what we promised, what actually happened, and
 * the variance between them. Reported the same way whether we hit it or missed
 * it — the miss is never hidden.
 *
 * Pure. No DB access. Inputs are real recorded dates only.
 */

const DAY_MS = 86_400_000;

export type CommitmentState = "met" | "missed" | "waiting" | "overdue" | "none";

export type ShortlistCommitment = {
  state: CommitmentState;
  /** ISO date we promised the first shortlist by, when a promise exists. */
  promisedAt: string | null;
  /** ISO date the first shortlist actually landed, when it has. */
  actualAt: string | null;
  /** Signed whole days. Negative = early, positive = late. Null when unknown. */
  varianceDays: number | null;
  /** "Promised 12 Jul" */
  promisedLabel: string;
  /** "Delivered 14 Jul" / "Not delivered yet" */
  actualLabel: string;
  /** "2 days late" / "1 day early" / "on time" / "3 days remaining" */
  varianceLabel: string;
};

export function formatCommitmentDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function wholeDays(fromIso: string, toIso: string | number): number {
  const to = typeof toIso === "number" ? toIso : new Date(toIso).getTime();
  return Math.round((to - new Date(fromIso).getTime()) / DAY_MS);
}

function dayWord(n: number): string {
  return n === 1 ? "1 day" : `${n} days`;
}

export function shortlistCommitment(input: {
  promisedShortlistBy: string | null | undefined;
  shortlistDeliveredAt: string | null | undefined;
  now?: number;
}): ShortlistCommitment {
  const now = input.now ?? Date.now();
  const promisedAt = input.promisedShortlistBy ?? null;
  const actualAt = input.shortlistDeliveredAt ?? null;

  if (!promisedAt) {
    return {
      state: "none",
      promisedAt: null,
      actualAt,
      varianceDays: null,
      promisedLabel: "No shortlist date committed",
      actualLabel: actualAt ? `Delivered ${formatCommitmentDate(actualAt)}` : "Not delivered yet",
      varianceLabel: "—",
    };
  }

  const promisedLabel = `Promised ${formatCommitmentDate(promisedAt)}`;

  if (actualAt) {
    const variance = wholeDays(promisedAt, actualAt);
    return {
      state: variance > 0 ? "missed" : "met",
      promisedAt,
      actualAt,
      varianceDays: variance,
      promisedLabel,
      actualLabel: `Delivered ${formatCommitmentDate(actualAt)}`,
      varianceLabel:
        variance === 0
          ? "on time"
          : variance > 0
            ? `${dayWord(variance)} late`
            : `${dayWord(Math.abs(variance))} early`,
    };
  }

  const elapsed = wholeDays(promisedAt, now);
  if (elapsed > 0) {
    return {
      state: "overdue",
      promisedAt,
      actualAt: null,
      varianceDays: elapsed,
      promisedLabel,
      actualLabel: "Not delivered yet",
      varianceLabel: `${dayWord(elapsed)} late so far`,
    };
  }
  return {
    state: "waiting",
    promisedAt,
    actualAt: null,
    varianceDays: elapsed,
    promisedLabel,
    actualLabel: "Not delivered yet",
    varianceLabel: elapsed === 0 ? "due today" : `${dayWord(Math.abs(elapsed))} remaining`,
  };
}
