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

/**
 * Production can never enable these routes, whatever the environment says.
 * The flag is only consulted outside production (local dev / CI harness), so a
 * leaked or mis-set ENABLE_QA_ENDPOINTS on the live deployment is inert.
 */
function isProductionRuntime(): boolean {
  const node = process.env["NODE_ENV"]?.trim().toLowerCase();
  if (node === "production") return true;
  const env = process.env["APP_ENV"]?.trim().toLowerCase();
  return env === "production" || env === "prod";
}

export function qaEndpointsEnabled(): boolean {
  if (isProductionRuntime()) return false;
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
