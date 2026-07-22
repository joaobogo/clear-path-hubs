import { createFileRoute, Link } from "@tanstack/react-router";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";
import { PublicPage, PublicSection, CtaSection } from "@/components/marketing/site-shell";

const entry = getPage("employer-onboarding");

export const Route = createFileRoute("/employer-onboarding")({
  head: () =>
    marketingHead(entry, "/employer-onboarding", {
      title: "Employer onboarding — TaaSFlow",
      description:
        "What to expect when you onboard as a TaaSFlow employer: intake, alignment, workspace access, first shortlist, and how our teams work together from day one.",
    }),
  component: EmployerOnboardingPage,
});

const STAGES = [
  {
    n: "01",
    title: "Submit your first role",
    body: "Onboarding begins with the intake. Everything we need to build a search plan is captured in one guided flow — no separate paperwork.",
    cta: { to: "/intake", label: "Start intake" },
  },
  {
    n: "02",
    title: "We create your workspace",
    body: "The moment your intake lands, we provision your organisation, invite the contact you nominated, and prepare the workspace for your team.",
  },
  {
    n: "03",
    title: "Alignment call",
    body: "A short kickoff call with our team confirms the brief, target companies, must-haves, and how you want to run interviews.",
  },
  {
    n: "04",
    title: "Sourcing and evaluation start",
    body: "Sourcing begins immediately after alignment. Every candidate is scored against your rubric and reviewed by a human before publication.",
  },
  {
    n: "05",
    title: "First shortlist in your workspace",
    body: "You see the shortlist in the client workspace: ranked candidates, evidence, CV downloads, and a Kanban pipeline to move them through.",
  },
  {
    n: "06",
    title: "Ongoing collaboration",
    body: "Feedback in the workspace shapes the next round. Our team stays engaged: messaging, scheduling coordination, and additional sourcing until the role closes.",
  },
];

const CHECKLIST = [
  "The role title, seniority, and location or remote policy",
  "A short description of the team and what success looks like",
  "Must-have skills or experience, and any nice-to-haves",
  "Budget range and expected process (rounds, decision-makers)",
  "Primary point of contact for the workspace",
  "Any regulatory or compliance requirements for the role",
];

function EmployerOnboardingPage() {
  return (
    <>
      <PublicSection className="pb-8 pt-16 sm:pt-20">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            Employer onboarding
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            From your first intake to your first shortlist.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/70">
            Onboarding to TaaSFlow is intentionally short. There is one place to start every
            engagement — the intake — and one workspace where the whole team works together from
            the first day.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/intake"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Go to the intake
            </Link>
            <Link
              to="/contact"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
            >
              Talk to us first
            </Link>
          </div>
          <p className="mt-4 text-sm text-[color:var(--brand-navy)]/60">
            This page explains the process. The intake itself lives on{" "}
            <Link to="/intake" className="underline underline-offset-4">/intake</Link> — we
            don’t duplicate the form here so there is only ever one canonical place to start.
          </p>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-8">
        <PublicPage>
          <ol className="grid gap-5 md:grid-cols-2">
            {STAGES.map((s) => (
              <li key={s.n} className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
                <div className="flex items-start gap-4">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-navy)]/5 font-[family-name:var(--brand-font-display)] text-sm font-semibold text-[color:var(--brand-navy)]">
                    {s.n}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold">{s.title}</h3>
                    <p className="mt-1 text-sm text-[color:var(--brand-navy)]/75">{s.body}</p>
                    {s.cta && (
                      <Link
                        to={s.cta.to}
                        className="mt-3 inline-flex items-center text-sm font-semibold text-[color:var(--brand-navy)] underline underline-offset-4"
                      >
                        {s.cta.label} →
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-8">
        <PublicPage>
          <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8">
            <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold">
              What to have ready for the intake
            </h2>
            <p className="mt-2 text-[color:var(--brand-navy)]/70">
              You can start with what you have and save a draft. These are the inputs that make the
              first pass the most accurate.
            </p>
            <ul className="mt-5 grid gap-2 text-sm text-[color:var(--brand-navy)]/80 sm:grid-cols-2">
              {CHECKLIST.map((x) => (
                <li key={x} className="flex gap-2">
                  <span aria-hidden className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-navy)]" />
                  {x}
                </li>
              ))}
            </ul>
          </div>
        </PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow="Ready to onboard"
        title="Submit your first role."
        description="The intake takes a few minutes and creates your workspace automatically."
        primary={{ to: "/intake", label: "Start intake" }}
        secondary={{ to: "/how-it-works", label: "How it works" }}
      />
    </>
  );
}
