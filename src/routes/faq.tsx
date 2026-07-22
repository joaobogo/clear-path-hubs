import { createFileRoute, Link } from "@tanstack/react-router";
import {
  SiteShell,
  PublicPage,
  PublicSection,
  CtaSection,
} from "@/components/marketing/site-shell";
import { marketingHead } from "@/lib/marketing/head";

type QA = { id: string; q: string; a: string };
type Group = { id: string; title: string; items: QA[] };

const GROUPS: Group[] = [
  {
    id: "model",
    title: "The subscription model",
    items: [
      {
        id: "are-you-agency",
        q: "Are you a staffing agency?",
        a: "No. Agencies charge a percentage of first-year salary per hire and disappear between placements. TaaSFlow is a subscription recruiting service: a flat monthly fee, weekly candidate delivery, and a workspace your team owns.",
      },
      {
        id: "placement-fees",
        q: "Do you charge placement fees or salary percentages?",
        a: "No. Pricing is a flat subscription — the same whether you hire one person or ten. No success fees, no salary percentages, no back-end invoices.",
      },
      {
        id: "one-off-vs-subscription",
        q: "What is the difference between one-off recruiting and subscription?",
        a: "One-off recruiting resets every hire: new brief, new agency, new fees. A TaaSFlow subscription is continuous — sourcing, screening, and delivery keep running so pipeline and learnings compound across roles.",
      },
      {
        id: "cancel",
        q: "How do contracts and cancellation work?",
        a: "Month-to-month by default. You can pause or cancel between billing cycles. Annual plans include a discount and can be cancelled at renewal.",
      },
    ],
  },
  {
    id: "delivery",
    title: "Delivery and cadence",
    items: [
      {
        id: "how-fast",
        q: "How fast do you deliver candidates?",
        a: "Most subscriptions produce a first ranked shortlist within one to two weeks of intake, then a rolling weekly delivery of new candidates until the role is closed.",
      },
      {
        id: "what-do-we-get",
        q: "What do we get in a weekly delivery?",
        a: "A ranked shortlist inside your workspace. Each candidate carries an evidence-based score, a recruiter-written fit narrative, strengths and gaps, and a one-click path to shortlist, request an interview, or send feedback.",
      },
      {
        id: "roles-regions",
        q: "What roles and regions do you support?",
        a: "TaaSFlow supports individual contributor and leadership roles across engineering, product, design, data, revenue, operations, and G&A. Sourcing runs globally with active coverage in the Americas, Europe, and the Middle East.",
      },
    ],
  },
  {
    id: "scoring",
    title: "Screening and scoring",
    items: [
      {
        id: "how-scoring-works",
        q: "How does candidate scoring work?",
        a: "Every candidate is scored 0–100 against the exact requirements in your intake. Scores are evidence-first: each requirement is either supported by a citation from the CV, partially met, or missing. You see the evidence, not just a number.",
      },
      {
        id: "customize-scoring",
        q: "Can we customise scoring weights for our role?",
        a: "Yes. Requirements you flag as must-have or dealbreaker are weighted heavier and can cap a candidate's score. Preferred requirements add lift. Everything is set during intake and can be updated as the role evolves.",
      },
      {
        id: "screening-questions",
        q: "Can we add screening questions?",
        a: "Yes. You define role-specific questions during intake — free text, boolean, or multiple choice. Answers are stored with the application and shown alongside the CV evidence.",
      },
    ],
  },
  {
    id: "start",
    title: "Getting started",
    items: [
      {
        id: "what-you-need",
        q: "What do you need from us to begin?",
        a: "An intake session (or the online intake form) covering the role, must-haves, dealbreakers, and hiring context. If you have a job description, share it — otherwise we can build one from the intake.",
      },
      {
        id: "alongside-agencies",
        q: "Can we use TaaSFlow alongside an agency?",
        a: "Yes. Many clients run TaaSFlow next to an existing agency, especially during transition. Because you own the pipeline, there is no conflict on candidates we source.",
      },
      {
        id: "employer-brand",
        q: "How do you protect our employer brand?",
        a: "All outreach is co-branded with your company. Messaging, tone, and role framing are agreed during intake, and any candidate-facing content is reviewed before it goes out.",
      },
    ],
  },
  {
    id: "trust",
    title: "Data and trust",
    items: [
      {
        id: "gdpr",
        q: "How do you handle data privacy and GDPR?",
        a: "Candidate data is stored under explicit consent, retained only as long as needed to run the process, and deleted on request. You can export or purge candidate records from your workspace at any time.",
      },
      {
        id: "pipeline-ownership",
        q: "Do we own the pipeline if we cancel?",
        a: "Yes. Every candidate sourced under your subscription belongs to you — during the subscription and after cancellation. No re-engagement fees to talk to your own candidates.",
      },
    ],
  },
];

