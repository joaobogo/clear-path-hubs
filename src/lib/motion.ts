/**
 * TaaSFlow motion system — client helpers.
 *
 * Duration and easing tokens are defined in src/styles/motion.css and
 * src/styles/brand-tokens.css. Use these constants when animating from JS
 * so the numbers stay in sync with the CSS layer.
 *
 * Rules (see docs/design/motion-system.md):
 *  - default motion 150–400ms; storytelling ceiling ~600ms
 *  - never block interaction, never shift layout
 *  - respect prefers-reduced-motion
 *  - spring only for subtle product micro-interactions
 */

import { useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/* Tokens (JS mirror of CSS variables)                                */
/* ------------------------------------------------------------------ */
export const MOTION = {
  duration: {
    instant: 80,
    fast: 120,
    base: 180,
    slow: 280,
    slower: 420,
    story: 600, // hard ceiling for narrative sequences
  },
  ease: {
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    emphasized: "cubic-bezier(0.2, 0, 0.1, 1)",
    outSoft: "cubic-bezier(0.16, 1, 0.3, 1)",
    inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  },
} as const;

/* ------------------------------------------------------------------ */
/* Reduced motion                                                     */
/* ------------------------------------------------------------------ */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/* ------------------------------------------------------------------ */
/* In-view observer — one-shot section reveal                         */
/* ------------------------------------------------------------------ */
export function useInView<T extends Element = HTMLElement>(options?: {
  rootMargin?: string;
  threshold?: number;
  once?: boolean;
}): [React.RefCallback<T>, boolean] {
  const { rootMargin = "0px 0px -10% 0px", threshold = 0.15, once = true } =
    options ?? {};
  const [inView, setInView] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const nodeRef = useRef<T | null>(null);

  const setRef = (node: T | null) => {
    if (observerRef.current && nodeRef.current) {
      observerRef.current.unobserve(nodeRef.current);
    }
    nodeRef.current = node;
    if (!node || typeof IntersectionObserver === "undefined") {
      // SSR / unsupported → show immediately.
      setInView(true);
      return;
    }
    observerRef.current ??= new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target !== node) continue;
          if (entry.isIntersecting) {
            setInView(true);
            if (once && observerRef.current) {
              observerRef.current.unobserve(node);
            }
          } else if (!once) {
            setInView(false);
          }
        }
      },
      { rootMargin, threshold },
    );
    observerRef.current.observe(node);
  };

  useEffect(() => {
    return () => observerRef.current?.disconnect();
  }, []);

  return [setRef, inView];
}

/* ------------------------------------------------------------------ */
/* Number tween — for calculator + score changes                      */
/* ------------------------------------------------------------------ */
export function useAnimatedNumber(
  target: number,
  opts?: { duration?: number; ease?: (t: number) => number },
): number {
  const duration = opts?.duration ?? MOTION.duration.slow;
  const ease = opts?.ease ?? easeOutCubic;
  const reduced = useReducedMotion();
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced || !Number.isFinite(target)) {
      setValue(target);
      return;
    }
    fromRef.current = value;
    startRef.current = null;

    const tick = (t: number) => {
      startRef.current ??= t;
      const elapsed = t - startRef.current;
      const p = Math.min(1, elapsed / duration);
      const next = fromRef.current + (target - fromRef.current) * ease(p);
      setValue(next);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, reduced]);

  return value;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}
