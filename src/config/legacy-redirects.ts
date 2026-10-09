/**
 * Permanent (301) redirects for public pages that were merged into another page.
 *
 * Each retired path maps to the page and section that now carries its content.
 * The same table drives three things, so they cannot drift apart:
 *   - the request-level 301 in `src/start.ts` (real HTTP status, query kept),
 *   - the matching `beforeLoad` redirect in each retired route file (client-side
 *     navigation and any request that skips the middleware),
 *   - the unit test that rejects a target which is itself redirected (no chains).
 *
 * Do not delete an entry: old links, bookmarks and indexed URLs keep working
 * only while the 301 stays in place.
 */

export type LegacyRedirect = {
  /** Destination path. Never a retired path itself. */
  to: string;
  /** Section id on the destination page, without the leading `#`. */
  hash?: string;
};

export const LEGACY_REDIRECTS: Readonly<Record<string, LegacyRedirect>> = {
  // Product pages folded into one "How it works" page.
  "/platform": { to: "/how-it-works", hash: "workspace" },
  "/system": { to: "/how-it-works", hash: "scoring" },
  "/employer-onboarding": { to: "/how-it-works", hash: "steps" },
  // Trust pack folded into the security page.
  "/trust": { to: "/security" },
  // Company story folded into About.
  "/journey": { to: "/about", hash: "story" },
};

export const LEGACY_REDIRECT_PATHS: readonly string[] = Object.keys(LEGACY_REDIRECTS);

/** Normalise a request path: no trailing slash, lower case. */
function bare(pathname: string): string {
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return trimmed.toLowerCase();
}

/** The redirect for a retired path, or null when the path is live. */
export function legacyRedirectFor(pathname: string): LegacyRedirect | null {
  return LEGACY_REDIRECTS[bare(pathname)] ?? null;
}

/** Destination as a path with an optional `#section`. */
export function legacyRedirectTarget(pathname: string): string | null {
  const hit = legacyRedirectFor(pathname);
  if (!hit) return null;
  return hit.hash ? `${hit.to}#${hit.hash}` : hit.to;
}
