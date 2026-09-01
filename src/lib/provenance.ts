/**
 * Data provenance.
 *
 * Every derived number the product shows must arrive wrapped in one of these.
 * A figure without provenance is a figure we cannot defend, and we do not
 * put it on screen.
 */

export type Provenance = {
  /** Plain-language description of what the number was computed from. */
  computed_from: string;
  /** Tables the number was read out of. */
  sources: string[];
  /** Start of the observation window, ISO string. Null when all-time. */
  window_start: string | null;
  /** End of the observation window, ISO string. Null when up to now. */
  window_end: string | null;
  /**
   * How many underlying records went into it.
   *
   * The number COUNTED, never the number read. The people tile displayed 32
   * while its own provenance panel said "Records: 1,000" — a round thousand
   * being the signature of a query cap rendered as a record count — so the one
   * panel built to justify a figure was the one number in it that could not be
   * trusted (audit 1 Sep, F22).
   */
  record_count: number;
  /**
   * Set only when a query cap actually bound, so the reader knows the figure is
   * a floor. Absent means the count is complete, which is the common case and
   * must stay silent.
   */
  capped_at?: number;
  /** How many distinct closed searches, where that is the honest unit. */
  closed_searches?: number;
  /** When the figure itself was computed. */
  computed_at: string;
};

export type Sourced<T> = {
  value: T;
  provenance: Provenance;
};

export function sourced<T>(
  value: T,
  p: Omit<Provenance, "computed_at"> & { computed_at?: string },
): Sourced<T> {
  return {
    value,
    provenance: { ...p, computed_at: p.computed_at ?? new Date().toISOString() },
  };
}

/**
 * The smallest number of closed searches we will publish a market figure from.
 * Below this the surface says "not enough closed searches yet" instead of
 * printing an average of two.
 */
export const MIN_CLOSED_SEARCHES = 5;

export function isPublishable(closedSearches: number): boolean {
  return closedSearches >= MIN_CLOSED_SEARCHES;
}

export function describeWindow(p: Provenance): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  if (!p.window_start && !p.window_end) return "All records held";
  if (p.window_start && p.window_end)
    return `${fmt(p.window_start)} to ${fmt(p.window_end)}`;
  if (p.window_start) return `Since ${fmt(p.window_start)}`;
  return `Up to ${fmt(p.window_end!)}`;
}
