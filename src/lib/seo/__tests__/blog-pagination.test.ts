import { describe, expect, it } from "vitest";
import {
  BLOG_PAGE_SIZE,
  blogPageCount,
  blogPageHead,
  blogPagePath,
  paginateBlog,
  resolveBlogPage,
} from "@/lib/seo/blog-pagination";
import { marketingHead } from "@/lib/marketing/head";

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ slug: `p${i}` }));

describe("paginateBlog", () => {
  it("handles an empty archive", () => {
    const r = paginateBlog(rows(0), 1, { withFeatured: true });
    expect(r).toMatchObject({ featured: null, items: [], page: 1, pages: 1, total: 0 });
  });

  it("shows a single post as featured with an empty list", () => {
    const r = paginateBlog(rows(1), 1, { withFeatured: true });
    expect(r.featured?.slug).toBe("p0");
    expect(r.items).toEqual([]);
    expect(r.pages).toBe(1);
  });

  it("24 posts: featured plus 23 in the list, one page", () => {
    const r = paginateBlog(rows(24), 1, { withFeatured: true });
    expect(r.items).toHaveLength(23);
    expect(r.pages).toBe(1);
  });

  it("25 posts: featured plus a full first page of 24, one page", () => {
    const r = paginateBlog(rows(25), 1, { withFeatured: true });
    expect(r.items).toHaveLength(BLOG_PAGE_SIZE);
    expect(r.pages).toBe(1);
  });

  it("26 posts spill one post to page 2", () => {
    const r2 = paginateBlog(rows(26), 2, { withFeatured: true });
    expect(r2.pages).toBe(2);
    expect(r2.items.map((x) => x.slug)).toEqual(["p25"]);
    expect(r2.featured).toBeNull();
  });

  it("48 and 49 posts: page counts and last page sizes", () => {
    expect(paginateBlog(rows(48), 1, { withFeatured: true }).pages).toBe(2);
    expect(paginateBlog(rows(48), 2, { withFeatured: true }).items).toHaveLength(23);
    expect(paginateBlog(rows(49), 2, { withFeatured: true }).items).toHaveLength(24);
    expect(paginateBlog(rows(49), 1, { withFeatured: true }).pages).toBe(2);
    expect(paginateBlog(rows(50), 3, { withFeatured: true }).items).toHaveLength(1);
  });

  it("never repeats or omits a post across pages (featured on)", () => {
    const all = rows(73);
    const seen: string[] = [];
    const first = paginateBlog(all, 1, { withFeatured: true });
    if (first.featured) seen.push(first.featured.slug);
    for (let p = 1; p <= first.pages; p++) {
      seen.push(...paginateBlog(all, p, { withFeatured: true }).items.map((x) => x.slug));
    }
    expect(seen).toHaveLength(73);
    expect(new Set(seen).size).toBe(73);
  });

  it("without a featured post (filtered view) lists every row", () => {
    const all = rows(30);
    const p1 = paginateBlog(all, 1, { withFeatured: false });
    const p2 = paginateBlog(all, 2, { withFeatured: false });
    expect(p1.featured).toBeNull();
    expect([...p1.items, ...p2.items]).toHaveLength(30);
    expect(p1.pages).toBe(2);
  });

  it("clamps an over-large page to the last page", () => {
    expect(paginateBlog(rows(60), 99, { withFeatured: true }).page).toBe(3);
  });

  it("blogPageCount matches paginateBlog for the unfiltered archive", () => {
    for (const n of [0, 1, 24, 25, 26, 48, 49, 50, 200]) {
      expect(blogPageCount(n)).toBe(paginateBlog(rows(n), 1, { withFeatured: true }).pages);
    }
  });
});

describe("resolveBlogPage", () => {
  it("accepts a missing page and valid pages in range", () => {
    expect(resolveBlogPage(undefined, 3)).toEqual({ kind: "ok", page: 1 });
    expect(resolveBlogPage(2, 3)).toEqual({ kind: "ok", page: 2 });
    expect(resolveBlogPage("3", 3)).toEqual({ kind: "ok", page: 3 });
  });

  it("redirects page=1 and junk to /blog (page 1)", () => {
    for (const raw of [1, "1", 0, "0", "abc", 1.5, "1.5", -2, "", NaN, "2abc", {}, true]) {
      const r = resolveBlogPage(raw, 3);
      if (raw === "") expect(r).toEqual({ kind: "ok", page: 1 });
      else expect(r).toEqual({ kind: "redirect", page: 1 });
    }
  });

  it("redirects a page past the end to the last page", () => {
    expect(resolveBlogPage(9, 3)).toEqual({ kind: "redirect", page: 3 });
    expect(resolveBlogPage(9, 1)).toEqual({ kind: "redirect", page: 1 });
  });
});

describe("blog archive head", () => {
  const entry = {
    markdown: "",
    meta: { title: "TaaSFlow Blog", description: "Strategies for talent teams." },
  } as unknown as Parameters<typeof marketingHead>[0];

  const headFor = (page: number, pages: number) => {
    const h = blogPageHead(page, pages);
    return marketingHead(
      page === 1 ? entry : undefined,
      h.path,
      h.fallback ?? { title: "x", description: "y" },
      { prevPath: h.prevPath, nextPath: h.nextPath },
    );
  };
  const meta = (head: ReturnType<typeof headFor>, key: string) =>
    head.meta.find((m) => ("name" in m && m.name === key) || ("property" in m && m.property === key)) as
      | { content: string }
      | undefined;

  it("page 2 canonicalises to itself with its own title, description and og:url", () => {
    const head = headFor(2, 3);
    expect(head.links).toContainEqual({ rel: "canonical", href: "https://taasflow.com/blog?page=2" });
    expect(meta(head, "og:url")!.content).toBe("https://taasflow.com/blog?page=2");
    expect((head.meta.find((m) => "title" in m) as { title: string }).title).toContain("Page 2");
    expect(meta(head, "description")!.content).toContain("Page 2");
  });

  it("page 1 canonicalises to /blog", () => {
    expect(headFor(1, 3).links).toContainEqual({ rel: "canonical", href: "https://taasflow.com/blog" });
  });

  it("emits rel prev and next", () => {
    const mid = headFor(2, 3).links;
    expect(mid).toContainEqual({ rel: "prev", href: "https://taasflow.com/blog" });
    expect(mid).toContainEqual({ rel: "next", href: "https://taasflow.com/blog?page=3" });
    const first = headFor(1, 3).links;
    expect(first.some((l) => l.rel === "prev")).toBe(false);
    expect(first).toContainEqual({ rel: "next", href: "https://taasflow.com/blog?page=2" });
    const last = headFor(3, 3).links;
    expect(last.some((l) => l.rel === "next")).toBe(false);
  });

  it("blogPagePath leaves page 1 without a parameter", () => {
    expect(blogPagePath(1)).toBe("/blog");
    expect(blogPagePath(4)).toBe("/blog?page=4");
  });
});