const ALL_QA: QA[] = GROUPS.flatMap((g) => g.items);

export const Route = createFileRoute("/faq")({
  head: () => {
    const base = marketingHead(undefined, "/faq", {
      title: "FAQ — how TaaSFlow subscription recruiting works",
      description:
        "Answers to the questions buyers ask before starting a TaaSFlow pilot: pricing, delivery cadence, scoring, screening, data privacy, and cancellation.",
    });
    const faqJsonLd = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: ALL_QA.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    };
    return {
      ...base,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(faqJsonLd),
        },
      ],
    };
  },
  component: FaqPage,
});

function FaqPage() {
  return (
    <SiteShell>
      <PublicSection className="pt-24">
        <PublicPage className="max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-widest text-[color:var(--brand-ocean)]">
            Have questions?
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Frequently asked questions
          </h1>
          <p className="mt-5 text-lg text-[color:var(--brand-navy)]/70">
            Everything buyers ask before starting a TaaSFlow pilot — the model,
            the cadence, the scoring, and how we handle data. Can&apos;t find
            what you need?{" "}
            <Link
              to="/contact"
              className="underline decoration-[color:var(--brand-ocean)] underline-offset-4"
            >
              Contact a hiring lead
            </Link>
            .
          </p>

          <nav aria-label="FAQ topics" className="mt-8">
            <ul className="flex flex-wrap gap-2">
              {GROUPS.map((g) => (
                <li key={g.id}>
                  <a
                    href={`#${g.id}`}
                    className="inline-flex rounded-full border border-[color:var(--brand-navy)]/15 bg-white px-3 py-1.5 text-sm font-medium text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-sky)]/60"
                  >
                    {g.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </PublicPage>
      </PublicSection>

      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 !pt-8">
        <PublicPage className="max-w-3xl">
          <div className="space-y-14">
            {GROUPS.map((group) => (
              <section
                key={group.id}
                id={group.id}
                aria-labelledby={`${group.id}-title`}
                className="scroll-mt-24"
              >
                <h2
                  id={`${group.id}-title`}
                  className="text-2xl font-semibold tracking-tight text-[color:var(--brand-navy)]"
                >
                  {group.title}
                </h2>
                <div className="mt-4 divide-y divide-[color:var(--brand-navy)]/10 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white shadow-sm">
                  {group.items.map((item) => (
                    <details
                      key={item.id}
                      id={item.id}
                      className="group scroll-mt-24 px-5 py-4 open:pb-5"
                    >
                      <summary
                        className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-medium text-[color:var(--brand-navy)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--brand-ocean)]"
                        aria-controls={`${item.id}-body`}
                      >
                        <span>{item.q}</span>
                        <svg
                          aria-hidden
                          viewBox="0 0 24 24"
                          className="h-5 w-5 shrink-0 text-[color:var(--brand-navy)]/60 transition-transform group-open:rotate-180"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 9l6 6 6-6"
                          />
                        </svg>
                      </summary>
                      <div
                        id={`${item.id}-body`}
                        className="mt-3 text-sm leading-relaxed text-[color:var(--brand-navy)]/80"
                      >
                        <p>{item.a}</p>
                        <p className="mt-3">
                          <a
                            href={`#${item.id}`}
                            className="text-xs font-medium uppercase tracking-widest text-[color:var(--brand-ocean)] hover:underline"
                          >
                            Direct link to this question
                          </a>
                        </p>
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow="Still have questions?"
        title="Book a 20-minute intro with a hiring lead."
        description="We'll walk through your roles, hiring volume, and what a pilot would look like — no obligation."
        primary={{ to: "/contact", label: "Contact us" }}
        secondary={{ to: "/intake", label: "Start an intake" }}
      />
    </SiteShell>
  );
}
