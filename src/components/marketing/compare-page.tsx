/**
 * View for the comparison pages. Server-rendered markup; the FAQ JSON-LD is
 * built from the same array that renders the visible FAQ. Competitor facts, if
 * any, render with their source link and access date in the Sources section.
 */
import { Link } from "@tanstack/react-router";
import { Breadcrumbs, CtaSection, PublicPage, PublicSection, SiteShell } from "@/components/marketing/site-shell";
import { faqScript, marketingHead } from "@/lib/marketing/head";
import { CTA_BOOK, CTA_HOW_IT_WORKS, CTA_PRIMARY } from "@/config/cta";
import { FIRST_SHORTLIST_TIMING, TIMING_FINE_PRINT } from "@/config/offer-facts";
import { COMPARE_LAST_UPDATED, citedFacts, type ComparePageContent } from "@/content/compare-pages";

export function comparePageHead(page: ComparePageContent) {
  return marketingHead(
    undefined,
    page.path,
    { title: page.title, description: page.description },
    {
      breadcrumbs: [
        { name: "Home", path: "/" },
        ...(page.path === "/compare" ? [] : page.path.startsWith("/compare/") ? [{ name: "Compare", path: "/compare" }] : []),
        { name: page.breadcrumbLabel, path: page.path },
      ],
      scripts: [faqScript(page.faqs)],
    },
  );
}

const H2 =
  "font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-3xl";

export function ComparePageView({ page }: { page: ComparePageContent }) {
  const facts = citedFacts(page);
  const crumbs =
    page.path === "/compare"
      ? [{ label: "Home", to: "/" }, { label: page.breadcrumbLabel }]
      : page.path.startsWith("/compare/")
        ? [{ label: "Home", to: "/" }, { label: "Compare", to: "/compare" }, { label: page.breadcrumbLabel }]
        : [{ label: "Home", to: "/" }, { label: page.breadcrumbLabel }];
  return (
    <SiteShell>
      <Breadcrumbs items={crumbs as never} />
      <PublicSection className="pb-6 pt-8 sm:pt-12">
        <PublicPage>
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-ocean-text)]">{page.eyebrow}</p>
            <h1 className="mt-4 font-[family-name:var(--brand-font-display)] text-4xl font-semibold leading-[1.1] tracking-tight text-balance text-[color:var(--brand-navy)] sm:text-5xl">
              {page.h1}
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-[color:var(--brand-navy)]/90">{page.directAnswer}</p>
            <p className="mt-3 text-sm text-[color:var(--brand-navy)]/70">Last updated: {COMPARE_LAST_UPDATED}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={CTA_PRIMARY.to} className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-on-dark)] shadow-sm hover:opacity-90">
                {CTA_PRIMARY.label}
              </Link>
              <Link to={CTA_BOOK.to} className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5">
                {CTA_BOOK.label}
              </Link>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="pt-6">
        <PublicPage>
          <article className="max-w-3xl">
            {page.sections.map((s) => (
              <section key={s.h2} className="mt-12 first:mt-0">
                <h2 className={H2}>{s.h2}</h2>
                {s.paragraphs.map((p) => (
                  <p key={p} className="mt-4 text-base leading-relaxed text-[color:var(--brand-navy)]/85">{p}</p>
                ))}
                {s.bullets?.length ? (
                  <ul className="mt-4 list-disc space-y-2 pl-5 text-base leading-relaxed text-[color:var(--brand-navy)]/85">
                    {s.bullets.map((b) => (<li key={b}>{b}</li>))}
                  </ul>
                ) : null}
                {s.table ? (
                  <>
                    <div className="mt-6 overflow-x-auto rounded-xl border border-[color:var(--brand-navy)]/10">
                      <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                        <caption className="sr-only">{s.table.caption}</caption>
                        <thead className="bg-[color:var(--brand-mist)]/50">
                          <tr>
                            {s.table.headers.map((h, i) => (
                              <th key={`${h}-${i}`} scope="col" className="px-4 py-3 font-semibold text-[color:var(--brand-navy)]">{h || "Dimension"}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {s.table.rows.map((r) => (
                            <tr key={r[0]} className="border-t border-[color:var(--brand-navy)]/10">
                              <th scope="row" className="px-4 py-3 align-top font-semibold text-[color:var(--brand-navy)]">{r[0]}</th>
                              {r.slice(1).map((c, i) => (
                                <td key={i} className="px-4 py-3 align-top text-[color:var(--brand-navy)]/85">{c}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {s.table.note ? <p className="mt-3 text-sm text-[color:var(--brand-navy)]/70">{s.table.note}</p> : null}
                  </>
                ) : null}
              </section>
            ))}

            {facts.length ? (
              <section className="mt-12" aria-labelledby={`${page.slug}-sources`}>
                <h2 id={`${page.slug}-sources`} className={H2}>Where do the competitor facts come from?</h2>
                <ul className="mt-4 space-y-2 text-sm text-[color:var(--brand-navy)]/85">
                  {facts.map((f) => (
                    <li key={`${f.competitor}-${f.sourceUrl}-${f.statement}`}>
                      {f.competitor}: {f.statement}{" "}
                      <a href={f.sourceUrl} rel="nofollow noopener" target="_blank" className="underline">Source</a>, read on {f.accessedOn}.
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="mt-12" aria-labelledby={`${page.slug}-faq`}>
              <h2 id={`${page.slug}-faq`} className={H2}>Frequently asked questions</h2>
              <div className="mt-6 space-y-3">
                {page.faqs.map((f) => (
                  <details key={f.q} className="group rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-5">
                    <summary className="cursor-pointer list-none text-base font-semibold text-[color:var(--brand-navy)]">{f.q}</summary>
                    <p className="mt-3 text-sm leading-relaxed text-[color:var(--brand-navy)]/85">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>

            <nav className="mt-12" aria-label="Related pages">
              <h2 className={H2}>Keep reading</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {page.related.map((r) => (
                  <li key={r.to}>
                    <Link to={r.to as never} className="block rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-4 hover:border-[color:var(--brand-ocean)]/40">
                      <span className="block text-sm font-semibold text-[color:var(--brand-navy)]">{r.label}</span>
                      <span className="mt-0.5 block text-sm text-[color:var(--brand-navy)]/75">{r.desc}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </article>
        </PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow={page.eyebrow}
        title="Try it on one role."
        description={`${FIRST_SHORTLIST_TIMING} ${TIMING_FINE_PRINT}`}
        primary={{ to: CTA_PRIMARY.to, label: CTA_PRIMARY.label }}
        secondary={{ to: CTA_BOOK.to, label: CTA_BOOK.label }}
        tertiary={{ to: CTA_HOW_IT_WORKS.to, label: CTA_HOW_IT_WORKS.label }}
      />
    </SiteShell>
  );
}
