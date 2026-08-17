/**
 * Authorization for POST /api/public/pipeline/run.
 *
 * Running the pipeline burns LLM budget, so the endpoint is gated by a
 * dedicated server-only secret, `PIPELINE_RUN_TOKEN`, presented in the
 * `x-pipeline-run-token` header. The publishable/anon key is NOT accepted:
 * it ships in every browser bundle.
 *
 * The scheduler secret `CRON_INVOKE_SECRET` (`x-cron-secret`) stays accepted
 * so the existing pg_cron drain job keeps working; it is also server-only and
 * never reaches the client bundle.
 *
 * Comparison is length-checked and constant-time. A missing/blank token fails
 * closed — an unconfigured environment must not become an open endpoint.
 */

import { CRON_SECRET_HEADER } from "./cron-auth";

/** Header the internal caller uses to present the dedicated pipeline token. */
export const PIPELINE_RUN_TOKEN_HEADER = "x-pipeline-run-token";

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
 * Returns `null` when the caller presented a valid server-only secret, or a
 * ready-to-return 401 Response otherwise.
 */
export function requirePipelineRunToken(request: Request): Response | null {
  const pipelineToken = (process.env["PIPELINE_RUN_TOKEN"] ?? "").trim();
  const provided = (request.headers.get(PIPELINE_RUN_TOKEN_HEADER) ?? "").trim();
  if (pipelineToken && provided && constantTimeEqual(provided, pipelineToken)) return null;

  // Scheduler fallback: pg_cron presents CRON_INVOKE_SECRET.
  const cronSecret = (process.env["CRON_INVOKE_SECRET"] ?? "").trim();
  const cronProvided = (
    request.headers.get(CRON_SECRET_HEADER) ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    ""
  ).trim();
  if (cronSecret && cronProvided && constantTimeEqual(cronProvided, cronSecret)) return null;

  return unauthorized();
}
