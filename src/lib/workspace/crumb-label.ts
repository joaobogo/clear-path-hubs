import { useLayoutEffect, useSyncExternalStore } from "react";

/**
 * Human label for the current detail record.
 *
 * The workspace breadcrumb is derived from the URL, and a detail route's last
 * segment is a uuid — which reads as "Ee6d2a…7b7d" to a client. A detail page
 * publishes the name of the thing it is showing here; the shell prefers it over
 * the raw segment and falls back to the URL when nothing was published (loading,
 * error, or a route that never sets it).
 */
let label: string | null = null;
const subscribers = new Set<() => void>();

function emit() {
  for (const fn of subscribers) fn();
}

export function setCrumbLabel(next: string | null) {
  if (label === next) return;
  label = next;
  emit();
}

function subscribe(fn: () => void) {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

/** Shell-side read. Returns null while no detail page has published a label. */
export function useCrumbLabel(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => label,
    () => null,
  );
}

/** Detail-page side: publish a label for as long as this page is mounted. */
export function useDetailCrumb(next: string | null | undefined) {
  // Publish synchronously so the workspace breadcrumb updates before the browser
  // paints, avoiding a flash of the raw uuid segment.
  useLayoutEffect(() => {
    setCrumbLabel(next?.trim() ? next.trim() : null);
    return () => setCrumbLabel(null);
  }, [next]);
}
