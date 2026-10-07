import { describe, expect, it } from "vitest";
import { NOINDEX_BLOG_SLUGS } from "@/lib/seo/blog-noindex";
import { collectBlogEntries } from "@/lib/seo/index-config";
import { INCLUDED_BLOG_SLUGS } from "@/lib/marketing/blog-manifest";

describe("noindexed blog posts", () => {
  it("only lists live posts, so the list cannot rot", () => {
    for (const slug of NOINDEX_BLOG_SLUGS) expect(INCLUDED_BLOG_SLUGS).toContain(slug);
  });
  it("keeps them out of the blog sitemap", () => {
    const paths = new Set(collectBlogEntries().map((e) => e.path));
    for (const slug of NOINDEX_BLOG_SLUGS) expect(paths.has(`/blog/${slug}`)).toBe(false);
  });
});
