import { createFileRoute, Link } from "@tanstack/react-router";
import { marketingHead } from "@/lib/marketing/head";
import { PublicPage, PublicSection, SiteShell } from "@/components/marketing/site-shell";
import { CTA_MESSAGE, CTA_PRIMARY } from "@/config/cta";
import { SHORTLIST_SIZE, WHO_RUNS_THE_SEARCH } from "@/config/offer-facts";
import {
  SAMPLE_SHORTLIST,
  SAMPLE_SHORTLIST_LABEL,
  SAMPLE_SHORTLIST_NOTICE,
  SAMPLE_SHORTLIST_REQUIREMENTS,
  SAMPLE_SHORTLIST_ROLE,
} from "@/lib/previews/representative-fixtures";

export const Route = createFileRoute("/sample-shortlist")({
  head: () =>
    marketingHead(
      undefined,
      "/sample-shortlist",
      {
        title: "Sample Top 10 Shortlist (Example Data) | TaaSFlow",
        description: `An example ranked shortlist of ${SHORTLIST_SIZE} fictional candidates for a ${SAMPLE_SHORTLIST_ROLE} role, with a score and evidence line per requirement. Example data only.`,
      },
      {
        robots: "noindex,follow",
        breadcrumbs: [
          { name: "Home", path: "/" },
          { name: "Sample shortlist", path: "/sample-shortlist" },
        ],
      },
    ),
  component: SampleShortlistPage,
});

const linkClass =
  "font-semibold text-[color:var(--brand-ocean-text)] underline underline-offset-4 hover:no-underline";

function SampleShortlistPage() {
  return (
    <SiteShell>
      <PublicSection className="pb-6 pt-14 sm:pt-16">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
            {SAMPLE_SHORTLIST_LABEL}
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            A sample top {SHORTLIST_SIZE} for a {SAMPLE_SHORTLIST_ROLE}.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-[color:var(--brand-navy)]/80">
            This is the format of a shortlist: candidates ranked by one score, with a score and a
            line of evidence for each requirement. Open a requirement score to read its evidence.
          </p>
          <p
            role="note"
            className="mt-4 max-w-2xl rounded-lg border border-[color:var(--brand-navy)]/15 bg-white p-4 text-sm text-[color:var(--brand-navy)]/85"
          >
            {SAMPLE_SHORTLIST_NOTICE} {WHO_RUNS_THE_SEARCH}
          </p>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-6">
        <PublicPage>
          <table
            className="w-full border-collapse text-left text-sm max-md:block"
            data-testid="sample-shortlist-table"
          >
            <caption className="mb-3 text-left text-sm font-semibold">
              {SAMPLE_SHORTLIST_LABEL}: {SAMPLE_SHORTLIST_ROLE}, ranked by overall score
            </caption>
            <thead className="max-md:sr-only">
              <tr className="border-b border-[color:var(--brand-navy)]/15 bg-[color:var(--brand-navy)]/[0.03]">
                <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wider">
                  Rank
                </th>
                <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wider">
                  Candidate
                </th>
                <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase tracking-wider">
                  Overall score
                </th>
                {SAMPLE_SHORTLIST_REQUIREMENTS.map((q) => (
                  <th
                    key={q.key}
                    scope="col"
                    className="px-3 py-3 text-xs font-semibold uppercase tracking-wider"
                  >
                    {q.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="max-md:block">
              {SAMPLE_SHORTLIST.map((c) => (
                <tr
                  key={c.ref}
                  className="border-b border-[color:var(--brand-navy)]/10 align-top max-md:mb-4 max-md:block max-md:rounded-xl max-md:border max-md:bg-white max-md:p-3"
                >
                  <td className="px-3 py-3 font-semibold tabular-nums max-md:block max-md:px-0 max-md:py-1">
                    <span className="md:hidden">Rank </span>
                    {c.rank}
                  </td>
                  <th
                    scope="row"
                    className="px-3 py-3 font-semibold max-md:block max-md:px-0 max-md:py-1"
                  >
                    {c.ref}
                  </th>
                  <td className="px-3 py-3 font-semibold tabular-nums max-md:block max-md:px-0 max-md:py-1">
                    <span className="md:hidden">Overall score: </span>
                    {c.score}
                  </td>
                  {SAMPLE_SHORTLIST_REQUIREMENTS.map((q) => (
                    <td key={q.key} className="px-3 py-3 max-md:block max-md:px-0 max-md:py-1">
                      <details className="group">
                        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded [&::-webkit-details-marker]:hidden md:min-h-0">
                          <span className="md:hidden">{q.label}: </span>
                          <span className="font-semibold tabular-nums">{c.results[q.key].score}</span>
                          <span className="text-xs text-[color:var(--brand-navy)]/70 underline">
                            evidence
                          </span>
                        </summary>
                        <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-[color:var(--brand-navy)]/80">
                          {c.results[q.key].evidence}
                        </p>
                      </details>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 max-w-2xl text-xs text-[color:var(--brand-navy)]/75">
            Scores are out of 100. The overall score is the rounded average of the five requirement
            scores. In a real shortlist, each evidence line points to the CV or application text it
            comes from.
          </p>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-8">
        <PublicPage>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={CTA_PRIMARY.to}
              className="inline-flex min-h-11 items-center rounded-md bg-[color:var(--blue-600)] px-6 py-3 text-base font-semibold text-white hover:bg-[color:var(--blue-700)]"
            >
              {CTA_PRIMARY.label}
            </Link>
            <Link
              to={CTA_MESSAGE.to}
              className="inline-flex min-h-11 items-center rounded-md border border-[color:var(--brand-navy)]/30 px-5 py-3 text-base font-semibold"
            >
              {CTA_MESSAGE.label}
            </Link>
          </div>
          <p className="mt-4 text-sm">
            <Link to="/how-it-works" className={linkClass}>
              See how it works
            </Link>
          </p>
        </PublicPage>
      </PublicSection>
    </SiteShell>
  );
}
