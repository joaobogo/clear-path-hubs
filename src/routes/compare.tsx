import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Minus } from "lucide-react";
import { PublicPage, PublicSection, SiteShell, CtaSection } from "@/components/marketing/site-shell";
import { marketingHead, serviceScript } from "@/lib/marketing/head";
import { PRICE_PILOT_DISPLAY } from "@/config/pricing-core";
import { PILOT_GUARANTEE, PILOT_OWNERSHIP, PILOT_TIMELINE_LINE } from "@/config/commercial-truth";

export const Route = createFileRoute("/compare")({
  head: () => marketingHead(undefined, "/compare", {
    title: "TaaSFlow vs Recruiting Agencies and Sourcing Tools",
    description: "Compare flat-fee TaaSFlow recruiting with contingency agencies, sourcing software and in-house sourcing on cost model, work required and candidate ownership.",
  }, {
    breadcrumbs: [{ name: "Home", path: "/" }, { name: "Compare", path: "/compare" }],
    scripts: [serviceScript({
      name: "TaaSFlow flat-fee recruiting",
      description: "Flat-fee recruiting with a $699 first-role pilot, a guaranteed top 10 and no placement fee.",
      path: "/compare",
      serviceType: "Recruiting",
    })],
  }),
  component: ComparePage,
});

const rows = [
  { label: "Commercial model", taasflow: "Flat fee. $699 first-role pilot; published package pricing after that.", agency: "Commonly a percentage of first-year salary or a retained-search fee.", software: "Software subscription; your team still runs the search." },
  { label: "Who runs sourcing", taasflow: "TaaSFlow agents and recruiting team run the search and outreach.", agency: "The agency recruiter runs the search.", software: "Your internal team runs the search using the software." },
  { label: "How candidates are delivered", taasflow: "Ranked top 10 with scores tied to the criteria you approved.", agency: "Varies by agency and recruiter.", software: "Profiles, search results or applicants for your team to assess." },
  { label: "Placement fee", taasflow: "None.", agency: "Often part of the model.", software: "None, but the subscription does not include done-for-you recruiting." },
  { label: "Candidate ownership", taasflow: "Candidates sourced for your role remain yours to keep and reuse.", agency: "Depends on the agreement.", software: "Your account data is governed by the software contract." },
  { label: "Human review", taasflow: "A senior recruiter approves the shortlist before client delivery.", agency: "Human recruiter-led.", software: "Depends on your internal process." },
] as const;

function Cell({ children, positive = false }: { children: ReactNode; positive?: boolean }) {
  return (
    <div className="flex gap-2 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">
      {positive ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-ocean-text)]" aria-hidden /> : <Minus className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-navy)]/40" aria-hidden />}
      <span>{children}</span>
    </div>
  );
}

function ComparePage() {
  return (
    <SiteShell>
      <PublicSection className="pb-8 pt-16 sm:pt-20">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-ocean-text)]">Compare recruiting models</p>
          <h1 className="mt-3 max-w-4xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">Agency, sourcing software, or a flat-fee recruiting service?</h1>
          <p className="mt-5 max-w-3xl text-lg text-[color:var(--brand-navy)]/80">The right choice depends on whether you want to buy a placement, buy software, or buy recruiting execution. TaaSFlow is built for the third option.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/intake" className="inline-flex min-h-11 items-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white">Start your first role — {PRICE_PILOT_DISPLAY}</Link>
            <Link to="/pricing" className="inline-flex min-h-11 items-center rounded-md border border-[color:var(--brand-navy)]/15 px-5 py-2.5 text-sm font-semibold">See full pricing</Link>
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-8">
        <PublicPage>
          <div className="overflow-x-auto rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white">
            <table className="w-full min-w-[850px] border-collapse text-left">
              <thead><tr className="border-b border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)]"><th className="p-4 text-sm font-semibold">What you compare</th><th className="p-4 text-sm font-semibold">TaaSFlow</th><th className="p-4 text-sm font-semibold">Traditional agency</th><th className="p-4 text-sm font-semibold">Sourcing software</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-b border-[color:var(--brand-navy)]/8 last:border-0">
                    <th className="p-4 align-top text-sm font-semibold">{row.label}</th>
                    <td className="p-4 align-top"><Cell positive>{row.taasflow}</Cell></td>
                    <td className="p-4 align-top"><Cell>{row.agency}</Cell></td>
                    <td className="p-4 align-top"><Cell>{row.software}</Cell></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-8">
        <PublicPage><div className="grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"><p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--brand-ocean-text)]">Delivery</p><h2 className="mt-2 text-xl font-semibold">Top 10, then market depth</h2><p className="mt-3 text-sm text-[color:var(--brand-navy)]/80">{PILOT_TIMELINE_LINE}</p></div>
          <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"><p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--brand-ocean-text)]">Risk reversal</p><h2 className="mt-2 text-xl font-semibold">A score-based rerun promise</h2><p className="mt-3 text-sm text-[color:var(--brand-navy)]/80">{PILOT_GUARANTEE}</p></div>
          <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"><p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--brand-ocean-text)]">Control</p><h2 className="mt-2 text-xl font-semibold">Your candidate pipeline</h2><p className="mt-3 text-sm text-[color:var(--brand-navy)]/80">{PILOT_OWNERSHIP}</p></div>
        </div></PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow="Start with one role"
        title={"Try the full process for " + PRICE_PILOT_DISPLAY + "."}
        description="One company, one pilot, one role. No placement fee."
        primary={{ to: "/intake", label: "Start your first role — " + PRICE_PILOT_DISPLAY }}
        secondary={{ to: "/book", label: "Book a 20-minute call" }}
      />
    </SiteShell>
  );
}