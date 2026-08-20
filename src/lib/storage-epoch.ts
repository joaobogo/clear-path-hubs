/**
 * One-time browser-storage reset for a release.
 *
 * Returning visitors can carry stale UI state from an older build: dismissed
 * notices, half-finished wizard steps, cached prefills, remembered searches.
 * Bumping `STORAGE_EPOCH` clears all of that on the visitor's next load so
 * everyone sees the current site with a clean slate.
 *
 * Deliberately preserved:
 *  - the Supabase auth session (`sb-*`), so nobody is logged out;
 *  - the cookie/tracking consent decision, so a lawful choice is not discarded
 *    and the banner does not re-nag someone who already answered.
 */

/** Bump this on any release that should reset stored visitor state. */
export const STORAGE_EPOCH = "2026-08-20";

const EPOCH_KEY = "taasflow.storage.epoch";

/** Keys that must survive a reset. */
const PRESERVED = new Set(["taasflow_consent_v1", EPOCH_KEY]);

function isPreserved(key: string): boolean {
  if (PRESERVED.has(key)) return true;
  // Supabase auth token keys look like `sb-<project>-auth-token`.
  return key.startsWith("sb-");
}

function purge(store: Storage) {
  const doomed: string[] = [];
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i);
    if (key && !isPreserved(key)) doomed.push(key);
  }
  for (const key of doomed) store.removeItem(key);
}

/** Clears stale stored state once per epoch. Safe to call on every load. */
export function resetStaleBrowserStorage(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(EPOCH_KEY) === STORAGE_EPOCH) return;
    purge(window.localStorage);
    try {
      purge(window.sessionStorage);
    } catch {
      /* sessionStorage can be unavailable; the localStorage purge still counts */
    }
    window.localStorage.setItem(EPOCH_KEY, STORAGE_EPOCH);
  } catch {
    /* storage blocked (private mode, strict settings) — nothing to clean */
  }
}
