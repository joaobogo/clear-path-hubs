/**
 * Sector briefing — the print-ready document offered by the industry lead
 * catcher (Part 7, prompt 47).
 *
 * Everything on this page is drawn from the vertical's own content entry:
 * the role families we cover, the evidence we score against, the
 * certifications that matter, and what a shortlist looks like. No gated
 * video, no invented statistics. "Save as PDF" is the browser's print
 * dialog, so the document is always current.
 */
import { CANONICAL_ORIGIN } from "@/lib/canonical-origin";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Printer } from "lucide-react";

import { getIndustryEntry, type IndustryEntry } from "@/content/industries-v2";

import { toInternalSlug } from "@/lib/marketing/industry-slug-aliases";
import { breadcrumbScript, clampDescription } from "@/lib/marketing/head";
import { Button } from "@/components/ui/button";


export const Route = createFileRoute("/industries_/$slug/briefing")({
  loader: ({ params }) => {
    const entry = getIndustryEntry(toInternalSlug(params.slug));
    if (!entry) throw notFound();
    return { entry };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData?.entry) {
      // Loader threw notFound(): keep the soft-404 out of the index.
      return {
        meta: [
          { title: "Briefing not found — TaaSFlow" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const name = loaderData.entry.name;
    const title = `${name} hiring briefing — TaaSFlow`;
    const description = clampDescription(
      `How we run ${name.toLowerCase()} searches: role families, the evidence we score against, the certifications that matter, and what your shortlist contains.`,
    );
    const url = `${CANONICAL_ORIGIN}/industries/${params.slug}/briefing`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        breadcrumbScript([
          { name: "Industries", path: "/industries" },
          { name, path: `/industries/${params.slug}` },
          { name: "Hiring briefing", path: `/industries/${params.slug}/briefing` },
        ]),
      ],
    };
  },
  component: BriefingPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Briefing not found</h1>
      <Link to="/industries" className="mt-4 inline-block text-primary hover:underline">
        Browse all sectors
      </Link>
    </div>
  ),
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 break-inside-avoid">
      <h2 className="font-[family-name:var(--brand-font-display)] text-xl font-semibold text-[color:var(--brand-navy)]">
        {title}
      </h2>
      <div className="mt-3 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">{children}</div>
    </section>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((i) => (
        <li
          key={i}
          className="rounded-full border border-[color:var(--brand-navy)]/15 px-3 py-1 text-xs text-[color:var(--brand-navy)]/80"
        >
          {i}
        </li>
      ))}
    </ul>
  );
}

function BriefingPage() {
  const { entry } = Route.useLoaderData() as { entry: IndustryEntry };
  const { slug } = Route.useParams();

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-12 print:py-0">
        <header className="flex items-start justify-between gap-6 border-b border-[color:var(--brand-navy)]/15 pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-navy)]/55">
              TaaSFlow · sector briefing
            </p>
            <h1 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold text-[color:var(--brand-navy)]">
              Hiring in {entry.name}
            </h1>
            {entry.summary && (
              <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-[color:var(--brand-navy)]/75">
                {entry.summary}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" className="print:hidden" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Save as PDF
          </Button>
        </header>

        {entry.roleFamilies && entry.roleFamilies.length > 0 ? (
          <Section title="Role families we cover">
            <ul className="space-y-3">
              {entry.roleFamilies.map((f) => (
                <li key={f.name} className="break-inside-avoid">
                  <p className="font-medium text-[color:var(--brand-navy)]">{f.name}</p>
                  {f.blurb && <p className="mt-0.5">{f.blurb}</p>}
                  {f.roles && f.roles.length > 0 && (
                    <p className="mt-1 text-xs text-[color:var(--brand-navy)]/60">{f.roles.join(" · ")}</p>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        ) : entry.roles.length > 0 ? (
          <Section title="Roles we cover">
            <Chips items={entry.roles} />
          </Section>
        ) : null}

        <Section title="What makes this sector hard">
          <ul className="space-y-3">
            {entry.challenges.map((c) => (
              <li key={c.title} className="break-inside-avoid">
                <p className="font-medium text-[color:var(--brand-navy)]">{c.title}</p>
                <p className="mt-0.5">{c.body}</p>
              </li>
            ))}
          </ul>
        </Section>

        {entry.signals.length > 0 && (
          <Section title="The evidence we score against">
            <p className="mb-3">
              Every candidate is scored against the role's rubric, and every score
              points back to a specific line in the CV. For {entry.name.toLowerCase()},
              these are the signals that carry weight:
            </p>
            <Chips items={entry.signals} />
          </Section>
        )}

        {entry.certifications && entry.certifications.length > 0 && (
          <Section title="Certifications and credentials that matter here">
            <Chips items={entry.certifications} />
          </Section>
        )}

        {entry.regulatedRequirements && entry.regulatedRequirements.length > 0 && (
          <Section title="Regulatory and compliance requirements">
            <ul className="list-disc space-y-1 pl-5">
              {entry.regulatedRequirements.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="What your shortlist looks like">
          <ol className="list-decimal space-y-2 pl-5">
            <li>A ranked set of candidates, each with a score and the evidence behind it.</li>
            <li>Eligibility checks resolved before the candidate reaches you — right to work, credentials, location model.</li>
            <li>Salary expectation against your band, stated plainly, before you invest interview time.</li>
            <li>One decision per candidate: advance, hold or decline, reversible for a short window.</li>
          </ol>
          <p className="mt-3">
            Candidates stay invisible to you until we've reviewed them for your
            specific role, and contact details are released as a separate step.
          </p>
        </Section>

        <footer className="mt-12 border-t border-[color:var(--brand-navy)]/15 pt-6 text-xs text-[color:var(--brand-navy)]/60">
          <p>
            TaaSFlow — one subscription covering applicant tracking, recruiting and
            outreach. Prepared for {entry.name} hiring teams.
          </p>
          <p className="mt-1 print:hidden">
            <Link to="/industries/$slug" params={{ slug }} className="text-primary hover:underline">
              Back to the {entry.name} page
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
