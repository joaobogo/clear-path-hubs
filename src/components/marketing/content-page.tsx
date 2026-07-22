import { SiteShell } from "@/components/marketing/site-shell";
import { Markdown } from "@/components/marketing/markdown";
import type { ContentEntry } from "@/lib/marketing/content";

export function ContentPage({
  entry,
  eyebrow,
  fallbackTitle,
}: {
  entry: ContentEntry | undefined;
  eyebrow?: string;
  fallbackTitle?: string;
}) {
  const title = entry?.meta.h1 || entry?.meta.title || fallbackTitle || "TaaSFlow";
  return (
    <SiteShell>
      <article className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="mb-10 border-b border-border/60 pb-8">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {title}
          </h1>
          {entry?.meta.description ? (
            <p className="mt-4 text-lg text-muted-foreground">
              {entry.meta.description}
            </p>
          ) : null}
        </header>
        {entry ? (
          <Markdown>{entry.markdown}</Markdown>
        ) : (
          <p className="text-muted-foreground">Content coming soon.</p>
        )}
      </article>
    </SiteShell>
  );
}
