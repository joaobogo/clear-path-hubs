/**
 * Authorization for scheduler-only endpoints under /api/public/*.
 *
 * These routes are cost- and email-triggering: running one sends mail or burns
 * LLM budget. They must therefore be gated by a real server-only secret, never
 * by the project's publishable key — that key ships in every browser bundle,
 * so anyone reading the client code could replay the job.
 *
 * The scheduler presents the secret in the `x-cron-secret` header (an
 * `authorization: Bearer <secret>` header is accepted for callers that cannot
 * set custom headers). Comparison is length-checked and constant-time so a
 * wrong guess leaks nothing about the correct value.
 */

/** Header the scheduler uses to present the shared secret. */
export const CRON_SECRET_HEADER = "x-cron-secret";

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Returns `null` when the caller is the scheduler, or a ready-to-return 401
 * Response otherwise. A missing/blank `CRON_INVOKE_SECRET` fails closed: an
 * unconfigured environment must not silently become an open endpoint.
 */
export function requireCronSecret(request: Request): Response | null {
  const expected = (process.env["CRON_INVOKE_SECRET"] ?? "").trim();
  if (!expected) return unauthorized();

  const provided = (
    request.headers.get(CRON_SECRET_HEADER) ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    ""
  ).trim();

  if (!provided || !constantTimeEqual(provided, expected)) return unauthorized();
  return null;
}
