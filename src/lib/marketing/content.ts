// Loads scraped source content bundled at build time.
export type ContentEntry = {
  url: string;
  meta: {
    title?: string;
    description?: string;
    "og:title"?: string;
    "og:description"?: string;
    "og:image"?: string;
    "og:type"?: string;
    h1?: string;
  };
  markdown: string;
};

const pagesMap = import.meta.glob<ContentEntry>("../../content/pages/*.json", {
  eager: true,
  import: "default",
});
const blogMap = import.meta.glob<ContentEntry>("../../content/blog/*.json", {
  eager: true,
  import: "default",
});
const industriesMap = import.meta.glob<ContentEntry>("../../content/industries/*.json", {
  eager: true,
  import: "default",
});

function toRecord(map: Record<string, ContentEntry>): Record<string, ContentEntry> {
  const out: Record<string, ContentEntry> = {};
  for (const [path, val] of Object.entries(map)) {
    const slug = path.split("/").pop()!.replace(/\.json$/, "");
    out[slug] = val;
  }
  return out;
}

export const pages = toRecord(pagesMap);
export const blog = toRecord(blogMap);
export const industries = toRecord(industriesMap);

export function getPage(slug: string): ContentEntry | undefined {
  return pages[slug];
}
export function getBlogPost(slug: string): ContentEntry | undefined {
  return blog[slug];
}
export function getIndustry(slug: string): ContentEntry | undefined {
  return industries[slug];
}

export function listBlogSlugs(): string[] {
  return Object.keys(blog).sort();
}
export function listIndustrySlugs(): string[] {
  // Canonical list is the v2 taxonomy; legacy JSON slugs are absorbed into it.
  // `non-profit` is a source-slug redirect → excluded from sitemap.
  // `index`/`industries`/`compare` are hub/utility files, not pages.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { INDUSTRY_ENTRIES } = require("@/content/industries-v2") as {
    INDUSTRY_ENTRIES: { slug: string }[];
  };
  return INDUSTRY_ENTRIES.map((e) => e.slug).sort();
}

export function estimateReadMinutes(md: string): number {
  const words = md.split(/\s+/).length;
  return Math.max(1, Math.round(words / 220));
}

export function extractExcerpt(md: string, max = 180): string {
  // strip markdown syntax roughly
  const clean = md
    .replace(/^#+\s+.*$/gm, "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_>`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
}
