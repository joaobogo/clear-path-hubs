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

/** What the caller learns about their budget after one attempt. */
export type RateLimitDecision = {
  scope: string;
  limited: boolean;
  limit: number;
  /** Calls left in the current window (never below 0). */
  remaining: number;
  /** Unix seconds when the oldest call in the window ages out. */
  resetAt: number;
  /** Seconds the caller should wait before retrying. */
  retryAfterSeconds: number;
};

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
 * A trace ID that carries its own context: scope, minute-resolution timestamp
 * and randomness. When a user pastes one into support, the endpoint and the
 * time window are readable without a lookup, and it still joins cleanly to the
 * audit row written for the same outcome.
 */
export function newTraceId(scope: string): string {
  const slug = scope.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 24) || "public";
  const stamp = Date.now().toString(36);
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  return `${slug}-${stamp}-${rand}`;
}

/**
 * Records one attempt and reports the caller's remaining budget. Each scope
 * keeps its own bucket so a cheap form cannot exhaust the budget of an
 * expensive one, or vice versa.
 */
export function consumeRateLimit(scope: string, ip: string, opts: Window): RateLimitDecision {
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

  const oldest = recent[0] ?? now;
  const resetMs = oldest + opts.windowMs;
  return {
    scope,
    limited: recent.length > opts.max,
    limit: opts.max,
    remaining: Math.max(0, opts.max - recent.length),
    resetAt: Math.ceil(resetMs / 1000),
    retryAfterSeconds: Math.max(1, Math.ceil((resetMs - now) / 1000)),
  };
}

/** Back-compatible boolean form. */
export function rateLimited(scope: string, ip: string, opts: Window): boolean {
  return consumeRateLimit(scope, ip, opts).limited;
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
  /** Creates an auth user from a public form. */
  intake_account: { max: 8, windowMs: 60_000 },
  /** Writes a CRM submission row and calls an external CRM. */
  crm_submission: { max: 5, windowMs: 60_000 },
  /** Kicks off a paid blueprint model run for one intake. */
  blueprint_run: { max: 10, windowMs: 60_000 },
  /** Anonymous draft load/save, and the emailed resume link. */
  intake_draft: { max: 30, windowMs: 60_000 },
  /** Status polling by id. Throttled against id enumeration. */
  public_status_read: { max: 40, windowMs: 60_000 },
  /** Calendar file download for one booking. */
  booking_ics: { max: 20, windowMs: 60_000 },
} as const;

/** Byte ceilings per public endpoint, sized to the largest legitimate payload. */
export const PUBLIC_BODY_LIMITS = {
  contact: 32_768,
  intake: 512_000,
  express_intake: 512_000,
  intake_account: 8_192,
  intake_draft: 512_000,
  crm_submission: 131_072,
  blueprint_run: 4_096,
  pipeline_run: 4_096,
  qa_seed: 65_536,
  webhook: 262_144,
} as const;

/**
 * Budget headers for any response on a throttled endpoint, so well-behaved
 * clients can pace themselves instead of discovering the limit by hitting it.
 * Both the draft standard (`RateLimit-*`) and the widely-implemented
 * `X-RateLimit-*` names are sent.
 */
export function rateLimitHeaders(
  decision: RateLimitDecision,
  traceId?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    "ratelimit-limit": String(decision.limit),
    "ratelimit-remaining": String(decision.remaining),
    "ratelimit-reset": String(decision.retryAfterSeconds),
    "ratelimit-policy": `${decision.limit};w=${decision.retryAfterSeconds}`,
    "x-ratelimit-limit": String(decision.limit),
    "x-ratelimit-remaining": String(decision.remaining),
    "x-ratelimit-reset": String(decision.resetAt),
    "x-ratelimit-scope": decision.scope,
  };
  if (decision.limited) headers["retry-after"] = String(decision.retryAfterSeconds);
  if (traceId) headers["x-trace-id"] = traceId;
  return headers;
}

/** Copies budget + trace headers onto a response built elsewhere. */
export function withRateLimitHeaders(
  response: Response,
  decision: RateLimitDecision,
  traceId?: string,
): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(rateLimitHeaders(decision, traceId))) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}

/** Standard 429 body, with budget, trace and retry headers attached. */
export function rateLimitResponse(traceId: string, decision: RateLimitDecision) {
  return Response.json(
    {
      ok: false,
      trace_id: traceId,
      error: "rate_limited",
      message: "Too many attempts from this connection. Wait a minute and try again.",
      retry_after_seconds: decision.retryAfterSeconds,
    },
    { status: 429, headers: rateLimitHeaders(decision, traceId) },
  );
}

/**
 * Standard 409 body. Conflicts on these endpoints are refusals to touch an
 * existing account or workspace, so the trace header lets support tie the
 * user's report to the audit row without asking for a screenshot.
 */
export function conflictResponse(
  traceId: string,
  error: string,
  message: string,
  decision?: RateLimitDecision,
) {
  return Response.json(
    { ok: false, trace_id: traceId, error, message },
    {
      status: 409,
      headers: decision
        ? rateLimitHeaders(decision, traceId)
        : { "x-trace-id": traceId },
    },
  );
}
