/**
 * Readiness summary for pages built from several independent queries.
 *
 * A page that stitches four panels together must be able to say, in one place,
 * which of those panels is currently trustworthy. Two failure shapes matter:
 *
 *  - failed: the query errored and we have nothing (or only older) data.
 *  - stale:  we have data, but it is known out of date and not refreshing.
 *
 * Both are "not current". Callers use `isNotCurrent(label)` to mark the exact
 * panel and to suppress confident numbers (show a dash and the reason instead).
 */

/** Anything shaped like a React Query result we care about. */
export type PanelQueryLike = {
  isError: boolean;
  isStale?: boolean;
  isFetching: boolean;
  dataUpdatedAt?: number;
  data?: unknown;
  refetch: () => unknown;
};

export type PanelSignal = {
  label: string;
  failed: boolean;
  stale: boolean;
  retry: () => void | Promise<unknown>;
  retrying: boolean;
};

/** Data older than this, and not refreshing, is treated as not current. */
export const STALE_AFTER_MS = 5 * 60_000;

export function panelSignal(label: string, query: PanelQueryLike): PanelSignal {
  const hasData = query.data !== undefined && query.data !== null;
  const age = query.dataUpdatedAt ? Date.now() - query.dataUpdatedAt : 0;
  return {
    label,
    failed: query.isError && !hasData,
    stale:
      (query.isError && hasData) ||
      Boolean(hasData && query.isStale && !query.isFetching && age > STALE_AFTER_MS),
    retry: () => query.refetch(),
    retrying: query.isFetching,
  };
}

export type PanelReadiness = {
  signals: PanelSignal[];
  failed: PanelSignal[];
  stale: PanelSignal[];
  /** True when at least one panel cannot be trusted. */
  degraded: boolean;
  retrying: boolean;
  /** Is this specific panel out of date (failed or stale)? */
  isNotCurrent: (label: string) => boolean;
  /** Short reason for the inline chip / dash tooltip. */
  reasonFor: (label: string) => string | null;
};

export function panelReadiness(signals: PanelSignal[]): PanelReadiness {
  const failed = signals.filter((s) => s.failed);
  const stale = signals.filter((s) => !s.failed && s.stale);
  const byLabel = new Map(signals.map((s) => [s.label, s]));
  return {
    signals,
    failed,
    stale,
    degraded: failed.length > 0 || stale.length > 0,
    retrying: signals.some((s) => s.retrying),
    isNotCurrent: (label) => {
      const s = byLabel.get(label);
      return Boolean(s && (s.failed || s.stale));
    },
    reasonFor: (label) => {
      const s = byLabel.get(label);
      if (!s) return null;
      if (s.failed) return "this section didn't load";
      if (s.stale) return "this section is out of date";
      return null;
    },
  };
}
