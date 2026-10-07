import { createFileRoute, Link } from "@tanstack/react-router";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";
import { SiteShell, PublicPage, PublicSection } from "@/components/marketing/site-shell";
import { EmployerInquiryForm } from "@/components/marketing/employer-inquiry-form";
import { PRICE_PILOT_DISPLAY } from "@/config/pricing-core";
import { CTA_BOOK, CTA_FULL_INTAKE, CTA_PRICING } from "@/config/cta";
import {
  FIRST_SHORTLIST_TIMING,
  HUMAN_OVERSIGHT_NOTE,
  OFFER_LAST_UPDATED_LABEL,
  PILOT_IS_PAID_NOTE,
  PROCESS_STEPS,
  RECORDS_NOTE,
  SEATS_NOTE,
  SHORTLIST_LABEL,
  TIMING_FINE_PRINT,
  WHO_RUNS_THE_SEARCH,
} from "@/config/offer-facts";

const entry = getPage("pilot");

export const PILOT_TITLE = `Recruiting Pilot: One Role, ${PRICE_PILOT_DISPLAY} | TaaSFlow`;
export const PILOT_DESCRIPTION = `Evaluate TaaSFlow on one agreed role for ${PRICE_PILOT_DISPLAY}. Review pilot eligibility, what is included, and the next steps before recruiting begins.`;

export const Route = createFileRoute("/pilot")({
  head: () =>
    marketingHead(entry, "/pilot", {
      title: PILOT_TITLE,
      description: PILOT_DESCRIPTION,
    }),
  component: PilotPage,
});

const RECEIVE = [
  `${SHORTLIST_LABEL}, ranked, with the evidence behind each score`,
  "A candidate workspace where you review the shortlist and give feedback",
  "A recruiter who reviews every shortlist before you see it",
  "Scope and delivery schedule confirmed with you before work begins",
];

const NOT_INCLUDED = [
  "More than one role. The pilot covers a single agreed role.",
  "A second pilot. Each company can run the pilot once.",
  "Interview scheduling and offer negotiation on your behalf",
  "Executive search retainers or contingency placements",
  "Background checks, assessments, or payroll",
  "Ongoing delivery beyond the agreed role",
];

const linkClass =
  "font-semibold text-[color:var(--brand-ocean-text)] underline underline-offset-4 hover:no-underline";

function PilotPage() {
  return (
    <SiteShell>
      <PublicSection className="pb-8 pt-16 sm:pt-20">
        <PublicPage>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
                {PRICE_PILOT_DISPLAY} pilot · one role · once per company
              </p>
              <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
                Try TaaSFlow on one role for {PRICE_PILOT_DISPLAY}.
              </h1>
              <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/80">
                See how our recruiting process and candidate workspace support your team before
                discussing a larger engagement. Your pilot covers one agreed role and is available
                once per company. We confirm the scope and delivery schedule before work begins.
              </p>
              <p className="mt-4 max-w-2xl text-sm text-[color:var(--brand-navy)]/80">
                {PILOT_IS_PAID_NOTE} {SHORTLIST_LABEL} is delivered in your workspace.
              </p>
              <p className="mt-6 max-w-2xl text-sm text-[color:var(--brand-navy)]/80">
                Already have a job description?{" "}
                <Link to={CTA_FULL_INTAKE.to} className={linkClass}>
                  {CTA_FULL_INTAKE.label}
                </Link>
                {" · "}
                <Link to={CTA_BOOK.to} className={linkClass}>
                  {CTA_BOOK.label}
                </Link>
              </p>
              <p className="mt-3 text-sm">
                <Link to="/sample-shortlist" className={linkClass}>
                  See a sample top 10
                </Link>
              </p>
              <p className="mt-3 text-xs text-[color:var(--brand-navy)]/70" data-testid="last-updated">
                {OFFER_LAST_UPDATED_LABEL}
              </p>
            </div>
            <EmployerInquiryForm source="pilot-hero" idPrefix="pilot-hero" />
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-8">
        <PublicPage>
          <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
            What happens in the {PRICE_PILOT_DISPLAY} pilot
          </h2>
          <p className="mt-3 max-w-2xl text-[color:var(--brand-navy)]/80">
            {FIRST_SHORTLIST_TIMING} {TIMING_FINE_PRINT}
          </p>
          <ol className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {PROCESS_STEPS.map((s, i) => (
              <li
                key={s.title}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <span
                  aria-hidden
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--brand-navy)]/5 font-[family-name:var(--brand-font-display)] text-sm font-semibold text-[color:var(--brand-navy)]"
                >
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">{s.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 max-w-2xl text-sm text-[color:var(--brand-navy)]/80">
            {WHO_RUNS_THE_SEARCH}
          </p>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-8">
        <PublicPage>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8">
              <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold">
                What you receive
              </h2>
              <ul className="mt-4 space-y-2 text-sm text-[color:var(--brand-navy)]/80">
                {RECEIVE.map((x) => (
                  <li key={x} className="flex gap-2">
                    <span
                      aria-hidden
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-ocean)]"
                    />
                    {x}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-[color:var(--brand-navy)]/80">{SEATS_NOTE}</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8">
              <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold">
                What is not included
              </h2>
              <ul className="mt-4 space-y-2 text-sm text-[color:var(--brand-navy)]/80">
                {NOT_INCLUDED.map((x) => (
                  <li key={x} className="flex gap-2">
                    <span
                      aria-hidden
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-navy)]/25"
                    />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-8">
        <PublicPage>
          <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
            What happens after the pilot
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-[color:var(--brand-navy)]/80">
            You decide whether to talk about a larger engagement. If you stop after the pilot,
            nothing further is owed. {RECORDS_NOTE} {HUMAN_OVERSIGHT_NOTE}
          </p>
          <p className="mt-4 text-sm text-[color:var(--brand-navy)]/80">
            <Link to={CTA_PRICING.to} className={linkClass}>
              {CTA_PRICING.label}
            </Link>
          </p>
        </PublicPage>
      </PublicSection>
    </SiteShell>
  );
}
