import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteShell } from "@/components/marketing/site-shell";
import { Markdown } from "@/components/marketing/markdown";
import { estimateReadMinutes, getBlogPost } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const entry = getBlogPost(params.slug);
    if (!entry) throw notFound();
    return { entry };
  },
  head: ({ params, loaderData }) => {
    const entry = loaderData?.entry;
    // Force og:type=article for blog posts regardless of scraped metadata.
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
          It may have been moved or renamed.
        </p>
        <Link to="/blog" className="mt-6 inline-block text-primary hover:underline">
          ← Back to the blog
        </Link>
      </div>
    </SiteShell>
  ),
});

function BlogPost() {
  const { entry } = Route.useLoaderData();
  const title = entry.meta.h1 || entry.meta.title || "Untitled";
  const read = estimateReadMinutes(entry.markdown);
  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          <Link to="/blog" className="hover:underline">
            ← All articles
          </Link>
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">{read} min read</p>
        <div className="mt-10">
          <Markdown>{entry.markdown}</Markdown>
        </div>
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
    </SiteShell>
  );
}
