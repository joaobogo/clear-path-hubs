import * as React from "react";

export type Density = "comfortable" | "compact";

const KEY_PREFIX = "taasflow.density";

function storageKey(userId?: string | null): string {
  return userId ? `${KEY_PREFIX}.${userId}` : KEY_PREFIX;
}

/**
 * Density preference, remembered per user.
 *
 * Compact fits more roles on screen by tightening vertical rhythm and type —
 * never by shrinking tap targets, which stay at 44px minimum.
 */
export function useDensity(userId?: string | null) {
  const [density, setDensity] = React.useState<Density>("comfortable");
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey(userId));
      setDensity(stored === "compact" ? "compact" : "comfortable");
    } catch {
      /* private mode — fall back to comfortable */
    }
    setHydrated(true);
  }, [userId]);

  const update = React.useCallback(
    (next: Density) => {
      setDensity(next);
      try {
        window.localStorage.setItem(storageKey(userId), next);
      } catch {
        /* preference simply does not persist */
      }
    },
    [userId],
  );

  const toggle = React.useCallback(
    () => update(density === "compact" ? "comfortable" : "compact"),
    [density, update],
  );

  return { density, compact: density === "compact", hydrated, setDensity: update, toggle };
}
