import { createFileRoute, Link } from "@tanstack/react-router";
import {
  SiteShell,
  PublicPage,
  PublicSection,
  CtaSection,
} from "@/components/marketing/site-shell";
import { marketingHead } from "@/lib/marketing/head";

export const Route = createFileRoute("/journey")({
  head: () =>
    marketingHead(undefined, "/journey", {
      title: "Candidate journey — from application to hire | TaaSFlow",
      description:
        "See exactly what happens after you apply: how your CV is reviewed, how evidence is captured, and how you stay informed at every stage.",
    }),
  component: JourneyPage,
});

const STEPS = [
  {
    n: "01",
    t: "Apply in minutes",
    d: "Upload your CV, answer a few role-specific questions, and confirm consent. You receive an application reference immediately.",
    signal: "Reference issued",
  },
  {
    n: "02",
    t: "Information reviewed",
    d: "Your CV is parsed and matched against the role. Every match is backed by evidence — no black boxes, no keyword tricks.",
    signal: "Evidence captured",
  },
  {
    n: "03",
    t: "Under consideration",
    d: "A recruiter reviews the evidence and writes a fit narrative. Strong candidates are ranked and delivered to the hiring team.",
    signal: "Fit narrative added",
  },
  {
    n: "04",
    t: "Shortlisted",
    d: "You are on the client's shortlist. We reach out with next steps, expectations, and prep material.",
    signal: "Shortlist confirmed",
  },
  {
    n: "05",
    t: "Interview requested",
    d: "The client requests an interview. You see the format, the interviewers, and what they are looking for.",
    signal: "Interview scheduled",
  },
  {
    n: "06",
    t: "Decision",
    d: "Offer, further round, or a clear no with reasons. Every outcome is recorded in your candidate workspace.",
    signal: "Outcome delivered",
  },
] as const;

const PROMISES = [
  ["Clear status updates", "Real-time updates in your workspace — no wondering where you stand."],
  ["Honest feedback", "If it's a no, you'll know why. No ghosting, no template rejections."],
  ["Your data, your control", "Withdraw consent or delete your profile at any time."],
  ["Direct messaging", "Talk to your recruiter without long email chains."],
] as const;

function JourneyPage() {
  return (
    <SiteShell>
      <PublicSection className="pt-24">
        <PublicPage className="max-w-3xl text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-[color:var(--brand-ocean)]">
            For candidates
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Your journey, in the open.
          </h1>
          <p className="mt-5 text-lg text-[color:var(--brand-navy)]/70">
            Most recruiting is a black box. TaaSFlow shows you exactly where
            you stand — from the day you apply to the final decision.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              to="/jobs"
              className="rounded-md bg-[color:var(--brand-navy)] px-5 py-3 text-sm font-semibold text-white hover:bg-[color:var(--brand-navy-dark)]"
            >
              Browse open roles
            </Link>
            <Link
              to="/auth"
              className="rounded-md border border-[color:var(--brand-navy)]/15 px-5 py-3 text-sm font-semibold hover:bg-[color:var(--brand-sky)]/60"
            >
              Candidate login
            </Link>
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-sky)]/30">
        <PublicPage>
          <p className="text-sm font-medium uppercase tracking-widest text-[color:var(--brand-ocean)]">
            The six stages
          </p>
          <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight">
            What happens between apply and offer
          </h2>

          <ol className="mt-10 relative">
            {/* Vertical timeline rail — hidden on mobile for readability */}
            <div
              aria-hidden
              className="absolute left-6 top-2 hidden h-[calc(100%-1rem)] w-px bg-[color:var(--brand-navy)]/10 sm:block"
            />
            <div className="space-y-4">
              {STEPS.map((s) => (
                <li
                  key={s.n}
                  className="relative rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-5 shadow-sm sm:pl-16"
                >
                  <div
                    className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[color:var(--brand-ocean)] sm:absolute sm:left-0 sm:top-5 sm:mb-0 sm:flex sm:h-12 sm:w-12 sm:items-center sm:justify-center sm:rounded-full sm:border sm:border-[color:var(--brand-navy)]/10 sm:bg-[color:var(--brand-sky)]/60 sm:text-sm"
                  >
                    <span className="sm:sr-only">Step </span>
                    {s.n}
                  </div>
                  <h3 className="text-lg font-semibold text-[color:var(--brand-navy)]">
                    {s.t}
                  </h3>
                  <p className="mt-2 text-sm text-[color:var(--brand-navy)]/75">
                    {s.d}
                  </p>
                  <p className="mt-3 inline-flex items-center rounded-full bg-[color:var(--brand-sky)]/60 px-3 py-1 text-xs font-medium text-[color:var(--brand-navy)]">
                    {s.signal}
                  </p>
                </li>
              ))}
            </div>
          </ol>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to="/jobs"
              className="rounded-md bg-[color:var(--brand-navy)] px-5 py-3 text-sm font-semibold text-white hover:bg-[color:var(--brand-navy-dark)]"
            >
              See open roles
            </Link>
            <Link
              to="/faq"
              className="rounded-md border border-[color:var(--brand-navy)]/15 px-5 py-3 text-sm font-semibold hover:bg-[color:var(--brand-sky)]/60"
            >
              Read the FAQ
            </Link>
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="border-t border-[color:var(--brand-navy)]/10">
        <PublicPage>
          <p className="text-sm font-medium uppercase tracking-widest text-[color:var(--brand-ocean)]">
            What you can expect
          </p>
          <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight">
            Four promises we make to every applicant
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {PROMISES.map(([t, d]) => (
              <div
                key={t}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 shadow-sm"
              >
                <h3 className="font-semibold text-[color:var(--brand-navy)]">
                  {t}
                </h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/75">
                  {d}
                </p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow="Ready to apply"
        title="Find a role that fits."
        description="Browse open positions or create a candidate profile so we can match you as new roles open."
        primary={{ to: "/jobs", label: "Browse jobs" }}
        secondary={{ to: "/auth", label: "Create profile" }}
      />
    </SiteShell>
  );
}
