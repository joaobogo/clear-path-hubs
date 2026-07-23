import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { SiteShell } from "@/components/marketing/site-shell";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";
import {
  BLOG_CATEGORIES,
  BLOG_CATEGORY_SLUGS,
} from "@/lib/marketing/blog-manifest";
import { listAllBlogRows } from "@/lib/marketing/blog-catalog";

const entry = getPage("blog");

export const Route = createFileRoute("/blog/")({
  head: () =>
    marketingHead(entry, "/blog", {
      title: "TaaSFlow Blog — Talent strategy, hiring guides & market data",
      description:
        "Strategies, playbooks, and market data for modern talent teams. Updated regularly.",
    }),
  component: BlogIndex,
});

const PAGE_SIZE = 24;

function BlogIndex() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("");
  const [page, setPage] = useState(1);

  const all = useMemo(() => listAllBlogRows(), []);

  const dynamicCategories = useMemo(() => {
    const known = new Set(BLOG_CATEGORIES);
    const extras = new Set<string>();
    for (const r of all) if (!known.has(r.category)) extras.add(r.category);
    return [...BLOG_CATEGORIES, ...Array.from(extras).sort()];
  }, [all]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((p) => {
      if (cat && p.category !== cat) return false;
      if (!needle) return true;
      return (
        p.title.toLowerCase().includes(needle) ||
        p.description.toLowerCase().includes(needle) ||
        p.category.toLowerCase().includes(needle) ||
        p.tags.some((t) => t.toLowerCase().includes(needle)) ||
        p.slug.includes(needle)
      );
    });
  }, [q, cat, all]);

  const categoriesToShow = dynamicCategories;

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages);
  const paged = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

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
              Strategies, playbooks, and market data for modern talent teams.{" "}
              <span className="text-foreground">{all.length}</span> articles across{" "}
              <span className="text-foreground">{BLOG_CATEGORIES.length}</span> categories.
            </p>
          </div>
          <div className="w-full max-w-sm">
            <label htmlFor="blog-search" className="sr-only">
              Search articles
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="blog-search"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Search articles, tags, categories…"
                className="w-full rounded-md border border-border/60 bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                type="search"
              />
            </div>
          </div>
        </header>

        <nav aria-label="Categories" className="mb-8 flex flex-wrap gap-2">
          <button
            onClick={() => {
              setCat("");
              setPage(1);
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              cat === ""
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/60 bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({all.length})
          </button>
          {BLOG_CATEGORIES.map((c) => {
            const n = all.filter((r) => r.category === c).length;
            if (!n) return null;
            const active = cat === c;
            return (
              <button
                key={c}
                onClick={() => {
                  setCat(active ? "" : c);
                  setPage(1);
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/60 bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {c} ({n})
              </button>
            );
          })}
        </nav>

        {paged.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-10 text-center">
            <p className="text-lg font-semibold">No matching articles</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Try a different search term or clear the category filter.
            </p>
            <button
              onClick={() => {
                setQ("");
                setCat("");
                setPage(1);
              }}
              className="mt-4 rounded-md border border-border/60 bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {paged.map((p) => (
              <li
                key={p.slug}
                className="flex flex-col rounded-xl border border-border/60 bg-card p-6 transition hover:border-primary/40 hover:shadow-sm"
              >
                <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Link
                    to="/blog/category/$slug"
                    params={{ slug: BLOG_CATEGORY_SLUGS[p.category] || "general" }}
                    className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary hover:bg-primary/15"
                  >
                    {p.category}
                  </Link>
                  <span>·</span>
                  <span>{p.readMinutes} min read</span>
                </div>
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
                {p.publishedAt && (
                  <p className="mt-4 text-xs text-muted-foreground">
                    Published {new Date(p.publishedAt).toLocaleDateString()}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {pages > 1 && (
          <nav
            aria-label="Pagination"
            className="mt-10 flex items-center justify-center gap-2"
          >
            <button
              disabled={current === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-border/60 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              ← Previous
            </button>
            <span className="text-sm text-muted-foreground">
              Page {current} of {pages}
            </span>
            <button
              disabled={current === pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="rounded-md border border-border/60 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Next →
            </button>
          </nav>
        )}
      </section>
    </SiteShell>
  );
}
