import { createFileRoute, Link } from "@tanstack/react-router";
import {
  SiteShell,
  PublicPage,
  PublicSection,
  CtaSection,
} from "@/components/marketing/site-shell";
import { marketingHead } from "@/lib/marketing/head";

export const Route = createFileRoute("/about")({
  head: () =>
    marketingHead(undefined, "/about", {
      title: "About TaaSFlow — operators rebuilding recruiting",
      description:
        "TaaSFlow was founded by HR and talent leaders who lived the pain of the traditional agency model. We built the subscription recruiting system we always wanted.",
    }),
  component: AboutPage,
});

const PRINCIPLES = [
  {
    title: "Evidence over opinion",
    body: "Every candidate score is backed by CV evidence. If we can't cite it, we don't claim it.",
  },
  {
    title: "Own your pipeline",
    body: "You keep the candidates we source — during and after your subscription. No gatekeeping, no vendor lock-in.",
  },
  {
    title: "Speak plainly",
    body: "Recruiters write fit narratives in plain language. No jargon, no black boxes, no vague summaries.",
  },
  {
    title: "Respect the candidate",
    body: "Applicants get status, feedback, and a real answer — not silence. That is not optional; it's the model.",
  },
];

const WINS = [
  {
    who: "Candidates win",
    body: "Direct access to real roles, transparent status, and honest feedback at every stage.",
  },
  {
    who: "Companies win",
    body: "Ranked shortlists on a predictable cadence, with full pipeline ownership and one dashboard for decisions.",
  },
  {
    who: "The team wins",
    body: "Subscription incentives align us with your long-term outcomes, not one-off placements.",
  },
];

function AboutPage() {
  return (
    <SiteShell>
      <PublicSection className="pt-24">
        <PublicPage className="max-w-3xl text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-[color:var(--brand-ocean)]">
            About TaaSFlow
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            We built the hiring system we always wanted.
          </h1>
          <p className="mt-5 text-lg text-[color:var(--brand-navy)]/70">
            After years of watching brilliant teams struggle with a broken
            recruiting model, we stopped complaining and started building.
            TaaSFlow is a subscription recruiting service — evidence-based,
            transparent, and owned by the client.
          </p>
        </PublicPage>
      </PublicSection>

      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-sky)]/30">
        <PublicPage>
          <div className="grid gap-10 lg:grid-cols-[1.1fr_.9fr] lg:items-start">
            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-[color:var(--brand-ocean)]">
                Our story
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                From HR frustration to a repeatable recruiting system
              </h2>
              <div className="mt-5 space-y-4 text-[color:var(--brand-navy)]/80">
                <p>
                  TaaSFlow was founded by HR and talent acquisition leaders who
                  lived every pain point people teams face: overloaded
                  recruiters, agencies charging placement fees with little
                  accountability, tools that create more work than they solve,
                  and hiring managers waiting months for a shortlist.
                </p>
                <p>
                  We knew the talent function deserved better. So we built
                  TaaSFlow as the recruiting arm your HR team always wanted —
                  a subscription-based partner with structured sourcing,
                  evidence-first screening, and a candidate delivery cadence
                  you can plan around. No placement fees. No long contracts.
                </p>
                <p>
                  Think of us as your on-demand recruiting department: we
                  plug into your existing HR workflow, align with your hiring
                  managers, and deliver pre-screened, scored candidates on a
                  schedule. Your people team stays in control.
                </p>
              </div>
            </div>
            <aside className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-medium uppercase tracking-widest text-[color:var(--brand-ocean)]">
                What we do
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-[color:var(--brand-navy)]/80">
                <li>
                  <span className="font-semibold text-[color:var(--brand-navy)]">Sourcing</span> across job boards,
                  referrals, and outbound — mapped to your role.
                </li>
                <li>
                  <span className="font-semibold text-[color:var(--brand-navy)]">Structured screening</span> with
                  role-specific screening questions.
                </li>
                <li>
                  <span className="font-semibold text-[color:var(--brand-navy)]">Evidence-based scoring</span> with
                  citations from the candidate&apos;s CV.
                </li>
                <li>
                  <span className="font-semibold text-[color:var(--brand-navy)]">Ranked delivery</span> into a
                  workspace your team can review together.
                </li>
              </ul>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/journey"
                  className="rounded-md border border-[color:var(--brand-navy)]/15 px-4 py-2 text-sm font-semibold hover:bg-[color:var(--brand-sky)]/60"
                >
                  See the journey
                </Link>
                <Link
                  to="/how-it-works"
                  className="rounded-md border border-[color:var(--brand-navy)]/15 px-4 py-2 text-sm font-semibold hover:bg-[color:var(--brand-sky)]/60"
                >
                  How it works
                </Link>
              </div>
            </aside>
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="border-t border-[color:var(--brand-navy)]/10">
        <PublicPage>
          <p className="text-sm font-medium uppercase tracking-widest text-[color:var(--brand-ocean)]">
            How we operate
          </p>
          <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight">
            Principles we build every product decision on
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {PRINCIPLES.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 shadow-sm"
              >
                <h3 className="text-lg font-semibold text-[color:var(--brand-navy)]">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/75">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-sky)]/30">
        <PublicPage>
          <p className="text-sm font-medium uppercase tracking-widest text-[color:var(--brand-ocean)]">
            Our philosophy
          </p>
          <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight">
            The win–win–win mentality
          </h2>
          <p className="mt-3 max-w-2xl text-[color:var(--brand-navy)]/75">
            Great hiring happens when everyone benefits. Our model is built so
            that candidates, companies, and the TaaSFlow team all succeed
            together.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {WINS.map((w) => (
              <div
                key={w.who}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 shadow-sm"
              >
                <h3 className="text-base font-semibold text-[color:var(--brand-navy)]">
                  {w.who}
                </h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/75">
                  {w.body}
                </p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="border-t border-[color:var(--brand-navy)]/10">
        <PublicPage className="max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-widest text-[color:var(--brand-ocean)]">
            Get in touch
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            Talk to a hiring lead
          </h2>
          <p className="mt-3 text-[color:var(--brand-navy)]/75">
            The fastest way to understand TaaSFlow is to walk through a real
            role. Share what you&apos;re hiring for and we&apos;ll show you what a
            shortlist would look like.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/contact"
              className="rounded-md bg-[color:var(--brand-navy)] px-5 py-3 text-sm font-semibold text-white hover:bg-[color:var(--brand-navy-dark)]"
            >
              Contact us
            </Link>
            <Link
              to="/intake"
              className="rounded-md border border-[color:var(--brand-navy)]/15 px-5 py-3 text-sm font-semibold hover:bg-[color:var(--brand-sky)]/60"
            >
              Start an intake
            </Link>
          </div>
        </PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow="Ready when you are"
        title="Give your hiring the system it deserves."
        description="Subscription recruiting, evidence-based scoring, and a workspace built for decisions — not spreadsheets."
      />
    </SiteShell>
  );
}
