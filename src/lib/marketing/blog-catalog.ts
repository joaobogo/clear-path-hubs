// Unified blog catalog. Merges the curated manifest with runtime-generated
// industry posts so both surface on /blog and /blog/$slug without a manifest
// regeneration step.
import { blog, estimateReadMinutes, extractExcerpt } from "@/lib/marketing/content";
import {
  BLOG_METADATA,
  INCLUDED_BLOG_SLUGS,
} from "@/lib/marketing/blog-manifest";

export type BlogRow = {
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  publishedAt?: string;
  readMinutes: number;
  heroImage?: string;
  industry?: string;
};

function readMeta(slug: string): BlogRow | null {
  const b = blog[slug];
  if (!b) return null;
  const e = b as unknown as {
    industry?: string;
    category?: string;
    tags?: string[];
    markdown: string;
    meta: Record<string, string | undefined>;
  };
  const meta = e.meta;
  const title =
    meta.h1 || meta.title?.split("|")[0]?.trim() || slug.replace(/-/g, " ");
  const curated = BLOG_METADATA[slug];
  return {
    slug,
    title,
    description:
      meta.description || meta["og:description"] || extractExcerpt(e.markdown),
    category: curated?.category ?? e.category ?? "General",
    tags: curated?.tags ?? e.tags ?? [],
    publishedAt: meta["article:published_time"],
    readMinutes: estimateReadMinutes(e.markdown),
    heroImage: meta["og:image"] || undefined,
    industry: e.industry,
  };
}

let cached: BlogRow[] | null = null;

export function listAllBlogRows(): BlogRow[] {
  if (cached) return cached;
  const seen = new Set<string>();
  const rows: BlogRow[] = [];

  for (const slug of INCLUDED_BLOG_SLUGS) {
    if (seen.has(slug)) continue;
    const r = readMeta(slug);
    if (r) {
      rows.push(r);
      seen.add(slug);
    }
  }
  // Include any additional posts that ship with a JSON file and declare an industry.
  for (const slug of Object.keys(blog)) {
    if (seen.has(slug)) continue;
    const r = readMeta(slug);
    if (!r) continue;
    if (!r.industry) continue; // only auto-include industry posts here
    rows.push(r);
    seen.add(slug);
  }

  rows.sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));
  cached = rows;
  return rows;
}

export function isPublishedBlogSlug(slug: string): boolean {
  return listAllBlogRows().some((r) => r.slug === slug);
}

export function getBlogRow(slug: string): BlogRow | null {
  return listAllBlogRows().find((r) => r.slug === slug) ?? null;
}
