/**
 * Lightweight, non-blocking analytics helper.
 *
 * Contract:
 *   - MUST NEVER throw. Wrapped in try/catch — a broken tracker never blocks UX.
 *   - MUST NOT block navigation. Uses `navigator.sendBeacon` when available so
 *     click-then-navigate CTAs still send the event on unload.
 *   - MUST NOT gate the UI. Events are fire-and-forget: no awaits, no promises
 *     the caller has to handle, no error surface.
 *
 * Integrations (in priority order, all optional):
 *   1. `window.dataLayer.push` — GTM if the site ever adds it
 *   2. `window.plausible(name, { props })` — Plausible if configured
 *   3. `navigator.sendBeacon('/api/public/events', …)` — self-hosted endpoint
 *      (safe no-op if the route doesn't exist yet; sendBeacon errors are silent)
 *
 * Naming: dot.case events, snake_case props. Keep property values primitive.
 */

export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    plausible?: (event: string, options?: { props?: AnalyticsProps }) => void;
  }
}

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

/** Fire-and-forget event tracker. Never throws, never blocks. */
export function trackEvent(name: string, props: AnalyticsProps = {}): void {
  if (typeof window === "undefined") return;

  const cleaned: AnalyticsProps = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null) continue;
    cleaned[k] = v;
  }
  cleaned.ts = Date.now();
  cleaned.path = safe(() => window.location.pathname) ?? "";

  // 1. GTM dataLayer
  safe(() => {
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: name, ...cleaned });
    }
  });

  // 2. Plausible
  safe(() => {
    if (typeof window.plausible === "function") {
      window.plausible(name, { props: cleaned });
    }
  });

  // 3. Self-hosted beacon (no-op if endpoint absent — sendBeacon just returns false)
  safe(() => {
    if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return;
    const body = JSON.stringify({ name, props: cleaned });
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/public/events", blob);
  });
}
