/**
 * Live error clearing for inline-validated forms.
 *
 * Forms in the app validate on submit and render inline messages. Without this
 * hook the messages stayed on screen after the user fixed the field, because
 * nothing re-ran validation until the next submit. These helpers re-validate on
 * every change and drop the messages that are no longer true, while never
 * introducing a *new* error before the user has submitted.
 */

import { useEffect, useRef, useState } from "react";

type Errors = Record<string, unknown>;

/** True when the value is an actual message / nested message map with content. */
function hasContent(value: unknown): boolean {
  if (!value) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

/**
 * Keeps only the errors that are still failing.
 *
 * `current` is what is on screen, `fresh` is the result of re-running the same
 * validator against the latest values. Keys absent from `fresh` are resolved and
 * removed; keys still failing take the fresh (possibly reworded) message. Keys
 * that only appear in `fresh` are ignored, so typing in one field never lights up
 * an untouched one.
 */
export function pruneResolvedErrors<E extends Errors>(current: E, fresh: E): E {
  const next: Errors = {};
  for (const key of Object.keys(current)) {
    if (!hasContent(current[key])) continue;
    const freshValue = fresh[key as keyof E];
    if (!hasContent(freshValue)) continue;
    // Nested maps (e.g. per-row errors) are pruned index by index.
    if (
      typeof current[key] === "object" &&
      current[key] !== null &&
      typeof freshValue === "object" &&
      freshValue !== null
    ) {
      const nested = pruneResolvedErrors(
        current[key] as Errors,
        freshValue as Errors,
      );
      if (Object.keys(nested).length > 0) next[key] = nested;
      continue;
    }
    next[key] = freshValue;
  }
  return next as E;
}

/**
 * Re-runs `revalidate` whenever `deps` change and clears the errors the user has
 * fixed. No-op while there is nothing on screen, so it costs nothing before the
 * first submit.
 */
export function useClearResolvedErrors<E extends Errors>(
  errors: E,
  setErrors: (next: E) => void,
  revalidate: () => E,
  deps: unknown[],
): void {
  const revalidateRef = useRef(revalidate);
  revalidateRef.current = revalidate;
  const errorsRef = useRef(errors);
  errorsRef.current = errors;

  useEffect(() => {
    const current = errorsRef.current;
    if (Object.keys(current).length === 0) return;
    const next = pruneResolvedErrors(current, revalidateRef.current());
    if (JSON.stringify(next) !== JSON.stringify(current)) setErrors(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Hides a server-side error message once the inputs it referred to have changed.
 * Pass a stable snapshot (usually `JSON.stringify` of the draft) — the message is
 * suppressed as soon as the snapshot differs from the one at failure time.
 */
export function useStaleServerError(
  message: string | null | undefined,
  snapshot: string,
): string | null {
  const [pinned, setPinned] = useState<{ message: string; snapshot: string } | null>(null);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  useEffect(() => {
    setPinned(message ? { message, snapshot: snapshotRef.current } : null);
  }, [message]);

  if (!message || !pinned) return message ?? null;
  return pinned.snapshot === snapshot ? pinned.message : null;
}
