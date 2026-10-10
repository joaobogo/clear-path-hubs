/**
 * Shared template for the buyer-intent pages (flat-fee recruiting,
 * subscription recruiting, recruitment agency alternative, AI recruiting
 * agency, recruiting as a service).
 *
 * Server-rendered: the direct answer, every H2, the comparison table and the
 * FAQ are plain markup. The FAQPage JSON-LD is built from the same array that
 * renders the visible FAQ, so the two cannot drift.
 */
import { Link } from "@tanstack/react-router";
import {
  Breadcrumbs,
  CtaSection,
  PublicPage,
  PublicSection,
  SiteShell,
} from "@/components/marketing/site-shell";
import { faqScript, marketingHead, serviceScript } from "@/lib/marketing/head";
import { CTA_MESSAGE, CTA_HOW_IT_WORKS, CTA_PRIMARY } from "@/config/cta";
import { FIRST_SHORTLIST_TIMING, TIMING_FINE_PRINT } from "@/config/offer-facts";
import {
  DIMENSION_LABELS,
  MODEL_CELLS,
  MODEL_LABELS,
  MODEL_ORDER,
  MONEY_PAGES_LAST_UPDATED,
  type MoneyPageContent,
  type MoneySection,
} from "@/content/money-pages";

/** Route `head` for a money page: unique title, description and canonical, plus JSON-LD. */
export function moneyPageHead(page: MoneyPageContent) {
  return marketingHead(
    undefined,
    page.path,
    { title: page.title, description: page.description },
    {
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: page.breadcrumbLabel, path: page.path },
      ],
      scripts: [
        serviceScript({
          name: page.serviceName,
          description: page.description,
          path: page.path,
          serviceType: page.serviceType,
        }),
        faqScript(page.faqs),
      ],
    },
  );
}

function Section({ section }: { section: MoneySection }) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-3xl">
        {section.h2}
      </h2>
      {section.paragraphs.map((p) => (
        <p key={p} className="mt-4 text-base leading-relaxed text-[color:var(--brand-navy)]/85">
          {p}
        </p>
      ))}
      {section.bullets?.length ? (
        <ul className="mt-4 list-disc space-y-2 pl-5 text-base leading-relaxed text-[color:var(--brand-navy)]/85">
          {section.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ComparisonTable({ page }: { page: MoneyPageContent }) {
  const { comparison } = page;
  return (
    <section className="mt-12" aria-labelledby={`${page.slug}-comparison`}>
      <h2
        id={`${page.slug}-comparison`}
        className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-3xl"
      >
        {comparison.h2}
      </h2>
      <p className="mt-4 text-base leading-relaxed text-[color:var(--brand-navy)]/85">{comparison.intro}</p>
      <div className="mt-6 overflow-x-auto rounded-xl border border-[color:var(--brand-navy)]/10">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <caption className="sr-only">Operating models compared in general terms</caption>
          <thead className="bg-[color:var(--brand-mist)]/50">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold text-[color:var(--brand-navy)]">
                Operating model
              </th>
              {comparison.dimensions.map((d) => (
                <th key={d} scope="col" className="px-4 py-3 font-semibold text-[color:var(--brand-navy)]">
                  {DIMENSION_LABELS[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODEL_ORDER.map((m) => (
              <tr
                key={m}
                className={
                  m === "taasflow"
                    ? "border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/30"
                    : "border-t border-[color:var(--brand-navy)]/10"
                }
              >
                <th scope="row" className="px-4 py-3 align-top font-semibold text-[color:var(--brand-navy)]">
                  {MODEL_LABELS[m]}
                </th>
                {comparison.dimensions.map((d) => (
                  <td key={d} className="px-4 py-3 align-top text-[color:var(--brand-navy)]/85">
                    {MODEL_CELLS[m][d]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {comparison.note ? (
        <p className="mt-3 text-sm text-[color:var(--brand-navy)]/70">{comparison.note}</p>
      ) : null}
    </section>
  );
}

export function MoneyPageView({ page }: { page: MoneyPageContent }) {
  return (
    <SiteShell>
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: page.breadcrumbLabel }]} />

      <PublicSection className="pb-6 pt-8 sm:pt-12">
        <PublicPage>
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-ocean-text)]">
              {page.eyebrow}
            </p>
            <h1 className="mt-4 font-[family-name:var(--brand-font-display)] text-4xl font-semibold leading-[1.1] tracking-tight text-balance text-[color:var(--brand-navy)] sm:text-5xl">
              {page.h1}
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-[color:var(--brand-navy)]/90">{page.directAnswer}</p>
            <p className="mt-3 text-sm text-[color:var(--brand-navy)]/70">
              Last updated: {MONEY_PAGES_LAST_UPDATED}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to={CTA_PRIMARY.to}
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--blue-600)] px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-on-dark)] shadow-sm hover:opacity-90"
              >
                {CTA_PRIMARY.label}
              </Link>
              <Link
                to={CTA_MESSAGE.to}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
              >
                {CTA_MESSAGE.label}
              </Link>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="pt-6">
        <PublicPage>
          <article className="max-w-3xl">
            {page.sections.map((s) => (
              <Section key={s.h2} section={s} />
            ))}
            <ComparisonTable page={page} />
            {page.sectionsAfter.map((s) => (
              <Section key={s.h2} section={s} />
            ))}

            <section className="mt-12" aria-labelledby={`${page.slug}-faq`}>
              <h2
                id={`${page.slug}-faq`}
                className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-3xl"
              >
                Frequently asked questions
              </h2>
              <div className="mt-6 space-y-3">
                {page.faqs.map((f) => (
                  <details
                    key={f.q}
                    className="group rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-5"
                  >
                    <summary className="cursor-pointer list-none text-base font-semibold text-[color:var(--brand-navy)]">
                      {f.q}
                    </summary>
                    <p className="mt-3 text-sm leading-relaxed text-[color:var(--brand-navy)]/85">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>

            <nav className="mt-12" aria-label="Related pages">
              <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight text-[color:var(--brand-navy)]">
                Keep reading
              </h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {page.related.map((r) => (
                  <li key={r.to}>
                    <Link
                      to={r.to}
                      className="block rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-4 hover:border-[color:var(--brand-ocean)]/40"
                    >
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
        secondary={{ to: CTA_MESSAGE.to, label: CTA_MESSAGE.label }}
        tertiary={{ to: CTA_HOW_IT_WORKS.to, label: CTA_HOW_IT_WORKS.label }}
      />
    </SiteShell>
  );
}
