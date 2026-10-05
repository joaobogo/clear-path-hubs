import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { PublicPage, PublicSection, SiteShell, CtaSection } from "@/components/marketing/site-shell";
import { PRICE_PILOT_DISPLAY } from "@/config/pricing-core";
import type { MoneyPageData } from "@/content/seo-money-pages";

export function SeoMoneyPage({ page }: { page: MoneyPageData }) {
  return (
    <SiteShell>
      <PublicSection className="pb-8 pt-16 sm:pt-20">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-ocean-text)]">{page.eyebrow}</p>
          <h1 className="mt-3 max-w-4xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">{page.h1}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-[color:var(--brand-navy)]/80">{page.directAnswer}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/intake" className="inline-flex min-h-11 items-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white">Start your first role — {PRICE_PILOT_DISPLAY}</Link>
            <Link to="/book" className="inline-flex min-h-11 items-center rounded-md border border-[color:var(--brand-navy)]/15 px-5 py-2.5 text-sm font-semibold">Book a 20-minute call</Link>
          </div>
          <p className="mt-4 text-xs text-[color:var(--brand-navy)]/60">Updated October 2026 · TaaSFlow</p>
        </PublicPage>
      </PublicSection>

      {page.sections.map((section, index) => (
        <PublicSection key={section.heading} className={index % 2 ? "bg-white/60" : undefined}>
          <PublicPage>
            <div className="max-w-3xl">
              <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">{section.heading}</h2>
              <div className="mt-4 space-y-4 text-base leading-relaxed text-[color:var(--brand-navy)]/80">
                {section.paragraphs.map((p) => <p key={p}>{p}</p>)}
              </div>
              {section.bullets?.length ? (
                <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                  {section.bullets.map((item) => <li key={item} className="flex gap-2 rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-4 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-ocean-text)]" aria-hidden /><span>{item}</span></li>)}
                </ul>
              ) : null}
            </div>
          </PublicPage>
        </PublicSection>
      ))}

      <PublicSection>
        <PublicPage>
          <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">Frequently asked questions</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {page.faqs.map((item) => (
              <details key={item.q} className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-5">
                <summary className="cursor-pointer font-semibold">{item.q}</summary>
                <p className="mt-3 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">{item.a}</p>
              </details>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow="Start with one role"
        title={"See the recruiting work on a real role for " + PRICE_PILOT_DISPLAY + "."}
        description="One company, one pilot, one role. Guaranteed top 10. No placement fee."
        primary={{ to: "/intake", label: "Start your first role — " + PRICE_PILOT_DISPLAY }}
        secondary={{ to: "/book", label: "Book a 20-minute call" }}
      />
    </SiteShell>
  );
}
