import { createFileRoute, Link } from "@tanstack/react-router";
import {
  SiteShell,
  PublicPage,
  PublicSection,
  CtaSection,
} from "@/components/marketing/site-shell";
import { marketingHead } from "@/lib/marketing/head";
import { CTA_BOOK, CTA_HOW_IT_WORKS, CTA_PRIMARY } from "@/config/cta";
import {
  FIRST_SHORTLIST_TIMING,
  PROCESS_STEPS,
  PROCESS_STEP_COUNT,
  SEATS_NOTE,
  TIMING_FINE_PRINT,
  WHO_RUNS_THE_SEARCH,
} from "@/config/offer-facts";
import { INTAKE_STEPS, INTAKE_TOTAL_MINUTES } from "@/lib/express-intake-schema";
import { OnboardingPreview } from "@/components/marketing/product-preview/onboarding-preview";

export const Route = createFileRoute("/employer-onboarding")({
  head: () =>
    marketingHead(undefined, "/employer-onboarding", {
      title: "Employer onboarding — what to expect | TaaSFlow",
      description:
        "What happens after you share a role with TaaSFlow: the intake, plan approval, sourcing and screening, and your first ranked shortlist.",
    }),
  component: EmployerOnboardingPage,
});

const EXPECT = [
  {
    title: "A guided intake, not a form graveyard",
    body: `A structured ${INTAKE_STEPS.length}-step intake, about ${INTAKE_TOTAL_MINUTES} minutes, captures the role, requirements and hiring context. Draft saving is on throughout.`,
  },
  {
    title: "A workspace per requisition",
    body: "Every role you submit gets its own workspace with a rubric, evidence panel, ranked shortlist and audit trail. One shared surface, no private inboxes.",
  },
  {
    title: "A predictable cadence",
    body: `${FIRST_SHORTLIST_TIMING} You can see where every candidate is in the process.`,
  },
];

// The same four steps used everywhere on the site (PROCESS_STEPS). The detail
// line adds what onboarding means at each step.
const STEP_DETAIL: readonly string[] = [
  `Complete the ${INTAKE_STEPS.length}-step intake, about ${INTAKE_TOTAL_MINUTES} minutes. Draft saving means you can pause and resume, and every field is tied to how candidates are scored later.`,
  "We turn the intake into a role-specific scoring rubric and share it back for confirmation. Nothing goes into scoring until you approve it. Your workspace opens with the role, the rubric and messaging enabled. " + SEATS_NOTE,
  "Agents source candidates, each application is parsed and evidence is extracted, and the rubric is applied. A recruiter reviews the results before anyone reaches your shortlist.",
  `You receive the first ranked shortlist in the workspace, with evidence attached to every score. ${FIRST_SHORTLIST_TIMING} Advance, hold or pass with a reason.`,
];

const STEPS = PROCESS_STEPS.map((step, i) => ({
  n: `0${i + 1}`,
  title: step.title,
  body: STEP_DETAIL[i] ?? step.body,
}));

const PREPARE = [
  {
    title: "Role clarity",
    body: "Draft the responsibilities, must-haves and nice-to-haves. The intake will structure them, but rough notes speed the first pass.",
  },
  {
    title: "Compensation range",
    body: "An approved range for the role. This becomes a first-class filter and is shared with candidates at the right stage.",
  },
  {
    title: "Hiring team",
    body: "Names and emails of the reviewers, interviewers and decision maker. They will be invited into the workspace.",
  },
  {
    title: "Interview loop outline",
    body: "The stages, who owns each, and roughly how long. We map the workflow to those stages.",
  },
  {
    title: "Screening questions",
    body: "Up to a handful of role-specific questions. Optional — we can propose a set from the rubric if you prefer.",
  },
  {
    title: "Context on constraints",
    body: "Location model, visa policy, start-date flexibility, tooling. Anything that would disqualify late is better captured upfront.",
  },
];

const WE_DO = [
  "Build the role-specific scoring rubric from your intake",
  "Run sourcing and inbound triage",
  "Parse every CV and extract structured evidence",
  "Score candidates against the rubric, with a recruiter reviewing the results",
  "Publish a ranked shortlist with citations attached",
  "Recalibrate the rubric when you give feedback",
];

const CLIENT_DO = [
  "Confirm the rubric before scoring starts",
  "Review ranked shortlists in the workspace",
  "Advance, hold or pass with a reason on each candidate",
  "Own scheduling and running the interview loop",
  "Give feedback on each shortlist",
  "Make the final hiring decision",
];

