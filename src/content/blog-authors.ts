/**
 * Blog author registry.
 *
 * Every post must resolve to a registered author with a real, described
 * identity — a named team member, or the editorial team with its own
 * about-the-team note. The bare legacy byline "TaaSFlow" is not an author:
 * scripts/scaled-content-check.mjs fails the build on any post that still
 * carries it, or that names an author who isn't registered here.
 *
 * Add a named author only for someone who actually reviewed or wrote the
 * piece, with an accurate role. Never invent credentials.
 */
export type BlogAuthor = {
  id: string;
  /** Byline as rendered on the post. */
  name: string;
  /** Schema.org type used in the article JSON-LD. */
  type: "Person" | "Organization";
  /** Short role line shown next to the byline. */
  role: string;
  /** About-the-author / about-the-team note shown at the foot of the post. */
  note: string;
  /** Optional page describing the author or team. */
  url?: string;
};

export const EDITORIAL_TEAM_ID = "taasflow-editorial-team";

export const BLOG_AUTHORS: Record<string, BlogAuthor> = {
  [EDITORIAL_TEAM_ID]: {
    id: EDITORIAL_TEAM_ID,
    name: "TaaSFlow Editorial Team",
    type: "Organization",
    role: "Recruiting operations and research desk",
    note:
      "Published by the TaaSFlow editorial team. This is a team byline, not an individual reviewer. Where a post gives a figure, it names the source or labels the figure as illustrative.",
    url: "/about",
  },
};

const LEGACY_BYLINES = new Set(["", "taasflow", "taasflow team", "admin", "editor"]);

/** Resolves a raw meta.author value to a registered author. */
export function resolveBlogAuthor(raw?: string): BlogAuthor {
  const value = (raw ?? "").trim();
  if (!value || LEGACY_BYLINES.has(value.toLowerCase())) {
    return BLOG_AUTHORS[EDITORIAL_TEAM_ID];
  }
  const byName = Object.values(BLOG_AUTHORS).find(
    (a) => a.name.toLowerCase() === value.toLowerCase() || a.id === value,
  );
  return byName ?? BLOG_AUTHORS[EDITORIAL_TEAM_ID];
}

/** Byline values a post is allowed to declare. */
export function isRegisteredAuthor(raw?: string): boolean {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value || LEGACY_BYLINES.has(value)) return false;
  return Object.values(BLOG_AUTHORS).some(
    (a) => a.name.toLowerCase() === value || a.id === value,
  );
}
