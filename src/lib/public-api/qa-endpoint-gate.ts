/**
 * Kill switch for QA-only public routes (destructive seed / cleanup fixtures).
 *
 * These routes must be impossible to invoke in production, and that must not
 * depend on an environment variable being absent. The switch is therefore the
 * build mode itself: `import.meta.env.DEV` is true only for the local Vite dev
 * server, and is statically false in every production/preview build, so the
 * enabling branch is dead code in the deployed bundle. No secret, no token and
 * no flag can re-open it after launch.
 *
 * The local E2E harness (which runs against the dev server on :8080) is the
 * only caller that ever sees these routes.
 *
 * Server-only: read inside the handler, never imported by client code.
 */

/** Cookie value the E2E harness presents to opt into test-record reads. */
export const QA_E2E_COOKIE = "qa_e2e";

function isDevBuild(): boolean {
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

/**
 * `isDev` is injectable for tests only; production callers must not pass it.
 */
export function qaEndpointsEnabled(isDev: boolean = isDevBuild()): boolean {
  return isDev === true;
}

/**
 * Returns a 404 Response when QA endpoints are disabled, otherwise null.
 *
 * `isDev` is injectable for the same reason it is on qaEndpointsEnabled, and
 * production callers must not pass it. Without it the closed branch could not
 * be tested at all: vitest runs with import.meta.env.DEV true, so this always
 * returned null under test and the one assertion covering the kill switch for
 * the destructive QA routes could never reach the code it was written for.
 */
export function qaEndpointDisabledResponse(isDev?: boolean): Response | null {
  if (qaEndpointsEnabled(isDev ?? isDevBuild())) return null;
  return new Response("Not Found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
