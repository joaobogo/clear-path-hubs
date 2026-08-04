import { useMemo } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteShell } from "@/components/marketing/site-shell";
import { blog, estimateReadMinutes, extractExcerpt } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";
import {
  BLOG_CATEGORY_BY_SLUG,
  BLOG_METADATA,
  INCLUDED_BLOG_SLUGS,
} from "@/lib/marketing/blog-manifest";

export const Route = createFileRoute("/blog/category/$slug")({
  loader: ({ params }) => {
    const category = BLOG_CATEGORY_BY_SLUG[params.slug];
    if (!category) throw notFound();
    return { category };
  },
  head: ({ params, loaderData }) =>
    marketingHead(
      undefined,
      `/blog/category/${params.slug}`,
      {
        title: `${loaderData?.category ?? "Category"} — TaaSFlow Blog`,
        description: `Articles in ${loaderData?.category ?? ""} from the TaaSFlow blog — hiring intelligence guides, benchmarks and market data.`,
      },
      {
        breadcrumbs: [
          { name: "Blog", path: "/blog" },
          {
            name: loaderData?.category ?? "Category",
            path: `/blog/category/${params.slug}`,
          },
        ],
      },
    ),
  component: CategoryPage,
  notFoundComponent: () => (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-3xl font-semibold">Category not found</h1>
        <Link to="/blog" className="mt-6 inline-block text-primary hover:underline">
          ← Back to the blog
        </Link>
      </div>
    </SiteShell>
  ),
});

function CategoryPage() {
  const { category } = Route.useLoaderData();
  const items = useMemo(() => {
    return INCLUDED_BLOG_SLUGS.filter(
      (s) => BLOG_METADATA[s]?.category === category,
    )
      .map((slug) => {
        const b = blog[slug];
        const meta = b.meta as Record<string, string | undefined>;
        return {
          slug,
          title: meta.h1 || meta.title || slug,
          description:
            meta.description ||
            meta["og:description"] ||
            extractExcerpt(b.markdown),
          publishedAt: meta["article:published_time"],
          readMinutes: estimateReadMinutes(b.markdown),
        };
      })
      .sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));
  }, [category]);

  return (
    <SiteShell>
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          <Link to="/blog" className="hover:underline">
            ← All articles
          </Link>
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          {category}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {items.length} article{items.length === 1 ? "" : "s"} in this category.
        </p>

        {items.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-border/60 bg-muted/20 p-10 text-center">
            <p className="text-lg font-semibold">Nothing here yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Articles in this category will appear here as they're published.
            </p>
          </div>
        ) : (
          <ul className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <li
                key={p.slug}
                className="flex flex-col rounded-xl border border-border/60 bg-card p-6 hover:border-primary/40"
              >
                <h2 className="text-lg font-semibold leading-snug tracking-tight">
                  <Link
                    to="/blog/$slug"
                    params={{ slug: p.slug }}
                    className="hover:text-primary"
                  >
                    {p.title}
                  </Link>
                </h2>
                <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">
                  {p.description}
                </p>
                <p className="mt-4 text-xs text-muted-foreground">
                  {p.readMinutes} min read
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </SiteShell>
  );
}
