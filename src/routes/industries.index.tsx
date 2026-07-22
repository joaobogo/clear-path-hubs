import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/marketing/site-shell";
import { Markdown } from "@/components/marketing/markdown";
import { getIndustry, industries, listIndustrySlugs } from "@/lib/marketing/content";
import { INDUSTRY_ENTRIES } from "@/content/industries-v2";
import { marketingHead } from "@/lib/marketing/head";


const entry = getIndustry("industries");

export const Route = createFileRoute("/industries/")({
  head: () =>
    marketingHead(entry, "/industries", {
      title: "Industries we serve — TaaSFlow",
      description:
        "Subscription recruiting for tech, finance, healthcare, legal, consulting, SaaS, and more.",
    }),
  component: IndustriesIndex,
});

function IndustriesIndex() {
  const legacySlugs = listIndustrySlugs();
  const v2Map = new Map(INDUSTRY_ENTRIES.map((e) => [e.slug, e]));
  const merged = Array.from(new Set([...v2Map.keys(), ...legacySlugs])).sort();
  return (
    <SiteShell>
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="mb-12 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Industries
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            {entry?.meta.h1 || "Industries we serve"}
          </h1>
          {entry?.meta.description ? (
            <p className="mt-4 text-lg text-muted-foreground">
              {entry.meta.description}
            </p>
          ) : null}
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {merged.map((slug) => {
            const v2 = v2Map.get(slug);
            const i = industries[slug];
            const title =
              v2?.name || i?.meta.h1 || i?.meta.title?.split("|")[0].trim() || slug;
            const description = v2?.meta.description || i?.meta.description;
            return (
              <Link
                key={slug}
                to="/industries/$slug"
                params={{ slug }}
                className="group rounded-xl border border-border/60 bg-card p-6 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <h2 className="text-lg font-semibold text-foreground group-hover:text-primary">
                  {title}
                </h2>
                {description ? (
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                    {description}
                  </p>
                ) : null}
              </Link>
            );
          })}
        </div>


        {entry ? (
          <div className="mt-16 border-t border-border/60 pt-10">
            <Markdown>{entry.markdown}</Markdown>
          </div>
        ) : null}
      </section>
    </SiteShell>
  );
}
