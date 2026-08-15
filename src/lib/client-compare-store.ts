import store from "store";

const COMPARE_STORE_KEY = "cl_compare_selection";

/**
 * Persists the candidate selection for a specific organization to local storage.
 */
export function saveCompareSelection(orgId: string, matchIds: string[]) {
  if (typeof window === "undefined") return;
  const current = store.get(COMPARE_STORE_KEY) || {};
  current[orgId] = matchIds;
  store.set(COMPARE_STORE_KEY, current);
}

/**
 * Loads the persisted candidate selection for a specific organization.
 */
export function loadCompareSelection(orgId: string): string[] {
  if (typeof window === "undefined") return [];
  const current = store.get(COMPARE_STORE_KEY) || {};
  return current[orgId] || [];
}

/**
 * Purges the persisted selection for a specific organization.
 */
export function clearCompareSelection(orgId: string) {
  if (typeof window === "undefined") return;
  const current = store.get(COMPARE_STORE_KEY) || {};
  delete current[orgId];
  store.set(COMPARE_STORE_KEY, current);
}
