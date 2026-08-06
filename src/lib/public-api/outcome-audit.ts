/**
 * Audit trail for refused public requests.
 *
 * A 429 or a 409 on a public endpoint is a real security-relevant outcome: one
 * is an abuse/spend signal, the other is us refusing to write into an account
 * or workspace the caller has not proven they own. Both were previously
 * invisible after the response left the isolate, which made "someone is
 * hammering intake" and "a client cannot get into their own workspace"
 * impossible to investigate.
 *
 * Writes are best-effort: instrumentation never fails the request it observes,
 * and never records the raw payload — only the outcome, the scope and a
 * coarse caller fingerprint.
 */

type ThrottleAudit = {
  scope: string;
  traceId: string;
  ip: string;
  path: string;
  limit: number;
  retryAfterSeconds: number;
};

type ConflictAudit = {
  scope: string;
  traceId: string;
  ip: string;
  path: string;
  /** Machine code returned to the caller, e.g. account_exists. */
  reason: string;
  /** Optional non-identifying detail (email domain, org id) for triage. */
  detail?: Record<string, string | null>;
};

/** Never store a full address; the domain is enough to spot a pattern. */
export function emailDomain(email: string | null | undefined): string | null {
  const at = (email ?? "").lastIndexOf("@");
  return at > -1 ? email!.slice(at + 1).toLowerCase() : null;
}

/** Coarse fingerprint: enough to correlate bursts, not a stored identifier. */
function ipHint(ip: string): string {
  if (ip === "unknown") return "unknown";
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.x.x` : `${ip.split(":")[0]}:…`;
}

async function record(action: string, after: Record<string, unknown>) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_events").insert({
      action,
      entity_type: "public_api",
      after_state: after as never,
    });
  } catch (err) {
    console.error(`[public-api] audit write failed for ${action}`, err);
  }
}

/** A 429: the caller exhausted the budget for this endpoint. */
export async function auditRateLimited(event: ThrottleAudit): Promise<void> {
  console.warn("[public-api] rate limited", {
    scope: event.scope,
    traceId: event.traceId,
    path: event.path,
  });
  await record("public_api.rate_limited", {
    outcome: "rate_limited",
    status: 429,
    scope: event.scope,
    trace_id: event.traceId,
    path: event.path,
    limit: event.limit,
    retry_after_seconds: event.retryAfterSeconds,
    ip_hint: ipHint(event.ip),
  });
}

/** A 409: we refused to act on an existing account or workspace. */
export async function auditConflict(event: ConflictAudit): Promise<void> {
  console.warn("[public-api] conflict refused", {
    scope: event.scope,
    reason: event.reason,
    traceId: event.traceId,
  });
  await record("public_api.conflict", {
    outcome: "conflict",
    status: 409,
    scope: event.scope,
    reason: event.reason,
    trace_id: event.traceId,
    path: event.path,
    ip_hint: ipHint(event.ip),
    ...(event.detail ?? {}),
  });
}

type OversizeAudit = {
  scope: string;
  traceId: string;
  ip: string;
  path: string;
  /** Machine code returned to the caller, e.g. payload_too_large. */
  reason: string;
  /** Sizes only — never the payload itself. */
  detail?: Record<string, number | string>;
};

/** A 413: the caller sent more than this endpoint will read or tokenize. */
export async function auditPayloadTooLarge(event: OversizeAudit): Promise<void> {
  console.warn("[public-api] payload refused", {
    scope: event.scope,
    reason: event.reason,
    traceId: event.traceId,
  });
  await record("public_api.payload_too_large", {
    outcome: "payload_too_large",
    status: 413,
    scope: event.scope,
    reason: event.reason,
    trace_id: event.traceId,
    path: event.path,
    ip_hint: ipHint(event.ip),
    ...(event.detail ?? {}),
  });
}
