/**
 * Per-IP throttle for unauthenticated public endpoints.
 *
 * Every route under /api/public is reachable by anyone with curl. Several of
 * them cost real money on each call (LLM gateway, outbound email, auth admin
 * writes), so an unthrottled endpoint is a spend and abuse hole even when its
 * authorization is correct.
 *
 * The window is per-isolate and in-memory: it is a cost brake and a bot brake,
 * not a security boundary. Authorization must always be enforced separately in
 * the handler — never inferred from "they were not rate limited".
 */

type Window = { max: number; windowMs: number };

const buckets = new Map<string, Map<string, number[]>>();

/** The caller's IP as seen by the edge, falling back to a shared "unknown" bucket. */
export function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/**
 * Returns true when this IP has exceeded `max` calls to `scope` in the window.
 * Each scope keeps its own bucket so a cheap form cannot exhaust the budget of
 * an expensive one, or vice versa.
 */
export function rateLimited(scope: string, ip: string, opts: Window): boolean {
  let bucket = buckets.get(scope);
  if (!bucket) {
    bucket = new Map();
    buckets.set(scope, bucket);
  }
  const now = Date.now();
  const recent = (bucket.get(ip) ?? []).filter((t) => now - t < opts.windowMs);
  recent.push(now);
  bucket.set(ip, recent);
  // Bound memory on a hostile spread of source addresses.
  if (bucket.size > 5000) bucket.clear();
  return recent.length > opts.max;
}

/** Budgets chosen per endpoint by what a single call costs us. */
export const PUBLIC_RATE_LIMITS = {
  /** Creates an auth user, an org and a position. */
  intake: { max: 5, windowMs: 60_000 },
  express_intake: { max: 5, windowMs: 60_000 },
  /** Writes a message and sends staff alerts. */
  contact: { max: 5, windowMs: 60_000 },
  /** Calls a paid LLM with up to 60k characters. Strictest budget here. */
  jd_requirements: { max: 6, windowMs: 60_000 },
} as const;

/** Standard 429 body. `retry_after_seconds` is advisory. */
export function rateLimitResponse(traceId: string, windowMs: number) {
  return Response.json(
    {
      ok: false,
      trace_id: traceId,
      error: "rate_limited",
      message: "Too many attempts from this connection. Wait a minute and try again.",
    },
    { status: 429, headers: { "retry-after": String(Math.ceil(windowMs / 1000)) } },
  );
}