function EmployerOnboardingPage() {
  return (
    <SiteShell>
      {/* Hero */}
      <PublicSection className="pt-24">
        <PublicPage className="max-w-4xl">
          <p className="text-sm font-medium uppercase tracking-widest text-[color:var(--brand-ocean-text)]">
            Employer onboarding
          </p>
          <h1 className="mt-3 font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Here is exactly what happens after you start.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[color:var(--brand-navy)]/80">
            No mystery. From intake to first ranked shortlist, TaaSFlow gives
            you a predictable path and a workspace you and your team share
            with your TaaSFlow recruiter. {WHO_RUNS_THE_SEARCH}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to={CTA_PRIMARY.to}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--brand-navy)]/90"
            >
              {CTA_PRIMARY.label}
            </Link>
            <Link
              to={CTA_HOW_IT_WORKS.to}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
            >
              {CTA_HOW_IT_WORKS.label}
            </Link>
          </div>

          <div className="mt-12 max-w-2xl">
            <OnboardingPreview />
          </div>
        </PublicPage>
      </PublicSection>

      {/* What to expect */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 py-16">
        <PublicPage>
          <h2 className="max-w-2xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
            What to expect
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {EXPECT.map((e) => (
              <div
                key={e.title}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <h3 className="text-lg font-semibold text-[color:var(--brand-navy)]">
                  {e.title}
                </h3>
                <p className="mt-3 text-sm text-[color:var(--brand-navy)]/80">
                  {e.body}
                </p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* Step-by-step journey */}
      <PublicSection>
        <PublicPage>
          <h2 className="max-w-2xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
            Step-by-step onboarding journey
          </h2>
          <p className="mt-3 max-w-2xl text-[color:var(--brand-navy)]/80">
            {PROCESS_STEP_COUNT} steps from your first message to your first shortlist.
            {" "}{TIMING_FINE_PRINT}
          </p>
          <ol className="mt-10 grid gap-5 md:grid-cols-2">
            {STEPS.map((s) => (
              <li
                key={s.n}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <div className="flex items-start gap-4">
                  <span className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold text-[color:var(--brand-ocean-text)]">
                    {s.n}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-[color:var(--brand-navy)]">
                      {s.title}
                    </h3>
                    <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">
                      {s.body}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </PublicPage>
      </PublicSection>

      {/* Prepare */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40">
        <PublicPage>
          <h2 className="max-w-2xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
            What to prepare before you start
          </h2>
          <p className="mt-3 max-w-2xl text-[color:var(--brand-navy)]/80">
            None of this is mandatory upfront — the intake will guide you.
            Having it ready just makes the first pass quicker.
          </p>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {PREPARE.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <h3 className="text-base font-semibold text-[color:var(--brand-navy)]">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* Split of responsibilities */}
      <PublicSection>
        <PublicPage>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-navy)] p-8 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                What TaaSFlow does
              </p>
              <h3 className="mt-2 font-[family-name:var(--brand-font-display)] text-2xl font-semibold">
                We run the search
              </h3>
              <ul className="mt-6 space-y-3 text-sm text-white/85">
                {WE_DO.map((t) => (
                  <li key={t} className="flex gap-2">
                    <span className="text-[color:var(--brand-ocean-text)]">·</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
                What the client does
              </p>
              <h3 className="mt-2 font-[family-name:var(--brand-font-display)] text-2xl font-semibold text-[color:var(--brand-navy)]">
                You keep the decisions
              </h3>
              <ul className="mt-6 space-y-3 text-sm text-[color:var(--brand-navy)]/80">
                {CLIENT_DO.map((t) => (
                  <li key={t} className="flex gap-2">
                    <span className="text-[color:var(--brand-ocean-text)]">·</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      {/* Workspace access + first delivery */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40">
        <PublicPage>
          <div className="grid gap-10 md:grid-cols-2 md:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
                Workspace access
              </p>
              <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
                Your team, in the workspace from day one
              </h2>
              <p className="mt-4 text-[color:var(--brand-navy)]/80">
                As soon as the requisition is created, your account is
                provisioned and you can invite your hiring team. {SEATS_NOTE} Access is scoped to your organisation, and
                accounts are isolated from each other.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-[color:var(--brand-navy)]/80">
                <li>· One workspace per requisition</li>
                <li>· Role-based access for your team</li>
                <li>· Direct messaging with your recruiter</li>
                <li>· Audit trail on every action</li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
                First candidate delivery
              </p>
              <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
                Your first ranked shortlist
              </h2>
              <p className="mt-4 text-[color:var(--brand-navy)]/80">
                A recruiter reviews the first shortlist before you see it.
                Every candidate is ranked, and every score has evidence
                citations from the CV.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-[color:var(--brand-navy)]/80">
                <li>· Ranked list against the confirmed rubric</li>
                <li>· Evidence panel per candidate</li>
                <li>· Fit summary reviewed by a recruiter</li>
                <li>· One-click advance, hold or pass with reason</li>
              </ul>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      {/* Final CTA */}
      <CtaSection
        eyebrow="Ready to onboard"
        title="Share your first role."
        description="Request the pilot for one role, or book a call to talk it through first."
        primary={CTA_PRIMARY}
        secondary={CTA_BOOK}
      />
    </SiteShell>
  );
}
