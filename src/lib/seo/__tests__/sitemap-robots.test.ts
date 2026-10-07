import { describe, expect, it } from "vitest";
import {
  INDEXABLE_INDUSTRY_SLUGS,
  NOINDEX_STATIC_PATHS,
  SITEMAP_CHILDREN,
  buildChildSitemapXml,
  buildSitemapXml,
  collectSitemapEntries,
  collectSitemapEntriesByGroup,
} from "@/lib/seo/index-config";
import { buildRobotsTxt } from "@/lib/seo/robots-config";
import { toPublicSlug } from "@/lib/marketing/industry-slug-aliases";
import { listIndustrySlugs } from "@/lib/marketing/content";

describe("sitemap", () => {
  const paths = collectSitemapEntries().map((e) => e.path);

  it("contains no path that a route marks noindex", () => {
    for (const p of NOINDEX_STATIC_PATHS) expect(paths).not.toContain(p);
  });

  it("drops the thin and utility URLs named in the audit", () => {
    for (const p of [
      "/pitch",
      "/intake",
      "/book",
      "/status",
      "/changelog",
      "/candidate-success",
      "/knowledge-base",
      "/talent-marketplace",
      "/global-talent",
      "/sitemap",
    ]) {
      expect(paths).not.toContain(p);
    }
  });

  it("lists only the indexable industries and their briefings", () => {
    const industryPaths = paths.filter((p) => p.startsWith("/industries/"));
    const slugs = new Set(industryPaths.map((p) => p.split("/")[2]));
    expect([...slugs].sort()).toEqual([...INDEXABLE_INDUSTRY_SLUGS].sort());
    for (const slug of INDEXABLE_INDUSTRY_SLUGS) {
      expect(industryPaths).toContain(`/industries/${slug}`);
      expect(industryPaths).toContain(`/industries/${slug}/briefing`);
    }
    // The indexable list must name real industries.
    const known = new Set(listIndustrySlugs().map(toPublicSlug));
    for (const slug of INDEXABLE_INDUSTRY_SLUGS) expect(known.has(slug)).toBe(true);
  });

  it("has no duplicate URLs and never lists a paginated archive URL", () => {
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.some((p) => p.includes("?"))).toBe(false);
  });

  it("emits the index with one child per group and no changefreq or priority", () => {
    const index = buildSitemapXml();
    expect(index).toContain("<sitemapindex");
    for (const c of SITEMAP_CHILDREN) expect(index).toContain(`https://taasflow.com${c.path}`);
    for (const c of SITEMAP_CHILDREN) {
      const xml = buildChildSitemapXml(c.group);
      expect(xml).toContain("<urlset");
      expect(xml).not.toContain("<changefreq>");
      expect(xml).not.toContain("<priority>");
    }
  });

  it("emits lastmod only when a real ISO date exists", () => {
    const all = SITEMAP_CHILDREN.flatMap((c) => collectSitemapEntriesByGroup(c.group));
    for (const e of all) {
      if (e.lastmod !== undefined) expect(Number.isNaN(Date.parse(e.lastmod))).toBe(false);
    }
    // Blog posts carry published dates, so they get a lastmod.
    const posts = collectSitemapEntriesByGroup("blog").filter(
      (e) => e.path.startsWith("/blog/") && !e.path.startsWith("/blog/category/"),
    );
    expect(posts.some((e) => e.lastmod)).toBe(true);
    // The home page has no content date, so it must not invent one.
    const home = collectSitemapEntriesByGroup("pages").find((e) => e.path === "/");
    expect(home?.lastmod).toBeUndefined();
  });
});

describe("robots.txt", () => {
  const txt = buildRobotsTxt();

  it("has exactly one User-agent group", () => {
    const groups = txt.split("\n").filter((l) => /^user-agent:/i.test(l));
    expect(groups).toEqual(["User-agent: *"]);
  });

  it("has one Sitemap line and notes that AI crawlers are intentionally allowed", () => {
    expect(txt.split("\n").filter((l) => l.startsWith("Sitemap:"))).toEqual([
      "Sitemap: https://taasflow.com/sitemap.xml",
    ]);
    expect(txt).toMatch(/GPTBot.*ClaudeBot.*PerplexityBot.*Google-Extended/s);
    expect(txt).toMatch(/intentionally/i);
  });

  it("does not block the public booking page", () => {
    const disallows = txt.split("\n").filter((l) => l.startsWith("Disallow:"));
    expect(disallows).not.toContain("Disallow: /book");
    expect(disallows).not.toContain("Disallow: /book/");
  });
});
