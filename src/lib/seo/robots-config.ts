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
 * One `User-agent: *` group applies to every crawler, including GPTBot,
 * ClaudeBot, PerplexityBot and Google-Extended. AI crawlers are intentionally
 * allowed: the same rules as search engines, no per-bot overrides. Repeating
 * the whole rule set per bot invites drift and adds nothing.
 */
export function buildRobotsTxt(): string {
  return [
    "# AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended) are intentionally",
    "# allowed. They follow the same single group below; there are no per-bot rules.",
    "User-agent: *",
    "Allow: /",
    ...DISALLOWED_PATHS.map((p) => `Disallow: ${p}`),
    "",
    `Sitemap: ${SITEMAP_URL}`,
    "",
  ].join("\n");
}
