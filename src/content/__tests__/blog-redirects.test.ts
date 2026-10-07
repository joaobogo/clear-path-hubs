import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BLOG_REDIRECTS, resolveBlogRedirect } from "@/content/blog-redirects";
import { INCLUDED_BLOG_SLUGS } from "@/lib/marketing/blog-manifest";
import { listAllBlogRows } from "@/lib/marketing/blog-catalog";

const BLOG_DIR = join(process.cwd(), "src/content/blog");

type PostFile = { industry?: string; status?: string };

function readPosts(): Map<string, PostFile> {
  const posts = new Map<string, PostFile>();
  for (const f of readdirSync(BLOG_DIR).filter((n) => n.endsWith(".json"))) {
    posts.set(f.replace(/\.json$/, ""), JSON.parse(readFileSync(join(BLOG_DIR, f), "utf8")));
  }
  return posts;
}

// The live set, computed independently of blog-catalog.ts: the manifest plus
// every post file that still carries an `industry` key.
function liveFromFiles(): Set<string> {
  const posts = readPosts();
  const live = new Set(INCLUDED_BLOG_SLUGS.filter((s) => posts.has(s)));
  for (const [slug, post] of posts) if (post.industry) live.add(slug);
  return live;
}

describe("blog redirects", () => {
  const live = liveFromFiles();
  const entries = Object.entries(BLOG_REDIRECTS);

  it("has redirects", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it("sends every old slug to a live post", () => {
    for (const [from, to] of entries) {
      expect(live.has(to), `${from} -> ${to} is not a live post`).toBe(true);
    }
  });

  it("agrees with the catalog the site actually serves", () => {
    const served = new Set(listAllBlogRows().map((r) => r.slug));
    expect([...served].sort()).toEqual([...live].sort());
  });

  it("has no chains or loops", () => {
    const sources = new Set(Object.keys(BLOG_REDIRECTS));
    for (const [from, to] of entries) {
      expect(from).not.toBe(to);
      expect(sources.has(to), `${from} -> ${to} chains into another redirect`).toBe(false);
    }
  });

  it("keeps no retired slug in the live set", () => {
    for (const from of Object.keys(BLOG_REDIRECTS)) {
      expect(live.has(from), `${from} is retired but still live`).toBe(false);
      expect(listAllBlogRows().some((r) => r.slug === from)).toBe(false);
    }
  });

  it("marks retired post files as drafts without an auto-include key", () => {
    const posts = readPosts();
    for (const from of Object.keys(BLOG_REDIRECTS)) {
      const post = posts.get(from);
      if (!post) continue; // a file may be deleted later; the redirect still stands
      expect(post.status, `${from} should be a draft`).toBe("draft");
      expect(post.industry, `${from} must not carry an industry key`).toBeUndefined();
    }
  });

  it("resolves through resolveBlogRedirect", () => {
    const [from, to] = entries[0];
    expect(resolveBlogRedirect(from)).toBe(to);
    expect(resolveBlogRedirect("not-a-retired-slug")).toBeUndefined();
    expect(resolveBlogRedirect("constructor")).toBeUndefined();
  });
});
