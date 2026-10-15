import { createFileRoute, Link } from "@tanstack/react-router";
import { Briefcase, Building2, Handshake, Rocket } from "lucide-react";

import { PublicPage, PublicSection, SiteShell, CtaSection } from "@/components/marketing/site-shell";
import { marketingHead } from "@/lib/marketing/head";
import { PRICE_PILOT_USD } from "@/config/pricing-core";
import { OFFER_CATEGORY, WHO_RUNS_THE_SEARCH } from "@/config/offer-facts";
import { PagePhotograph } from "@/components/marketing/page-photograph";
import hrTeam from "@/assets/page-pricing-hero.jpg";
import foundersTeam from "@/assets/page-founders-team.jpg";
import staffingTeam from "@/assets/page-recruiting-service.jpg";
import { getIndustryHeroImage } from "@/content/industry-hero-images";

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
    image: hrTeam,
    imageAlt: "A talent team discussing its hiring requirements around a shared desk.",
    title: "HR and talent teams",
    body: "Not an agency. Sourcing capacity for your team at a flat fee, with the evidence behind every score.",
    to: "/for-hr-teams",
    cta: "For HR and talent teams",
  },
  {
    icon: Building2,
    image: getIndustryHeroImage("hospitality")?.src,
    imageAlt: getIndustryHeroImage("hospitality")?.alt ?? "Hospitality professionals at work in a hotel.",
    title: "Hospitality operators",
    body: "Hiring for multi-site and shift-based roles, with a shortlist built around the requirements of the role.",
    to: "/industries/hospitality",
    cta: "Hospitality hiring",
  },
  {
    icon: Rocket,
    image: foundersTeam,
    imageAlt: "Founders and an engineering lead discussing their next hire at a studio table.",
    title: "Founders",
    body: `Start with a $${PRICE_PILOT_USD} one-role pilot, once per company. Build your shortlist without building a recruiting team.`,
    to: "/for-founders",
    cta: "For founders",
  },
  {
    icon: Handshake,
    image: staffingTeam,
    imageAlt: "Recruiting partners reviewing application evidence and sourcing candidates.",
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
    <SiteShell hideClosingBand>
      <PublicSection className="pb-6 pt-16 sm:pt-20">
        <PublicPage className="max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
            Who TaaSFlow is for
          </p>
          <h1 className="mt-3 font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">
            Recruiting that fits your team.
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
                className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-on-dark)]"
              >
                {a.image ? <PagePhotograph src={a.image} alt={a.imageAlt} className="aspect-[16/9]" /> : null}
                <div className="flex flex-1 flex-col p-6">
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
                </div>
              </article>
            ))}
          </div>
        </PublicPage>
      </PublicSection>
      <PublicSection className="border-t border-[color:var(--rule)]">
        <PublicPage>
          <h2 className="text-2xl font-semibold text-[color:var(--ink)]">Hiring in a specific industry?</h2>
          <Link to="/industries" className="mt-4 inline-flex min-h-11 items-center font-semibold text-[color:var(--blue-600)] underline underline-offset-4">Browse industry-specific hiring →</Link>
        </PublicPage>
      </PublicSection>
      <CtaSection
        eyebrow="Not sure which fits?"
        title="Talk it through with us."
        description="Send us a message and we will point you to the right starting point for your roles."
      />
    </SiteShell>
  );
}
