import { createFileRoute, Link } from "@tanstack/react-router";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";
import { SiteShell, PublicPage, PublicSection, CtaSection } from "@/components/marketing/site-shell";

const entry = getPage("how-it-works");

export const Route = createFileRoute("/how-it-works")({
  head: () =>
    marketingHead(entry, "/how-it-works", {
      title: "How it works — TaaSFlow",
      description:
        "Six repeatable steps: submit the role, we build the search, source and evaluate, deliver ranked candidates, you review and advance, and we support the process through hire.",
    }),
  component: HowItWorksPage,
});

const STEPS = [
  {
    n: "01",
    title: "You submit the role",
    body: "Complete a guided intake covering the role, must-have and nice-to-have requirements, hiring context, budget and process. Everything a search needs, captured once.",
    signals: ["Guided intake wizard", "Draft auto-save", "Ownership of the brief stays with your team"],
  },
  {
    n: "02",
    title: "TaaSFlow builds the search",
    body: "Our team turns the intake into a structured search plan: target companies, seniority bands, geographies, screening questions, and a scoring rubric tuned to your must-haves.",
    signals: ["Role-specific scoring rubric", "Search plan reviewed with you before launch", "Screening questions tailored to the brief"],
  },
  {
    n: "03",
    title: "Candidates are sourced and evaluated",
    body: "We source from multiple channels, review every CV against your rubric, extract evidence directly from the CV, and record fit scores with explanations.",
    signals: ["Evidence-first scoring", "Explanations tied to CV quotes", "Manual review before publication"],
  },
  {
    n: "04",
    title: "Ranked candidates enter your workspace",
    body: "Only candidates that pass evidence review are published to your workspace. You see the shortlist ranked, with scores, evidence, and CV downloads.",
    signals: ["Published candidates only", "Scores and evidence side-by-side", "One-click CV download"],
  },
  {
    n: "05",
    title: "Client reviews and advances candidates",
    body: "Move candidates through a Kanban pipeline: review, interview, offer, hired, or rejected. Every stage change is tracked and time-stamped.",
    signals: ["Kanban with stage validation", "Direct messaging with our team", "Full audit trail per candidate"],
  },
  {
    n: "06",
    title: "TaaSFlow supports the process through hire",
    body: "We stay engaged: scheduling coordination, feedback loops, and additional sourcing rounds until the role closes. Nothing hands off in the middle.",
    signals: ["Live messaging in the workspace", "Iterative sourcing on feedback", "One accountable team end-to-end"],
  },
];

function HowItWorksPage() {
  return (
    <SiteShell>
      <PublicSection className="pb-8 pt-16 sm:pt-20">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            How it works
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            One repeatable operating system, from brief to hire.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/70">
            TaaSFlow is a single workflow shared by your team and ours. The same brief, the same
            scoring, the same workspace — from the first intake through to signed offer.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/intake"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Start a role
            </Link>
            <Link
              to="/contact"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
            >
              Talk to us
            </Link>
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="pt-4">
        <PublicPage>
          <ol className="space-y-6">
            {STEPS.map((s) => (
              <li
                key={s.n}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8"
              >
                <div className="flex items-start gap-6">
                  <div className="hidden shrink-0 sm:block">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--brand-navy)] font-[family-name:var(--brand-font-display)] text-lg font-semibold text-white">
                      {s.n}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/50 sm:hidden">
                      Step {s.n}
                    </p>
                    <h2 className="mt-1 font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight sm:mt-0">
                      {s.title}
                    </h2>
                    <p className="mt-3 text-[color:var(--brand-navy)]/75">{s.body}</p>
                    <ul className="mt-4 flex flex-wrap gap-2">
                      {s.signals.map((sig) => (
                        <li
                          key={sig}
                          className="rounded-full bg-[color:var(--brand-navy)]/5 px-3 py-1 text-xs font-medium text-[color:var(--brand-navy)]/80"
                        >
                          {sig}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow="Ready when you are"
        title="Submit your first role."
        description="The intake takes a few minutes. Draft saving is on — you can return anytime."
        primary={{ to: "/intake", label: "Start hiring" }}
        secondary={{ to: "/pricing", label: "See pricing model" }}
      />
    </SiteShell>
  );
}
