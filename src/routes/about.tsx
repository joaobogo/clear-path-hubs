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

// Migrated: "From a broken model to a hiring throughput system" — 6 phases.
const JOURNEY = [
  {
    n: "01",
    label: "The problem",
    title: "The old model is broken",
    body: "Agencies, job boards, and RPO struggle at scale. Cost, speed, and quality fall apart under volume.",
  },
  {
    n: "02",
    label: "The idea",
    title: "Why TaaSFlow exists",
    body: "A subscription-based hiring system designed to replace fragmented labour with a single throughput engine.",
  },
  {
    n: "03",
    label: "The model",
    title: "Talent-as-a-Service, not agency",
    body: "Flat fees. Client-owned pipeline. Global multi-channel sourcing. Human-first, AI-assisted screening.",
  },
  {
    n: "04",
    label: "The process",
    title: "A faster, transparent delivery",
    body: "Intake → sourcing → scoring → shortlist → hire. A repeatable flow with weekly feedback loops.",
  },
  {
    n: "05",
    label: "The platform",
    title: "Built for hiring throughput",
    body: "One workspace for sourcing, scoring, ranking, and decision-making — designed for HR, hiring managers, and finance.",
  },
  {
    n: "06",
    label: "The outcome",
    title: "A better model for everyone",
    body: "Speed, cost, control, quality, and candidate experience — aligned across HR, CFO, procurement, and candidates.",
  },
];

// Migrated: "Recruiting Across 50+ Countries" — regions kept, unverified per-region volumes REMOVED (see about-parity.md).
const REGIONS = [
  { name: "Middle East", hub: "Dubai", note: "Visa support for UAE markets." },
  { name: "Europe", hub: "London", note: "Strong fintech & SaaS coverage." },
  { name: "North America", hub: "New York", note: "H-1B & visa-sponsored placements." },
  { name: "South America", hub: "São Paulo", note: "Growing remote talent hub." },
  { name: "Asia Pacific", hub: "Singapore", note: "Tech & engineering specialisation." },
  { name: "Africa", hub: "Nairobi", note: "Emerging market expertise." },
];

// Migrated: "Meet the Founders" — names, roles, quotes retained (approved company info).
// Founder headshots omitted (source hotlinked taasflow.com images; will rehost once brand pack lands).
const FOUNDERS = [
  {
    name: "Christian Brogger",
    role: "Co-founder & CEO",
    quote: "Great hiring starts with great process. We just made it repeatable.",
    bio: "Two decades designing and driving value creation across Fortune 500s and private equity, with a career focus on turning ambiguous strategy into repeatable operating systems.",
    initials: "CB",
  },
  {
    name: "João Bogo",
    role: "Co-founder",
    quote: "Recruiting deserves the same rigour we apply to product and finance.",
    bio: "Talent acquisition operator who has built and led global sourcing teams across five continents, bringing frontline recruiting discipline into the platform.",
    initials: "JB",
  },
];

// Migrated: "From Startups to Enterprises" — tiered segments.
const SEGMENTS = [
  {
    tier: "Startups & scale-ups",
    body: "Founder-led hiring that needs weekly candidate flow without adding a full recruiter to the team.",
  },
  {
    tier: "Mid-market companies",
    body: "Talent teams that need extra capacity for one or many roles without agency retainers or long contracts.",
  },
  {
    tier: "Enterprise organisations",
    body: "TA leaders who want a subscription partner that integrates into existing ATS and hiring workflows.",
  },
];

// Migrated: "How we think" — six operating traits (destination "Principles" plus these).
const OPERATING_TRAITS = [
  { title: "Systematic", body: "Every role runs through the same intake, sourcing, scoring, and delivery flow." },
  { title: "Global", body: "Sourcing spans six continents; delivery is scheduled around your team's timezone." },
  { title: "Data-driven", body: "Decisions are backed by structured evidence, not gut feel or resume vibes." },
  { title: "Iterative", body: "Weekly feedback loops sharpen the search plan and the shortlist over time." },
  { title: "Transparent", body: "You and the recruiter see the same workspace — status, evidence, and next steps." },
  { title: "Fast", body: "Structured hand-offs remove the delays that make traditional hiring feel stuck." },
];

