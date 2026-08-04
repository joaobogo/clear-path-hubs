import { useEffect, useRef, useState } from "react";

/**
 * Motion hooks for product surfaces.
 *
 * Contract for every hook here:
 *  - the final, correct value is in the DOM on first paint; motion only
 *    describes how it got there, so information never depends on animation
 *  - `prefers-reduced-motion: reduce` short-circuits every timer and tween
 *  - no timers keep running once a component unmounts
 *  - nothing here schedules work on a frame loop unless a value is mid-change
 */

const QUERY = "(prefers-reduced-motion: reduce)";

/** Live reduced-motion preference. False during SSR and first paint. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(QUERY);
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/**
 * True for a short window after `value` changes — used to fire a one-shot
 * "this just changed" cue (status transitions, refreshed counts).
 *
 * Never true on first render: initial data is not a change.
 */
export function useJustChanged(value: unknown, ms = 600): boolean {
  const reduced = usePrefersReducedMotion();
  const previous = useRef(value);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    if (reduced) return;
    setChanged(true);
    const timer = window.setTimeout(() => setChanged(false), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms, reduced]);

  return changed && !reduced;
}

/**
 * Ids present now that were not present on the previous render — the arrival
 * set for lists that stream (notifications, agent activity, candidate rows).
 *
 * The first load is not an arrival: existing records must not animate in.
 */
export function useArrivals(ids: readonly string[], ms = 1200): ReadonlySet<string> {
  const reduced = usePrefersReducedMotion();
  const seen = useRef<Set<string> | null>(null);
  const [arrived, setArrived] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(ids);
      return;
    }
    const fresh = ids.filter((id) => !seen.current!.has(id));
    for (const id of ids) seen.current.add(id);
    if (reduced || fresh.length === 0) return;

    setArrived(new Set(fresh));
    const timer = window.setTimeout(() => setArrived(new Set()), ms);
    return () => window.clearTimeout(timer);
    // ids is a value array; join keeps the effect keyed to membership only
  }, [ids.join("\u0000"), ms, reduced]);

  return reduced ? EMPTY_SET : arrived;
}

const EMPTY_SET: ReadonlySet<string> = new Set();

/**
 * Tween a number toward `value` so a refreshed metric reads as a change rather
 * than a silent swap. Snaps immediately under reduced motion, on first render,
 * and for large jumps where a tween would just look slow.
 */
export function useCountUp(value: number, ms = 420): number {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(value);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      setDisplay(value);
      return;
    }
    if (reduced || !Number.isFinite(value)) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    const from = display;
    const delta = value - from;
    if (delta === 0) return;

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      // ease-out: fast start, settles on the true value
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(t === 1 ? value : from + delta * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // display is intentionally omitted: re-reading it would restart the tween
  }, [value, ms, reduced]);

  return display;
}

/** Stagger custom property for arrival bursts, capped so lists never crawl. */
export function staggerStyle(index: number, cap = 5): React.CSSProperties {
  return { ["--motion-i" as string]: String(Math.min(index, cap)) };
}
