import { Link } from "@tanstack/react-router";

import { PublicPage, PublicSection, SiteShell, CtaSection } from "@/components/marketing/site-shell";
import { CTA_MESSAGE, CTA_PRIMARY } from "@/config/cta";
import { OFFER_LAST_UPDATED_LABEL } from "@/config/offer-facts";

export type AudienceSection = {
  id: string;
  title: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
};

export type AudiencePageProps = {
  eyebrow: string;
  title: string;
  lead: string;
  sections: readonly AudienceSection[];
  faq: readonly { q: string; a: string }[];
  links: readonly { to: string; label: string; desc: string }[];
  ctaTitle: string;
  ctaDescription: string;
};

/** Shared layout for the audience pages. Each page supplies its own copy. */
export function AudiencePage(props: AudiencePageProps) {
  return (
    <SiteShell>
      <PublicSection className="pb-6 pt-16 sm:pt-20">
        <PublicPage className="max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
            {props.eyebrow}
          </p>
          <h1 className="mt-3 font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">
            {props.title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/80">{props.lead}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to={CTA_PRIMARY.to}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--blue-600)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
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
          <p className="mt-4 text-xs text-[color:var(--brand-navy)]/70">{OFFER_LAST_UPDATED_LABEL}</p>
        </PublicPage>
      </PublicSection>

      {props.sections.map((s, i) => (
        <PublicSection
          key={s.id}
          id={s.id}
          className={i % 2 === 0 ? "py-10" : "py-10 bg-[color:var(--brand-cream)]"}
        >
          <PublicPage className="max-w-4xl">
            <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-3xl">
              {s.title}
            </h2>
            {s.paragraphs.map((p) => (
              <p key={p} className="mt-4 text-[color:var(--brand-navy)]/80">
                {p}
              </p>
            ))}
            {s.bullets ? (
              <ul className="mt-4 space-y-2 text-sm text-[color:var(--brand-navy)]/80">
                {s.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span
                      aria-hidden
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--blue-600)]"
                    />
                    {b}
                  </li>
                ))}
              </ul>
            ) : null}
          </PublicPage>
        </PublicSection>
      ))}

      <PublicSection id="faq" className="py-10">
        <PublicPage className="max-w-4xl">
          <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-3xl">
            Questions people ask
          </h2>
          <div className="mt-6 divide-y divide-[color:var(--brand-navy)]/10 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white">
            {props.faq.map((f) => (
              <details key={f.q} className="p-5">
                <summary className="cursor-pointer text-sm font-semibold text-[color:var(--brand-navy)]">
                  {f.q}
                </summary>
                <p className="mt-3 text-sm text-[color:var(--brand-navy)]/80">{f.a}</p>
              </details>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-6">
        <PublicPage className="max-w-4xl">
          <h2 className="text-lg font-semibold text-[color:var(--brand-navy)]">Keep reading</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {props.links.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className="block h-full rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-4 hover:border-[color:var(--brand-navy)]/25"
                >
                  <span className="font-semibold text-[color:var(--brand-navy)]">{l.label}</span>
                  <span className="mt-1 block text-sm text-[color:var(--brand-navy)]/80">{l.desc}</span>
                </Link>
              </li>
            ))}
          </ul>
        </PublicPage>
      </PublicSection>

      <CtaSection eyebrow="Next step" title={props.ctaTitle} description={props.ctaDescription} />
    </SiteShell>
  );
}
