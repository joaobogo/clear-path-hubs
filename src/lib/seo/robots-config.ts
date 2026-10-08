/**
 * Static robots.txt configuration.
 *
 * Kept separate from sitemap/dynamic content so it can be imported by a Node
 * build script (scripts/generate-robots-txt.ts) without pulling in Vite-only
 * APIs such as import.meta.glob.
 */
import { CANONICAL_ORIGIN } from "@/lib/canonical-origin";

/** Canonical production origin — shared with every `rel=canonical` tag. */
export const BASE_URL = CANONICAL_ORIGIN;

export const SITEMAP_URL = `${BASE_URL}/sitemap.xml`;

/** Paths crawlers must never fetch. Mirrors the `noindex` subtrees in the app. */
export const DISALLOWED_PATHS = [
  "/admin",
  "/client",
  "/me",
  "/boardroom",
  "/login",
  "/auth",
  "/checkout",
  "/book-call",
  "/share/",
  "/shortlist/",
  "/api/",
  "/_authenticated/",
  "/reset-password",
  "/access-denied",
  "/unauthorized",
  "/brand-center",
  "/dev/",
  "/dev.catalogue",
  "/dev.industry-coverage",
  "/lovable/",
] as const;

/**
 * One rule set for every compliant crawler. Keeping a single group prevents
 * duplicated directives while leaving public content open to search and
 * answer engines.
 */
export function buildRobotsTxt(): string {
  return [
    "User-agent: *",
    "Allow: /",
    ...DISALLOWED_PATHS.map((p) => `Disallow: ${p}`),
    "",
    `Sitemap: ${SITEMAP_URL}`,
    "",
  ].join("\n");
}
