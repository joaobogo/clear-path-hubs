import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, BookOpen, CalendarClock, CheckCircle2, Compass, Users } from "lucide-react";
import { SiteShell } from "@/components/marketing/site-shell";
import { UnfilledPositionCalculator } from "@/components/marketing/unfilled-position-calculator";
import { CANONICAL_ORIGIN } from "@/lib/canonical-origin";
import { breadcrumbScript, clampDescription } from "@/lib/marketing/head";
import {
  getResourceGuide,
  guideReadMinutes,
  RESOURCE_GUIDES,
  type GuideBlock,
  type ResourceGuide,
} from "@/content/resources";

export const Route = createFileRoute("/resources/$slug")({
  loader: ({ params }): { guide: ResourceGuide } => {
    const guide = getResourceGuide(params.slug);
    if (!guide) throw notFound();
    return { guide };
  },
  head: ({ params, loaderData }) => {
    const guide = loaderData?.guide;
    if (!guide) {
      return {
        meta: [
          { title: "Guide not found — TaaSFlow" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const url = `${CANONICAL_ORIGIN}/resources/${guide.slug}`;
    const description = clampDescription(guide.metaDescription);
    return {
      meta: [
        { title: guide.metaTitle },
        { name: "description", content: description },
        { property: "og:title", content: guide.metaTitle },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: guide.metaTitle },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        breadcrumbScript([
          { name: "Resources", path: "/resources" },
          { name: guide.title, path: `/resources/${guide.slug}` },
        ]),
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: guide.h1,
            description: guide.metaDescription,
            dateModified: guide.updated,
            mainEntityOfPage: url,
            author: { "@type": "Organization", name: "TaaSFlow" },
            publisher: { "@type": "Organization", name: "TaaSFlow" },
            articleSection: guide.category,
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: guide.faqs.map((faq) => ({
              "@type": "Question",
              name: faq.q,
              acceptedAnswer: { "@type": "Answer", text: faq.a },
            })),
          }),
        },
      ],
    };
  },
  component: ResourceGuidePage,
  notFoundComponent: () => (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-3xl font-semibold">Guide not found</h1>
        <p className="mt-3 text-muted-foreground">
          It may have been moved or renamed.
        </p>
        <Link to="/resources" className="mt-6 inline-block text-primary hover:underline">
          ← Back to resources
        </Link>
      </div>
    </SiteShell>
  ),
});

function sectionId(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function Block({ block }: { block: GuideBlock }) {
  switch (block.kind) {
    case "p":
      return <p className="text-base leading-relaxed text-muted-foreground">{block.text}</p>;
    case "bullets":
      return (
        <ul className="space-y-2.5">
          {block.items.map((item) => (
            <li key={item} className="flex gap-3 text-base leading-relaxed text-muted-foreground">
              <CheckCircle2
                className="mt-1 h-4 w-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className="space-y-4">
          {block.items.map((item, i) => (
            <li key={item.label} className="flex gap-4">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {i + 1}
              </span>
              <div>
                <p className="font-medium text-foreground">{item.label}</p>
                <p className="mt-0.5 text-base leading-relaxed text-muted-foreground">
                  {item.text}
                </p>
              </div>
            </li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                {block.columns.map((col) => (
                  <th
                    key={col}
                    scope="col"
                    className="px-4 py-3 font-semibold text-foreground"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.join("|")} className="border-t border-border">
                  {row.map((cell, i) => (
                    <td
                      key={`${row.join("|")}-${i}`}
                      className={
                        i === 0
                          ? "px-4 py-3 font-medium text-foreground"
                          : "px-4 py-3 text-muted-foreground"
                      }
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "callout":
      return (
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-5">
          <p className="font-medium text-foreground">{block.title}</p>
          <p className="mt-1.5 text-base leading-relaxed text-muted-foreground">
            {block.text}
          </p>
        </div>
      );
    case "calculator":
      return <UnfilledPositionCalculator />;
    default:
      return null;
  }
}

function RelatedCard({ guide }: { guide: ResourceGuide }) {
  return (
    <Link
      to="/resources/$slug"
      params={{ slug: guide.slug }}
      className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
    >
      <span className="text-xs font-medium uppercase tracking-wide text-primary">
        {guide.category}
      </span>
      <span className="mt-2 font-semibold text-foreground group-hover:text-primary">
        {guide.title}
      </span>
      <span className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {guide.summary}
      </span>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        Read the guide
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </Link>
  );
}

function ResourceGuidePage() {
  const { guide } = Route.useLoaderData() as { guide: ResourceGuide };
  const read = guideReadMinutes(guide);
  const related = guide.related
    .map((slug) => RESOURCE_GUIDES.find((g) => g.slug === slug))
    .filter((g): g is ResourceGuide => Boolean(g));
  const updated = new Date(guide.updated).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:pt-14">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link to="/resources" className="hover:text-foreground">
                Resources
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-foreground">{guide.title}</li>
          </ol>
        </nav>

        <header className="mt-6">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
              {guide.category}
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              Updated {updated}
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              {read} min read
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {guide.h1}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            {guide.summary}
          </p>
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            Written for: {guide.audience}
          </p>
        </header>

        <nav
          aria-label="On this page"
          className="mt-8 rounded-xl border border-border bg-muted/30 p-5"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            On this page
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {guide.sections.map((section) => (
              <li key={section.heading}>
                <a
                  href={`#${sectionId(section.heading)}`}
                  className="text-muted-foreground hover:text-primary"
                >
                  {section.heading}
                </a>
              </li>
            ))}
            <li>
              <a href="#faq" className="text-muted-foreground hover:text-primary">
                Frequently asked questions
              </a>
            </li>
          </ul>
        </nav>

        <div className="mt-12 space-y-14">
          {guide.sections.map((section) => (
            <section key={section.heading} id={sectionId(section.heading)}>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                {section.heading}
              </h2>
              <div className="mt-5 space-y-5">
                {section.blocks.map((block, i) => (
                  <Block key={`${section.heading}-${i}`} block={block} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <section id="faq" className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Frequently asked questions
          </h2>
          <dl className="mt-6 space-y-6">
            {guide.faqs.map((faq) => (
              <div key={faq.q} className="rounded-xl border border-border bg-card p-5">
                <dt className="font-medium text-foreground">{faq.q}</dt>
                <dd className="mt-2 text-base leading-relaxed text-muted-foreground">
                  {faq.a}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-16 rounded-2xl border border-border bg-muted/30 p-6 sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {guide.product.heading}
          </h2>
          <ul className="mt-5 space-y-2.5">
            {guide.product.points.map((point) => (
              <li key={point} className="flex gap-3 text-base leading-relaxed text-muted-foreground">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/book"
              search={{ cta: "resources" }}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Book a call
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40"
            >
              See pricing
            </Link>
          </div>
        </section>

        {related.length > 0 ? (
          <section className="mt-16">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Related guides
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {related.map((r) => (
                <RelatedCard key={r.slug} guide={r} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-14 rounded-2xl border border-border p-6">
          <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Compass className="h-3.5 w-3.5" aria-hidden="true" />
            Where to go next
          </p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-3">
            {guide.onward.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="group block rounded-xl border border-border p-4 transition-colors hover:border-primary/40"
                >
                  <span className="font-medium text-foreground group-hover:text-primary">
                    {link.label}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {link.desc}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </SiteShell>
  );
}
