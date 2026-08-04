import { useCallback, useEffect, useState } from "react";
import type { Recommendation } from "./recommendations";

/**
 * Dismiss / snooze state for recommendations.
 *
 * Held per browser and per organisation. Nothing candidate-related is stored —
 * only a recommendation id and an expiry — so this carries no sensitive data
 * and needs no server round-trip.
 */

const SNOOZE_DAYS = 7;
const DAY_MS = 86_400_000;

type Entry = { until: number | null };
type Store = Record<string, Entry>;

function storageKey(orgId: string) {
  return `taasflow:recommendation-dismissals:${orgId}`;
}

function read(orgId: string): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey(orgId));
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(orgId: string, store: Store) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(orgId), JSON.stringify(store));
  } catch {
    /* storage unavailable — suppression simply does not persist */
  }
}

export const SNOOZE_LABEL = `Snooze for ${SNOOZE_DAYS} days`;

export function useRecommendationDismissals(orgId: string | null) {
  const [store, setStore] = useState<Store>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    setStore(read(orgId));
    setHydrated(true);
  }, [orgId]);

  const update = useCallback(
    (id: string, entry: Entry | null) => {
      if (!orgId) return;
      setStore((prev) => {
        const next = { ...prev };
        if (entry === null) delete next[id];
        else next[id] = entry;
        write(orgId, next);
        return next;
      });
    },
    [orgId],
  );

  const dismiss = useCallback((id: string) => update(id, { until: null }), [update]);
  const snooze = useCallback(
    (id: string) => update(id, { until: Date.now() + SNOOZE_DAYS * DAY_MS }),
    [update],
  );
  const restore = useCallback((id: string) => update(id, null), [update]);

  const isSuppressed = useCallback(
    (rec: Recommendation) => {
      const entry = store[rec.id];
      if (!entry) return false;
      // Critical items can be snoozed but never permanently dismissed.
      if (!rec.dismissible && entry.until === null) return false;
      if (entry.until === null) return true;
      return entry.until > Date.now();
    },
    [store],
  );

  const suppressedCount = Object.entries(store).filter(
    ([, e]) => e.until === null || e.until > Date.now(),
  ).length;

  return { hydrated, isSuppressed, dismiss, snooze, restore, suppressedCount };
}
