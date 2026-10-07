import { createFileRoute, Link } from "@tanstack/react-router";
import { Briefcase, Building2, Handshake, Rocket } from "lucide-react";

import { PublicPage, PublicSection, SiteShell, CtaSection } from "@/components/marketing/site-shell";
import { marketingHead } from "@/lib/marketing/head";
import { PRICE_PILOT_USD } from "@/config/pricing-core";
import { OFFER_CATEGORY, WHO_RUNS_THE_SEARCH } from "@/config/offer-facts";

export const Route = createFileRoute("/solutions")({
  head: () =>
    marketingHead(undefined, "/solutions", {
      title: "Who TaaSFlow Is For | HR, Operators, Founders",
      description:
        "TaaSFlow is a recruiting platform with managed execution for HR and talent teams, hospitality and frontline operators, founders and staffing agencies.",
    }),
  component: SolutionsPage,
});

const AUDIENCES = [
  {
    icon: Briefcase,
    title: "HR and talent teams",
    body: "Not an agency. Sourcing capacity for your team at a flat fee, with the evidence behind every score.",
    to: "/for-hr-teams",
    cta: "For HR and talent teams",
  },
  {
    icon: Building2,
    title: "Hospitality and frontline operators",
    body: "Hiring for multi-site and shift-based roles, with a shortlist built around the requirements of the role.",
    to: "/industries/hospitality",
    cta: "Hospitality hiring",
  },
  {
    icon: Rocket,
    title: "Founders",
    body: `Your first recruiter, for $${PRICE_PILOT_USD} a role. One pilot per company.`,
    to: "/for-founders",
    cta: "For founders",
  },
  {
    icon: Handshake,
    title: "Staffing agencies",
    body: "Add sourcing and screening capacity behind your own client relationships. TaaSFlow does not place workers.",
    to: "/partnerships/staffing",
    cta: "Staffing partnerships",
  },
] as const;

const LINK_CLASS =
  "mt-4 text-sm font-semibold text-[color:var(--brand-ocean-text)] underline-offset-4 hover:underline";

function SolutionsPage() {
  return (
    <SiteShell>
      <PublicSection className="pb-6 pt-16 sm:pt-20">
        <PublicPage className="max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
            Who TaaSFlow is for
          </p>
          <h1 className="mt-3 font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">
            Pick the page that matches how you hire.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/80">
            TaaSFlow is a {OFFER_CATEGORY.toLowerCase()}. {WHO_RUNS_THE_SEARCH}
          </p>
        </PublicPage>
      </PublicSection>
      <PublicSection className="py-8">
        <PublicPage>
          <div className="grid gap-5 md:grid-cols-2">
            {AUDIENCES.map((a) => (
              <article
                key={a.title}
                className="flex flex-col rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <a.icon className="h-6 w-6 text-[color:var(--brand-ocean-text)]" aria-hidden />
                <h2 className="mt-4 text-xl font-semibold text-[color:var(--brand-navy)]">{a.title}</h2>
                <p className="mt-2 flex-1 text-sm text-[color:var(--brand-navy)]/80">{a.body}</p>
                {a.to === "/industries/hospitality" ? (
                  <Link
                    to="/industries/$slug"
                    params={{ slug: "hospitality" }}
                    className={LINK_CLASS}
                  >
                    {a.cta} →
                  </Link>
                ) : (
                  <Link to={a.to} className={LINK_CLASS}>
                    {a.cta} →
                  </Link>
                )}
              </article>
            ))}
          </div>
        </PublicPage>
      </PublicSection>
      <CtaSection
        eyebrow="Not sure which fits?"
        title="Talk it through with us."
        description="Book a call and we will point you to the right starting point for your roles."
      />
    </SiteShell>
  );
}
