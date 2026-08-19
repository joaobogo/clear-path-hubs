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
 * Crawlers named explicitly so answer engines (ChatGPT, Claude, Perplexity,
 * Google AI surfaces, Copilot) get the same allow/disallow set as Googlebot
 * instead of relying on their handling of the wildcard group.
 */
const NAMED_CRAWLERS = [
  "Googlebot",
  "Bingbot",
  "Google-Extended",
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Applebot",
  "Applebot-Extended",
  "CCBot",
] as const;

export function buildRobotsTxt(): string {
  const group = (agent: string) => [
    `User-agent: ${agent}`,
    "Allow: /",
    ...DISALLOWED_PATHS.map((p) => `Disallow: ${p}`),
    "",
  ];
  return [
    ...group("*"),
    ...NAMED_CRAWLERS.flatMap((agent) => group(agent)),
    `Sitemap: ${SITEMAP_URL}`,
    "",
  ].join("\n");
}