function AboutPage() {
  return (
    <SiteShell>
      {/* Hero */}
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
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/journey"
              className="inline-flex min-h-11 items-center rounded-md bg-[color:var(--brand-navy)] px-5 py-3 text-sm font-semibold text-white hover:bg-[color:var(--brand-navy-dark)]"
            >
              See the journey
            </Link>
            <Link
              to="/pilot"
              className="inline-flex min-h-11 items-center rounded-md border border-[color:var(--brand-navy)]/15 px-5 py-3 text-sm font-semibold hover:bg-[color:var(--brand-sky)]/60"
            >
              Explore the 2-week pilot
            </Link>
          </div>
        </PublicPage>
      </PublicSection>

      {/* Our Story */}
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
                  Think of us as your on-demand recruiting department: we plug
                  into your existing HR workflow, align with your hiring
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
                  className="inline-flex min-h-11 items-center rounded-md border border-[color:var(--brand-navy)]/15 px-4 py-2 text-sm font-semibold hover:bg-[color:var(--brand-sky)]/60"
                >
                  See the journey
                </Link>
                <Link
                  to="/how-it-works"
                  className="inline-flex min-h-11 items-center rounded-md border border-[color:var(--brand-navy)]/15 px-4 py-2 text-sm font-semibold hover:bg-[color:var(--brand-sky)]/60"
                >
                  How it works
                </Link>
              </div>
            </aside>
          </div>
        </PublicPage>
      </PublicSection>

      {/* Journey — 6 phases */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10">
        <PublicPage>
          <p className="text-sm font-medium uppercase tracking-widest text-[color:var(--brand-ocean)]">
            Journey
          </p>
          <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight">
            From a broken model to a hiring throughput system
          </h2>
          <p className="mt-3 max-w-2xl text-[color:var(--brand-navy)]/75">
            The full story of why we exist, how we deliver, and why TaaSFlow is
            a platform — not another agency.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {JOURNEY.map((j) => (
              <div
                key={j.n}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded-md bg-[color:var(--brand-sky)]/60 px-2 py-1 text-xs font-semibold text-[color:var(--brand-navy)]">
                    {j.n}
                  </span>
                  <span className="text-xs font-medium uppercase tracking-widest text-[color:var(--brand-ocean)]">
                    {j.label}
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-[color:var(--brand-navy)]">
                  {j.title}
                </h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/75">
                  {j.body}
                </p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* How we operate — principles */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-sky)]/30">
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

      {/* Win-Win-Win */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10">
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

      {/* Global presence — regions retained, unverified per-region volumes removed */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-sky)]/30">
        <PublicPage>
          <p className="text-sm font-medium uppercase tracking-widest text-[color:var(--brand-ocean)]">
            Global presence
          </p>
          <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight">
            Recruiting across every major hiring region
          </h2>
          <p className="mt-3 max-w-2xl text-[color:var(--brand-navy)]/75">
            From Silicon Valley to Dubai, São Paulo to Singapore — we source
            talent wherever it lives. Specific per-region volumes are reported
            to clients under their engagement, not pre-published.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {REGIONS.map((r) => (
              <div
                key={r.name}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 shadow-sm"
              >
                <h3 className="text-base font-semibold text-[color:var(--brand-navy)]">
                  {r.name}
                </h3>
                <p className="mt-1 text-xs font-medium uppercase tracking-widest text-[color:var(--brand-ocean)]">
                  Key hub · {r.hub}
                </p>
                <p className="mt-3 text-sm text-[color:var(--brand-navy)]/75">
                  {r.note}
                </p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* Founders */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10">
        <PublicPage>
          <p className="text-sm font-medium uppercase tracking-widest text-[color:var(--brand-ocean)]">
            Leadership
          </p>
          <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight">
            Meet the founders
          </h2>
          <p className="mt-3 max-w-2xl text-[color:var(--brand-navy)]/75">
            Built careers advising global enterprises. Now applying that same
            rigour to the world of hiring.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {FOUNDERS.map((f) => (
              <div
                key={f.name}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div
                    aria-hidden="true"
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--brand-navy)] text-lg font-semibold text-white"
                  >
                    {f.initials}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[color:var(--brand-navy)]">
                      {f.name}
                    </h3>
                    <p className="text-sm text-[color:var(--brand-navy)]/70">
                      {f.role}
                    </p>
                  </div>
                </div>
                <blockquote className="mt-4 border-l-2 border-[color:var(--brand-ocean)] pl-4 text-sm italic text-[color:var(--brand-navy)]/80">
                  “{f.quote}”
                </blockquote>
                <p className="mt-4 text-sm text-[color:var(--brand-navy)]/75">
                  {f.bio}
                </p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* Startups → Enterprises */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-sky)]/30">
        <PublicPage>
          <p className="text-sm font-medium uppercase tracking-widest text-[color:var(--brand-ocean)]">
            Who we partner with
          </p>
          <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight">
            From startups to enterprises
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {SEGMENTS.map((s) => (
              <div
                key={s.tier}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 shadow-sm"
              >
                <h3 className="text-base font-semibold text-[color:var(--brand-navy)]">
                  {s.tier}
                </h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/75">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* How we think — operating traits */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10">
        <PublicPage>
          <p className="text-sm font-medium uppercase tracking-widest text-[color:var(--brand-ocean)]">
            How we think
          </p>
          <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight">
            Six traits that shape every engagement
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {OPERATING_TRAITS.map((t) => (
              <div
                key={t.title}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 shadow-sm"
              >
                <h3 className="text-base font-semibold text-[color:var(--brand-navy)]">
                  {t.title}
                </h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/75">
                  {t.body}
                </p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* Get in touch */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-sky)]/30">
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
              className="inline-flex min-h-11 items-center rounded-md bg-[color:var(--brand-navy)] px-5 py-3 text-sm font-semibold text-white hover:bg-[color:var(--brand-navy-dark)]"
            >
              Contact us
            </Link>
            <Link
              to="/intake"
              className="inline-flex min-h-11 items-center rounded-md border border-[color:var(--brand-navy)]/15 px-5 py-3 text-sm font-semibold hover:bg-[color:var(--brand-sky)]/60"
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
