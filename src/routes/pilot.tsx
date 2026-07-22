import { createFileRoute, Link } from "@tanstack/react-router";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";
import { PublicPage, PublicSection, CtaSection } from "@/components/marketing/site-shell";

const entry = getPage("pilot");

export const Route = createFileRoute("/pilot")({
  head: () =>
    marketingHead(entry, "/pilot", {
      title: "Run a pilot — TaaSFlow",
      description:
        "A single-role pilot to experience TaaSFlow end-to-end: guided intake, evidence-based scoring, ranked candidates in your workspace, and direct support from our team.",
    }),
  component: PilotPage,
});

const INCLUDED = [
  "One active role, fully scoped with our team",
  "Structured intake and search plan",
  "Multi-channel sourcing",
  "Role-specific, evidence-based scoring",
  "Ranked candidate shortlist in your workspace",
  "Kanban pipeline with stage validation",
  "Direct messaging with the recruiting team",
  "CV downloads and full candidate profiles",
];

const PROCESS = [
  { n: "01", title: "Submit the role", body: "Complete the guided intake. Draft saving lets you return without losing progress." },
  { n: "02", title: "Alignment call", body: "A short call with our team to confirm the search plan, must-haves, and success signals." },
  { n: "03", title: "Sourcing and evaluation", body: "We source across channels, evaluate against your rubric, and extract evidence from each CV." },
  { n: "04", title: "Ranked shortlist", body: "Only reviewed, evidence-backed candidates are published to your workspace." },
  { n: "05", title: "You review and advance", body: "Move candidates through the pipeline, message our team, and give feedback that shapes the next round." },
];

function PilotPage() {
  return (
    <>
      <PublicSection className="pb-8 pt-16 sm:pt-20">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            Pilot
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            Run one role end-to-end and see how it feels.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/70">
            The pilot is a single-role engagement that walks through every stage of the TaaSFlow
            operating system — from intake to hire — so you can evaluate the workspace, the
            evidence, and the team on real work.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/intake"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Start the pilot intake
            </Link>
            <Link
              to="/contact"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
            >
              Ask a question
            </Link>
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-8">
        <PublicPage>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8">
              <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold">
                What is included
              </h2>
              <ul className="mt-4 space-y-2 text-sm text-[color:var(--brand-navy)]/80">
                {INCLUDED.map((x) => (
                  <li key={x} className="flex gap-2">
                    <span aria-hidden className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-navy)]" />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8">
              <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold">
                What you receive
              </h2>
              <ul className="mt-4 space-y-3 text-sm text-[color:var(--brand-navy)]/80">
                <li><strong className="text-[color:var(--brand-navy)]">A workspace</strong> — your own client workspace with the role, pipeline and messages.</li>
                <li><strong className="text-[color:var(--brand-navy)]">Ranked candidates</strong> — a shortlist of reviewed, scored, evidence-backed profiles.</li>
                <li><strong className="text-[color:var(--brand-navy)]">Evidence per candidate</strong> — scoring tied to CV quotes and structured signals.</li>
                <li><strong className="text-[color:var(--brand-navy)]">A working process</strong> — everything you need to run interviews and make decisions with confidence.</li>
              </ul>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-8">
        <PublicPage>
          <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
            Expected process
          </h2>
          <ol className="mt-6 space-y-4">
            {PROCESS.map((s) => (
              <li key={s.n} className="rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-navy)]/5 font-[family-name:var(--brand-font-display)] text-sm font-semibold text-[color:var(--brand-navy)]">
                    {s.n}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold">{s.title}</h3>
                    <p className="mt-1 text-sm text-[color:var(--brand-navy)]/70">{s.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow="Next step"
        title="Submit a role to start your pilot."
        description="The intake walks through every question we need. We reply to schedule alignment."
        primary={{ to: "/intake", label: "Start intake" }}
        secondary={{ to: "/how-it-works", label: "See the process" }}
      />
    </>
  );
}
