import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/marketing/site-shell";
import {
  blog,
  estimateReadMinutes,
  extractExcerpt,
  getPage,
  listBlogSlugs,
} from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

const entry = getPage("blog");

export const Route = createFileRoute("/blog/")({
  head: () =>
    marketingHead(entry, "/blog", {
      title: "TaaSFlow Blog — Talent strategy, hiring guides & market data",
      description:
        "Strategies, playbooks, and market data for modern talent teams. Updated weekly.",
    }),
  component: BlogIndex,
});

const PAGE_SIZE = 24;

function BlogIndex() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const all = useMemo(() => {
    const slugs = listBlogSlugs();
    return slugs.map((slug) => {
      const b = blog[slug];
      const title =
        b.meta.h1 ||
        b.meta.title?.split("|")[0].trim() ||
        slug.replace(/-/g, " ");
      return {
        slug,
        title,
        description:
          b.meta.description ||
          b.meta["og:description"] ||
          extractExcerpt(b.markdown),
        readMinutes: estimateReadMinutes(b.markdown),
      };
    });
  }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return all;
    const needle = q.toLowerCase();
    return all.filter(
      (p) =>
        p.title.toLowerCase().includes(needle) ||
        p.description.toLowerCase().includes(needle) ||
        p.slug.includes(needle),
    );
  }, [q, all]);

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages);
  const paged = filtered.slice(
    (current - 1) * PAGE_SIZE,
    current * PAGE_SIZE,
  );

  return (
    <SiteShell>
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Insights
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              TaaSFlow Blog
            </h1>
            <p className="mt-3 text-muted-foreground">
              Strategies, playbooks, and market data for modern talent teams.
              {" "}
              <span className="text-foreground">{all.length}</span> articles.
            </p>
          </div>
          <div className="w-full max-w-sm">
            <label htmlFor="blog-search" className="sr-only">
              Search articles
            </label>
            <input
              id="blog-search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search articles…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </header>

        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paged.map((p) => (
            <li key={p.slug}>
              <Link
                to="/blog/$slug"
                params={{ slug: p.slug }}
                className="group flex h-full flex-col rounded-xl border border-border/60 bg-card p-6 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/30"
              >
                <h2 className="text-lg font-semibold text-foreground group-hover:text-primary">
                  {p.title}
                </h2>
                <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">
                  {p.description}
                </p>
                <p className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">
                  {p.readMinutes} min read
                </p>
              </Link>
            </li>
          ))}
        </ul>

        {pages > 1 ? (
          <nav className="mt-10 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={current === 1}
              className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground">
              Page {current} of {pages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={current === pages}
              className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </nav>
        ) : null}

        {total === 0 ? (
          <p className="mt-16 text-center text-muted-foreground">
            No articles match your search.
          </p>
        ) : null}
      </section>
    </SiteShell>
  );
}
