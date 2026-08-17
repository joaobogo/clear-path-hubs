/**
 * Kill switch for QA-only public routes (destructive seed / cleanup fixtures).
 *
 * These routes must be impossible to invoke in production. The gate is
 * fail-closed: unless ENABLE_QA_ENDPOINTS is explicitly set to a truthy value
 * in the server environment, the route answers 404 before any token check,
 * body read, or rate-limit bookkeeping runs — so production cannot even
 * confirm the endpoint exists.
 *
 * Server-only: read inside the handler, never imported by client code.
 */

const TRUTHY = new Set(["1", "true", "yes", "on", "enabled"]);

export function qaEndpointsEnabled(): boolean {
  const raw = process.env["ENABLE_QA_ENDPOINTS"];
  if (!raw) return false;
  return TRUTHY.has(raw.trim().toLowerCase());
}

/** Returns a 404 Response when QA endpoints are disabled, otherwise null. */
export function qaEndpointDisabledResponse(): Response | null {
  if (qaEndpointsEnabled()) return null;
  return new Response("Not Found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
