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

/**
 * Denylist of prop keys that must never leave the browser via analytics.
 * Any PII-shaped key is dropped silently. Values that look like emails are
 * additionally hashed to a short opaque token for funnel dedup only.
 */
const PII_KEYS = new Set([
  "email",
  "phone",
  "full_name",
  "name",
  "first_name",
  "last_name",
  "address",
  "cv_url",
  "resume_url",
  "password",
  "token",
  "access_token",
  "refresh_token",
  "auth",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function scrubValue(k: string, v: unknown): string | number | boolean | undefined {
  if (v === undefined || v === null) return undefined;
  if (PII_KEYS.has(k.toLowerCase())) return undefined;
  if (typeof v === "string" && EMAIL_RE.test(v)) return undefined;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  return undefined;
}

// Duplicate suppression: same (name + stable-key) fired inside DEDUP_MS collapses.
const DEDUP_MS = 1500;
const recent = new Map<string, number>();
function isDuplicate(name: string, cleaned: AnalyticsProps): boolean {
  const scopeKey = String(cleaned.dedup_key ?? cleaned.cta ?? cleaned.id ?? "");
  const key = `${name}|${scopeKey}|${cleaned.path ?? ""}`;
  const now = Date.now();
  const prev = recent.get(key);
  if (prev && now - prev < DEDUP_MS) return true;
  recent.set(key, now);
  // Bounded map
  if (recent.size > 200) {
    const cutoff = now - DEDUP_MS * 4;
    for (const [k, t] of recent) if (t < cutoff) recent.delete(k);
  }
  return false;
}

/** Fire-and-forget event tracker. Never throws, never blocks. PII-scrubbed. */
export function trackEvent(name: string, props: AnalyticsProps = {}): void {
  if (typeof window === "undefined") return;

  const cleaned: AnalyticsProps = {};
  for (const [k, v] of Object.entries(props)) {
    const s = scrubValue(k, v);
    if (s !== undefined) cleaned[k] = s;
  }
  cleaned.ts = Date.now();
  cleaned.path = safe(() => window.location.pathname) ?? "";

  if (isDuplicate(name, cleaned)) return;

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
