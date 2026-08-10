/**
 * Throttle for unauthenticated server functions.
 *
 * Server functions are RPC endpoints on the published site: a public one is
 * reachable by anyone who can read the client bundle, exactly like a route
 * under /api/public. The route guards live in each handler via
 * `consumeRateLimit`; this is the same brake for the `createServerFn` side,
 * where there is no raw Response to attach headers to.
 *
 * As with the route limiter, this is a cost and abuse brake, not an
 * authorization boundary: the window is per-isolate and in-memory. Handlers
 * must still verify identity and ownership on their own.
 */
import { getRequest, setResponseHeader, setResponseStatus } from "@tanstack/react-start/server";

import {
  clientIp,
  consumeRateLimit,
  newTraceId,
  rateLimitHeaders,
  type RateLimitDecision,
} from "./rate-limit";

/** Budgets for public server functions, chosen by what one call costs us. */
export const PUBLIC_FN_LIMITS = {
  /** Writes an application, moves a CV into storage, queues scoring. */
  apply_submit: { max: 5, windowMs: 60_000 },
  /** Replaces a stored CV — storage write plus reprocessing. */
  apply_cv_replace: { max: 6, windowMs: 60_000 },
  /** Reference + email lookups. Throttled against reference enumeration. */
  apply_lookup: { max: 15, windowMs: 60_000 },
  /** Candidate self-service writes: withdraw, edit details, erase request. */
  candidate_write: { max: 10, windowMs: 60_000 },
  /** Funnel beacons. Generous — one page view can fire several. */
  candidate_event: { max: 60, windowMs: 60_000 },
  /** Booking writes: intake, hold a slot, reschedule, cancel. Sends email. */
  booking_write: { max: 10, windowMs: 60_000 },
  /** Booking reads keyed by session id. Throttled against id enumeration. */
  booking_read: { max: 30, windowMs: 60_000 },
  /** Marketing lead capture: DB write plus staff notification fan-out. */
  inquiry_submit: { max: 6, windowMs: 60_000 },
  /** One-time prefill token exchange. Throttled against token guessing. */
  lead_prefill: { max: 12, windowMs: 60_000 },
} as const;

export type PublicFnScope = keyof typeof PUBLIC_FN_LIMITS;

/**
 * Thrown when a public server function is called too often. The message is
 * user-facing: server-function errors surface to the caller, so it must read
 * as guidance and leak nothing about the endpoint.
 */
export class PublicFnRateLimitError extends Error {
  readonly code = "rate_limited";
  readonly traceId: string;
  readonly retryAfterSeconds: number;

  constructor(traceId: string, decision: RateLimitDecision) {
    super("Too many attempts from this connection. Wait a minute and try again.");
    this.name = "PublicFnRateLimitError";
    this.traceId = traceId;
    this.retryAfterSeconds = decision.retryAfterSeconds;
  }
}

/**
 * Records one call against the scope's budget and throws once it is spent.
 * Call it as the first statement of a public handler, before any database
 * read, model call or outbound email.
 *
 * Returns the trace id so the handler can thread it into its own audit rows.
 */
export function throttlePublicFn(scope: PublicFnScope): string {
  const traceId = newTraceId(scope);
  let request: Request | null = null;
  try {
    request = getRequest();
  } catch {
    // Outside a request context (tests, direct server-side reuse): no brake to
    // apply, and no reason to fail the call.
    return traceId;
  }

  const decision = consumeRateLimit(scope, clientIp(request), PUBLIC_FN_LIMITS[scope]);
  try {
    for (const [key, value] of Object.entries(rateLimitHeaders(decision, traceId))) {
      setResponseHeader(key, value);
    }
  } catch {
    // Header sink unavailable — the brake below still applies.
  }
  if (decision.limited) {
    try {
      setResponseStatus(429);
    } catch {
      /* status already committed */
    }
    throw new PublicFnRateLimitError(traceId, decision);
  }
  return traceId;
}
