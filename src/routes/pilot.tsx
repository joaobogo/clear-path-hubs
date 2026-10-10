import { createFileRoute, Link } from "@tanstack/react-router";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";
import { SiteShell, PublicPage, PublicSection } from "@/components/marketing/site-shell";
import { EmployerInquiryForm } from "@/components/marketing/employer-inquiry-form";
import { NEVER_CHARGED } from "@/content/pricing";
import { offer, pilotPriceLabel } from "@/config/offer";
import { PRICE_PILOT_DISPLAY } from "@/config/pricing-core";
import { CTA_MESSAGE, CTA_FULL_INTAKE, CTA_PRICING } from "@/config/cta";
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

/** The four steps on the clock, counted from the approved brief. */
const STEP_TIMES = ["Day 0", "Day 1", "Days 1 to 4", "Day 5, 09:00"] as const;

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

const linkClass = "font-medium text-[color:var(--blue-600)] underline underline-offset-4 hover:no-underline";

/**
 * The pilot as a checkout (The Run). The visitor arriving here has decided:
 * the left column reassures, the blue order card on the right collects and
 * stays in view. The header's button is the quiet alternative, so the card's
 * white button is the one primary action on the page.
 */
function PilotPage() {
  return (
    <SiteShell>
      <PublicSection className="pb-16 pt-14 sm:pt-20">
        <PublicPage>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start lg:gap-16">
            <div className="min-w-0">
              <h1 className="display max-w-[14ch] text-[clamp(40px,5.5vw,60px)] text-[color:var(--ink)]">
                One role. Ten candidates. Five days.
              </h1>
              <p className="mt-6 max-w-[640px] text-[21px] leading-[1.45] text-[color:var(--slate)]">
                A paid evaluation of the real thing: one role, run end to end, once per company. If you
                stop afterwards, nothing further is owed.
              </p>
              <p className="mt-4 max-w-[640px] text-[17px] text-[color:var(--slate)]">
                {FIRST_SHORTLIST_TIMING} {TIMING_FINE_PRINT}
              </p>
              <p className="mt-3 text-sm text-[color:var(--faint)]" data-testid="last-updated">
                {OFFER_LAST_UPDATED_LABEL}
              </p>

              {/* Four steps on the clock */}
              <ol className="mt-12 divide-y divide-[color:var(--rule)] border-y border-[color:var(--rule)]" aria-label="The four steps of the pilot">
                {PROCESS_STEPS.map((s, i) => (
                  <li key={s.title} className="grid gap-2 py-5 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-6">
                    <p className="narrow num text-[13px] font-medium text-[color:var(--faint)]">{STEP_TIMES[i]}</p>
                    <div>
                      <h2 className="text-[22px] leading-[1.2] text-[color:var(--ink)]">{s.title}</h2>
                      <p className="mt-1.5 max-w-[560px] text-[15px] leading-relaxed text-[color:var(--slate)]">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-5 max-w-[640px] text-[15px] text-[color:var(--slate)]">{WHO_RUNS_THE_SEARCH}</p>

              {/* What you receive, and just as visibly, what the pilot does not cover */}
              <div className="mt-12 grid gap-10 sm:grid-cols-2">
                <div>
                  <h2 className="text-[22px] leading-[1.2] text-[color:var(--ink)]">What you receive</h2>
                  <ul className="mt-4 divide-y divide-[color:var(--rule)] border-t border-[color:var(--ink)]">
                    {RECEIVE.map((x) => (
                      <li key={x} className="py-3 text-[15px] text-[color:var(--ink)]">
                        {x}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm text-[color:var(--faint)]">{SEATS_NOTE}</p>
                </div>
                <div>
                  <h2 className="text-[22px] leading-[1.2] text-[color:var(--ink)]">What the pilot does not cover</h2>
                  <ul className="mt-4 divide-y divide-[color:var(--rule)] border-t border-[color:var(--ink)]">
                    {NOT_INCLUDED.map((x) => (
                      <li key={x} className="py-3 text-[15px] text-[color:var(--slate)]">
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-12 border-t border-[color:var(--rule)] pt-6">
                <h2 className="text-[22px] leading-[1.2] text-[color:var(--ink)]">After the pilot</h2>
                <p className="mt-2 max-w-[640px] text-[15px] leading-relaxed text-[color:var(--slate)]">
                  You decide whether to talk about a larger engagement. {RECORDS_NOTE} {HUMAN_OVERSIGHT_NOTE}
                </p>
                <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
                  <Link to={CTA_PRICING.to} className={linkClass}>
                    {CTA_PRICING.label}
                  </Link>
                  <Link to="/sample-shortlist" className={linkClass}>
                    See a sample top 10
                  </Link>
                  <Link to={CTA_FULL_INTAKE.to} className={linkClass}>
                    {CTA_FULL_INTAKE.label}
                  </Link>
                  <Link to={CTA_MESSAGE.to} className={linkClass}>
                    {CTA_MESSAGE.label}
                  </Link>
                </p>
              </div>
            </div>

            {/* The order card: solid blue, fixed while the left column scrolls. */}
            <aside className="blue rounded-[var(--r-3)] p-6 sm:p-8 lg:sticky lg:top-[96px]" aria-label="Your pilot order">
              <p className="narrow text-[13px] font-medium text-[color:var(--text-3)]">The pilot</p>
              <p className="wide num mt-1 text-[52px] font-semibold leading-none text-[color:var(--text)]">{pilotPriceLabel}</p>
              <p className="mt-2 text-[15px] text-[color:var(--text-2)]">
                One role · up to {offer.pilot.candidates} candidates · {offer.pilot.seats} seats · once per company
              </p>
              <div className="mt-6">
                <EmployerInquiryForm source="pilot-hero" idPrefix="pilot-hero" variant="blue" />
              </div>
              <dl className="mt-6 flex flex-col gap-2 border-t border-[color:var(--line)] pt-4">
                {NEVER_CHARGED.slice(0, 3).map((label) => (
                  <div key={label} className="flex items-baseline gap-2 text-[15px]">
                    <dt className="min-w-0 text-[color:var(--text-2)]">{label}</dt>
                    <span aria-hidden className="mb-1 min-w-4 flex-1 self-end border-b border-dotted border-[color:var(--line-2)]" />
                    <dd className="num shrink-0 font-medium text-[color:var(--text)]">$0.00</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-[13px] leading-relaxed text-[color:var(--text-3)]">
                {PILOT_IS_PAID_NOTE} {TIMING_FINE_PRINT}
              </p>
            </aside>
          </div>
        </PublicPage>
      </PublicSection>
    </SiteShell>
  );
}
