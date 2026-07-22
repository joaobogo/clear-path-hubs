import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteShell } from "@/components/marketing/site-shell";
import { Markdown } from "@/components/marketing/markdown";
import {
  blog,
  estimateReadMinutes,
  extractExcerpt,
  getBlogPost,
} from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";
import {
  BLOG_CATEGORY_SLUGS,
  BLOG_METADATA,
  INCLUDED_BLOG_SLUGS,
} from "@/lib/marketing/blog-manifest";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const entry = getBlogPost(params.slug);
    if (!entry) throw notFound();
    if (!INCLUDED_BLOG_SLUGS.includes(params.slug)) throw notFound();
    return { entry };
  },
  head: ({ params, loaderData }) => {
    const entry = loaderData?.entry;
    const patched = entry
      ? { ...entry, meta: { ...entry.meta, "og:type": "article" } }
      : undefined;
    return marketingHead(patched, `/blog/${params.slug}`, {
      title: `${params.slug} — TaaSFlow Blog`,
      description: "TaaSFlow blog article.",
    });
  },
  component: BlogPost,
  notFoundComponent: () => (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-3xl font-semibold">Article not found</h1>
        <p className="mt-3 text-muted-foreground">
          It may have been moved, renamed, or unpublished.
        </p>
        <Link
          to="/blog"
          className="mt-6 inline-block text-primary hover:underline"
        >
          ← Back to the blog
        </Link>
      </div>
    </SiteShell>
  ),
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

function BlogPost() {
  const { entry } = Route.useLoaderData();
  const { slug } = Route.useParams();
  const meta = entry.meta as Record<string, string | undefined>;
  const title = meta.h1 || meta.title || "Untitled";
  const read = estimateReadMinutes(entry.markdown);
  const published = meta["article:published_time"];
  const updated = meta["article:modified_time"] || published;
  const author = meta.author || "TaaSFlow";
  const category = BLOG_METADATA[slug]?.category ?? "General";
  const tags = BLOG_METADATA[slug]?.tags ?? [];
  const progress = useReadingProgress();

  const related = useMemo(() => {
    return INCLUDED_BLOG_SLUGS.filter(
      (s) => s !== slug && BLOG_METADATA[s]?.category === category,
    )
      .slice(0, 3)
      .map((s) => {
        const b = blog[s];
        const m = b.meta as Record<string, string | undefined>;
        return {
          slug: s,
          title: m.h1 || m.title || s,
          description:
            m.description || m["og:description"] || extractExcerpt(b.markdown),
        };
      });
  }, [slug, category]);

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
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 z-40 h-0.5 bg-primary/80 transition-[width]"
        style={{ width: `${progress}%` }}
      />
      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
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
          <span>{read} min read</span>
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

        {related.length > 0 && (
          <aside className="mt-16 border-t border-border/60 pt-10">
            <h2 className="text-2xl font-semibold tracking-tight">
              Related reading
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

        <div className="mt-16 rounded-xl border border-border/60 bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Need this exact talent on your team?
          </p>
          <Link
            to="/intake"
            className="mt-3 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Start hiring with TaaSFlow
          </Link>
        </div>
      </article>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </SiteShell>
  );
}
