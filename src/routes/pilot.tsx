import { createFileRoute, Link } from "@tanstack/react-router";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";
import { SiteShell, PublicPage, PublicSection, CtaSection } from "@/components/marketing/site-shell";
import { PRICE_PILOT_DISPLAY } from "@/config/pricing-core";
import { PILOT_GUARANTEE, PILOT_OWNERSHIP, PILOT_SCOPE_NOTE, PILOT_TIMELINE_LINE } from "@/config/commercial-truth";

const entry = getPage("pilot");

export const Route = createFileRoute("/pilot")({
  head: () =>
    marketingHead(entry, "/pilot", {
      title: `Recruiting Pilot: One Role, Top 10 Candidates, ${PRICE_PILOT_DISPLAY} | TaaSFlow`,
      description:
        "One role, run end to end for $699. Guaranteed top 10, first ranked delivery in 5 business days, and a full scored market view by day 15.",
    }),
  component: PilotPage,
});

const TIMELINE = [
  {
    n: "01",
    title: "Intake",
    when: "Day 1",
    body:
      "You create your workspace and upload the job description. TaaSFlow builds the role blueprint, screening criteria and sourcing plan automatically, and you review or edit every detail before the search goes live.",
  },
  {
    n: "02",
    title: "Sourcing and scoring",
    when: "Days 1–15",
    body:
      "Sourcing agents continuously identify candidates across talent signals, then the Scoring Engine scores every candidate against your rubric. Each score is tied to evidence pulled from the CV, so you can see why a candidate ranks where they do.",
  },
  {
    n: "03",
    title: "Ranked shortlist review",
    when: "By Day 5",
    body:
      "Reviewed, evidence-backed candidates are published to your dashboard, ranked. You review, message your platform experts, and give feedback that shapes the next round.",
  },
];

const RECEIVE = [
  "One role scoped end-to-end with our team",
  "A live client dashboard with pipeline, messages, and status",
  "A guaranteed top 10 candidates, ranked against your approved criteria",
  "Evidence per requirement, tied to CV quotes",
  "Full candidate profiles and CV downloads",
  "Configurable expert oversight, reachable in the workspace",
];

const NOT_INCLUDED = [
  "More than one role — the pilot covers a single active role",
  "A second pilot — each company can run the pilot once",
  "Interview scheduling and offer negotiation on your behalf",
  "Executive search retainers or contingency placements",
  "Background checks, assessments, or payroll",
  "Ongoing weekly delivery — that starts with a subscription",
];

const AFTER = [
  {
    title: "Continue on a subscription",
    body:
      "Move to a flat monthly fee and keep the same workspace, rubric, and expert oversight. Nothing is rebuilt.",
  },
  {
    title: "Stop after the pilot",
    body:
      "No commitment, no placement fee. You keep every candidate the platform surfaced and the evidence behind each score.",
  },
];

function PilotPage() {
  return (
    <SiteShell hideLinkHub>
      <PublicSection className="pb-8 pt-16 sm:pt-20">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
            {PRICE_PILOT_DISPLAY} one-time pilot · one role · one per company
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            Your first role for {PRICE_PILOT_DISPLAY}.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/80">
            One company. One pilot. One role. We run the search, score the market against your
            approved criteria, and guarantee a ranked top 10. {PILOT_TIMELINE_LINE} Each company can run
            the pilot once.
          </p>
          <div className="mt-6 max-w-2xl rounded-xl border border-[color:var(--brand-ocean)]/25 bg-[color:var(--brand-ocean)]/5 p-4 text-sm text-[color:var(--brand-navy)]/80">
            <span className="font-semibold text-[color:var(--brand-navy)]">Best for:</span>{" "}
            teams that need to validate candidate quality before starting a monthly subscription.
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/intake"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Start the pilot intake
            </Link>
            <Link
              to="/book"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
            >
              Book a 20-minute call
            </Link>
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-6">
        <PublicPage>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--brand-ocean-text)]">Guaranteed deliverable</p>
              <p className="mt-2 text-lg font-semibold">Top 10 candidates</p>
              <p className="mt-2 text-sm text-[color:var(--brand-navy)]/75">{PILOT_TIMELINE_LINE}</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--brand-ocean-text)]">90+ score guarantee</p>
              <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">{PILOT_GUARANTEE}</p>
              <p className="mt-2 text-xs text-[color:var(--brand-navy)]/65">{PILOT_SCOPE_NOTE}</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--brand-ocean-text)]">Your pipeline</p>
              <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">{PILOT_OWNERSHIP}</p>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      {/* What happens in the pilot — 3-step timeline */}
      <PublicSection className="py-8">
        <PublicPage>
          <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
            What happens in the {PRICE_PILOT_DISPLAY} pilot
          </h2>
          <p className="mt-3 max-w-2xl text-[color:var(--brand-navy)]/80">
            Three stages, one role, one fixed price. The pilot is a one-time engagement available once
            per company. First candidate activity usually begins within 3–5 days after the search goes
            live.
          </p>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {TIMELINE.map((s) => (
              <li
                key={s.n}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-navy)]/5 font-[family-name:var(--brand-font-display)] text-sm font-semibold text-[color:var(--brand-navy)]">
                    {s.n}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand-ocean-text)]">
                    {s.when}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">{s.body}</p>
              </li>
            ))}
          </ol>
        </PublicPage>
      </PublicSection>

      {/* Receive / not included */}
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
                      className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-ocean)]"
                    />
                    {x}
                  </li>
                ))}
              </ul>
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
                      className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-navy)]/25"
                    />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      {/* After the pilot */}
      <PublicSection className="py-8">
        <PublicPage>
          <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
            What happens after the pilot
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {AFTER.map((a) => (
              <div
                key={a.title}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <h3 className="text-lg font-semibold">{a.title}</h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">{a.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-[color:var(--brand-navy)]/80">
            Either way: no placement fees and no salary percentages.{" "}
            <Link
              to="/pricing"
              className="font-semibold text-[color:var(--brand-ocean-text)] underline-offset-4 hover:underline"
            >
              See subscription pricing
            </Link>
          </p>
        </PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow="Next step"
        title={`Start one role for ${PRICE_PILOT_DISPLAY}.`}
        description={PILOT_TIMELINE_LINE}
        primary={{ to: "/intake", label: `Start your first role — ${PRICE_PILOT_DISPLAY}` }}
        secondary={{ to: "/book", label: "Book a 20-minute call" }}
      />
    </SiteShell>
  );
}
