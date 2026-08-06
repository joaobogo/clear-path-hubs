import { useEffect, useMemo, useState } from "react";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Sparkles } from "lucide-react";
import { SiteShell } from "@/components/marketing/site-shell";
import { Markdown, slugifyHeading } from "@/components/marketing/markdown";
import { INDUSTRY_ENTRIES } from "@/content/industries-v2";
import {
  estimateReadMinutes,
  getBlogPost,
} from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";
import {
  BLOG_CATEGORY_SLUGS,
  BLOG_METADATA,
} from "@/lib/marketing/blog-manifest";
import { isPublishedBlogSlug, listAllBlogRows } from "@/lib/marketing/blog-catalog";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    throw new Error("FORCED_QA_FAILURE blog");
    const entry = getBlogPost(params.slug);
    if (!entry) throw notFound();
    if (!isPublishedBlogSlug(params.slug)) throw notFound();
    return { entry };
  },
  head: ({ params, loaderData }) => {
    const entry = loaderData?.entry;
    if (!entry) {
      // The loader threw notFound(); never let a slug-derived soft-404 index.
      return {
        meta: [
          { title: "Article not found — TaaSFlow" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const patched = { ...entry, meta: { ...entry.meta, "og:type": "article" } };
    return marketingHead(
      patched,
      `/blog/${params.slug}`,
      {
        title: `${params.slug} — TaaSFlow Blog`,
        description: "TaaSFlow blog article.",
      },
      {
        breadcrumbs: [
          { name: "Blog", path: "/blog" },
          {
            name: entry.meta.title || params.slug,
            path: `/blog/${params.slug}`,
          },
        ],
      },
    );
  },
  component: BlogPost,
  notFoundComponent: () => (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-3xl font-semibold">Article not found</h1>
        <p className="mt-3 text-muted-foreground">
          It may have been moved, renamed, or unpublished.
        </p>
        <Link to="/blog" className="mt-6 inline-block text-primary hover:underline">
          ← Back to the blog
        </Link>
      </div>
    </SiteShell>
  ),
  errorComponent: makeRouteErrorComponent("public", "blog.$slug"),
});

function useReadingProgress() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const total = h.scrollHeight - h.clientHeight;
      setPct(total > 0 ? Math.min(100, Math.max(0, (h.scrollTop / total) * 100)) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return pct;
}

/** Extract level-2 markdown headings for the table of contents. */
function extractToc(md: string): Array<{ id: string; text: string }> {
  const out: Array<{ id: string; text: string }> = [];
  const lines = md.split(/\r?\n/);
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) {
      const text = m[1].replace(/[*_`]/g, "").trim();
      const id = slugifyHeading(text);
      if (id && !out.find((h) => h.id === id)) out.push({ id, text });
    }
  }
  return out;
}

function BlogPost() {
  const { entry } = Route.useLoaderData();
  const { slug } = Route.useParams();
  const meta = entry.meta as Record<string, string | undefined>;
  const title = meta.h1 || meta.title || "Untitled";
  const description = meta.description || "";
  const read = estimateReadMinutes(entry.markdown);
  const published = meta["article:published_time"];
  const updated = meta["article:modified_time"] || published;
  const author = meta.author || "TaaSFlow";
  const entryAny = entry as unknown as { category?: string; tags?: string[]; industry?: string };
  const category =
    BLOG_METADATA[slug]?.category ?? entryAny.category ?? "General";
  const tags = BLOG_METADATA[slug]?.tags ?? entryAny.tags ?? [];
  // Skip legacy taasflow.com asset URLs — those images aren't served here.
  const rawHero = meta["og:image"];
  const heroImage =
    rawHero && !rawHero.startsWith("https://taasflow.com") ? rawHero : undefined;
  const progress = useReadingProgress();
  const toc = useMemo(() => extractToc(entry.markdown), [entry.markdown]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (toc.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId((visible[0].target as HTMLElement).id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 1] },
    );
    for (const item of toc) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [toc]);

  const related = useMemo(() => {
    return listAllBlogRows()
      .filter((r) => r.slug !== slug && r.category === category)
      .slice(0, 3)
      .map((r) => ({ slug: r.slug, title: r.title, description: r.description }));
  }, [slug, category]);

  const relatedIndustries = useMemo(() => {
    const pool = new Set<string>();
    if (entryAny.industry) pool.add(entryAny.industry);
    const bag = [title, description, ...tags].join(" ").toLowerCase();
    for (const ind of INDUSTRY_ENTRIES) {
      if (pool.size >= 3) break;
      if (bag.includes(ind.name.toLowerCase()) || bag.includes(ind.slug)) {
        pool.add(ind.slug);
      }
    }
    return Array.from(pool)
      .map((s) => INDUSTRY_ENTRIES.find((e) => e.slug === s))
      .filter(Boolean)
      .slice(0, 3) as typeof INDUSTRY_ENTRIES;
  }, [entryAny.industry, title, description, tags]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    datePublished: published,
    dateModified: updated,
    author: { "@type": "Organization", name: author },
    publisher: { "@type": "Organization", name: "TaaSFlow" },
    articleSection: category,
    keywords: tags.join(", "),
  };

  return (
    <SiteShell>
      {/* Sticky reading progress bar */}
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 z-40 h-0.5 bg-primary/80 transition-[width]"
        style={{ width: `${progress}%` }}
      />

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <article className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              <Link to="/blog" className="hover:underline">
                ← All articles
              </Link>
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Link
                to="/blog/category/$slug"
                params={{ slug: BLOG_CATEGORY_SLUGS[category] || "general" }}
                className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary hover:bg-primary/15"
              >
                {category}
              </Link>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" /> {read} min read
              </span>
              {published && (
                <>
                  <span>·</span>
                  <time dateTime={published}>
                    {new Date(published).toLocaleDateString()}
                  </time>
                </>
              )}
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              {title}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">By {author}</p>

            {heroImage ? (
              <figure className="mt-8 overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
                <img
                  src={heroImage}
                  alt=""
                  loading="eager"
                  decoding="async"
                  className="aspect-[16/9] w-full object-cover"
                />
              </figure>
            ) : (
              <div
                aria-hidden
                className="mt-8 flex aspect-[16/5] w-full items-end overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/15 via-primary/5 to-background p-8"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">
                  {category} · TaaSFlow Insights
                </p>
              </div>
            )}

            {/* Editorial callout — what this article covers */}
            {description && (
              <aside className="not-prose mt-10 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent p-6">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 flex-none text-primary" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                      What you&rsquo;ll take from this
                    </p>
                    <p className="mt-2 text-base leading-relaxed text-foreground">
                      {description}
                    </p>
                  </div>
                </div>
              </aside>
            )}

            {/* Mobile-only inline TOC */}
            {toc.length > 2 && (
              <details className="mt-8 rounded-xl border border-border/60 bg-card p-4 lg:hidden">
                <summary className="cursor-pointer text-sm font-semibold">
                  In this article ({toc.length})
                </summary>
                <ol className="mt-3 space-y-1.5 text-sm">
                  {toc.map((h, i) => (
                    <li key={h.id} className="text-muted-foreground">
                      <a href={`#${h.id}`} className="hover:text-primary">
                        {i + 1}. {h.text}
                      </a>
                    </li>
                  ))}
                </ol>
              </details>
            )}

            <div className="mt-10">
              <Markdown>{entry.markdown}</Markdown>
            </div>

            {tags.length > 0 && (
              <div className="mt-10 flex flex-wrap gap-2 border-t border-border/60 pt-6">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}

            {/* Related industries — commercial adjacency, not a sales banner */}
            {relatedIndustries.length > 0 && (
              <aside className="mt-14 border-t border-border/60 pt-10">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Related industries
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  Hiring context for these sectors
                </h2>
                <ul className="mt-5 grid gap-3 sm:grid-cols-3">
                  {relatedIndustries.map((ind) => (
                    <li key={ind.slug}>
                      <Link
                        to="/industries/$slug"
                        params={{ slug: ind.slug }}
                        className="group flex h-full flex-col rounded-xl border border-border/60 bg-card p-5 transition hover:border-primary/40 hover:shadow-sm"
                      >
                        <span className="text-sm font-semibold group-hover:text-primary">
                          {ind.name}
                        </span>
                        <span className="mt-1 text-xs text-muted-foreground">
                          See the hiring playbook →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </aside>
            )}

            {related.length > 0 && (
              <aside className="mt-14 border-t border-border/60 pt-10">
                <h2 className="text-2xl font-semibold tracking-tight">
                  Continue reading
                </h2>
                <ul className="mt-6 grid gap-4 sm:grid-cols-3">
                  {related.map((r) => (
                    <li
                      key={r.slug}
                      className="rounded-xl border border-border/60 bg-card p-5 hover:border-primary/40"
                    >
                      <h3 className="text-sm font-semibold leading-snug">
                        <Link
                          to="/blog/$slug"
                          params={{ slug: r.slug }}
                          className="hover:text-primary"
                        >
                          {r.title}
                        </Link>
                      </h3>
                      <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                        {r.description}
                      </p>
                    </li>
                  ))}
                </ul>
              </aside>
            )}

            {/* One — and only one — commercial CTA at the end */}
            <div className="mt-16 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/[0.08] via-background to-background p-8 sm:p-10">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                    Ready to hire?
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                    Turn this playbook into a ranked shortlist.
                  </h2>
                  <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                    Share the role, we deliver evidence-backed candidates inside your workspace — flat
                    subscription, no placement fees.
                  </p>
                </div>
                <div className="flex flex-none flex-col gap-2 sm:flex-row">
                  <Link
                    to="/intake"
                    className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Start hiring
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                  <Link
                    to="/how-it-works"
                    className="inline-flex items-center justify-center rounded-md border border-border/60 bg-background px-5 py-2.5 text-sm font-semibold hover:bg-muted"
                  >
                    See how it works
                  </Link>
                </div>
              </div>
            </div>
          </article>

          {/* Desktop sticky TOC */}
          {toc.length > 2 && (
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  On this page
                </p>
                <ol className="mt-4 space-y-2 border-l border-border/60">
                  {toc.map((h) => {
                    const active = activeId === h.id;
                    return (
                      <li key={h.id}>
                        <a
                          href={`#${h.id}`}
                          className={`-ml-px block border-l-2 pl-4 text-sm transition ${
                            active
                              ? "border-primary font-medium text-foreground"
                              : "border-transparent text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {h.text}
                        </a>
                      </li>
                    );
                  })}
                </ol>
                <div className="mt-6 rounded-lg border border-border/60 bg-card p-4">
                  <p className="text-xs text-muted-foreground">Reading time</p>
                  <p className="mt-1 text-lg font-semibold">{read} min</p>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </SiteShell>
  );
}
