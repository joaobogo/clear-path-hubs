// Runtime helpers to surface industry-specific blog posts on industry landing pages.
// Reads the `industry` and `topic` fields written by the industry-blog generator.
import { blog, estimateReadMinutes, extractExcerpt } from "@/lib/marketing/content";

export type IndustryBlogRow = {
  slug: string;
  title: string;
  description: string;
  heroImage?: string;
  category?: string;
  topic?: string;
  readMinutes: number;
  publishedAt?: string;
};

// Preferred order (matches the 5 generated topic templates).
const TOPIC_ORDER: string[] = [
  "hiring-benchmarks-2026",
  "top-roles-compensation-2026",
  "emerging-skills-shift-2026",
  "retention-culture-playbook",
  "workforce-outlook-2026",
];

export function listIndustryBlogPosts(industrySlug: string): IndustryBlogRow[] {
  const rows: IndustryBlogRow[] = [];
  for (const [slug, entry] of Object.entries(blog)) {
    const e = entry as unknown as {
      industry?: string;
      topic?: string;
      category?: string;
      markdown: string;
      meta: Record<string, string | undefined>;
    };
    if (e.industry !== industrySlug) continue;
    const meta = e.meta;
    rows.push({
      slug,
      title: meta.h1 || meta.title?.split("|")[0]?.trim() || slug.replace(/-/g, " "),
      description:
        meta.description || meta["og:description"] || extractExcerpt(e.markdown),
      heroImage: meta["og:image"] || undefined,
      category: e.category,
      topic: e.topic,
      readMinutes: estimateReadMinutes(e.markdown),
      publishedAt: meta["article:published_time"],
    });
  }
  rows.sort((a, b) => {
    const ia = TOPIC_ORDER.indexOf(a.topic || "");
    const ib = TOPIC_ORDER.indexOf(b.topic || "");
    if (ia === -1 && ib === -1) return a.slug.localeCompare(b.slug);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  return rows;
}
