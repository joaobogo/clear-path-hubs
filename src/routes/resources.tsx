import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  Building2,
  FileText,
  GraduationCap,
  HelpCircle,
  Layers,
  LineChart,
  Lightbulb,
  Users,
  Calculator,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { SiteShell } from "@/components/marketing/site-shell";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";
import { PageConnections } from "@/components/marketing/page-connections";

const entry = getPage("resources");

export const Route = createFileRoute("/resources")({
  head: () =>
    marketingHead(entry, "/resources", {
      title: "Resources — hiring intelligence guides | TaaSFlow",
      description:
        "Hiring guides, industry insights, calculators, case studies and candidate resources — every insight links to its full source.",
    }),
  component: ResourcesPage,
});

type Card = {
  title: string;
  description: string;
  href: string;
  cta: string;
  icon: typeof BookOpen;
};

/* -------- FEATURED RESEARCH (visual insight cards) -------- */

type Insight = {
  eyebrow: string;
  headline: string;
  takeaway: string;
  href: string;
  hrefLabel: string;
  icon: typeof Lightbulb;
};

const FEATURED_RESEARCH: Insight[] = [
  {
    eyebrow: "Recruiting cost",
    headline: "Cost-per-hire compounds across every open role.",
    takeaway:
      "Where the money actually goes: sourcing, screening, agency fees, and internal recruiter time.",
    href: "/blog/reducing-cost-per-hire",
    hrefLabel: "Read the analysis",
    icon: Calculator,
  },
  {
    eyebrow: "Candidate scoring",
    headline: "Evidence beats keyword matching.",
    takeaway:
      "How structured rubrics extract role-specific signal instead of surfacing buzzwords.",
    href: "/blog/ai-screening-ethics",
    hrefLabel: "Read the playbook",
    icon: Sparkles,
  },
  {
    eyebrow: "Time to hire",
    headline: "Where the days actually go.",
    takeaway:
      "The invisible waits — intake, scheduling, decision-making — that stretch hiring cycles.",
    href: "/blog/reducing-time-to-hire-without-sacrificing-quality",
    hrefLabel: "See the breakdown",
    icon: LineChart,
  },
];

/* -------- CHECKLISTS -------- */

type Checklist = {
  title: string;
  items: string[];
  href: string;
  hrefLabel: string;
};

const CHECKLISTS: Checklist[] = [
  {
    title: "Interview quality checklist",
    items: [
      "One rubric per role, agreed before the first interview.",
      "Behavioral evidence tied to specific questions.",
      "Two independent scorers before hire/no-hire.",
      "Debrief within 24 hours.",
    ],
    href: "/blog/behavioral-interview-guide-employers",
    hrefLabel: "See the full guide",
  },
  {
    title: "Candidate experience audit",
    items: [
      "Every applicant gets a response within 7 days.",
      "Reject with a reason, not silence.",
      "Feedback on every interview stage.",
      "Cadence set at intake — not improvised.",
    ],
    href: "/blog/candidate-experience-audit-checklist",
    hrefLabel: "Open the audit",
  },
  {
    title: "Talent-pipeline health",
    items: [
      "Track ratio of active vs passive candidates.",
      "Refresh every 90 days.",
      "Score every pipeline candidate on the same rubric.",
      "Log source and last-touch on every record.",
    ],
    href: "/blog/building-talent-pipeline",
    hrefLabel: "Read the guide",
  },
];

/* -------- BENCHMARK CALLOUTS (qualitative — no fabricated stats) -------- */

type Benchmark = {
  label: string;
  claim: string;
  href: string;
};

const BENCHMARKS: Benchmark[] = [
  {
    label: "Compensation",
    claim: "Salary ranges vary widely across markets, seniorities, and stacks.",
    href: "/blog/salary-trends-2026-comprehensive",
  },
  {
    label: "HR productivity",
    claim: "Recruiter capacity depends on requisition mix, not headcount.",
    href: "/blog/ai-replacing-vs-augmenting-recruiters",
  },
  {
    label: "Industry hiring",
    claim: "Hiring dynamics differ by regulation, sourcing pool, and stack.",
    href: "/industries",
  },
];

/* -------- CALCULATORS & TOOLS -------- */

const CALCULATORS: Card[] = [
  {
    title: "ROI calculator",
    description: "Model cost-per-hire against your current recruiting spend.",
    href: "/pricing#roi-calculator",
    cta: "Run the numbers",
    icon: Calculator,
  },
  {
    title: "Industry explorer",
    description: "Search 57 industries by role, skill, certification or alias.",
    href: "/industries",
    cta: "Open the explorer",
    icon: Layers,
  },
  {
    title: "Employer onboarding walkthrough",
    description: "Every step of first intake to first shortlist, sequenced.",
    href: "/employer-onboarding",
    cta: "See the journey",
    icon: GraduationCap,
  },
];

/* -------- CASE STUDIES / DESTINATIONS -------- */

const CASE_STUDIES: Card[] = [
  {
    title: "Enterprise operating model",
    description:
      "How multi-role hiring programmes run with shared workspace visibility.",
    href: "/enterprise",
    cta: "See the model",
    icon: Building2,
  },
  {
    title: "Staffing partnerships",
    description:
      "How agencies expand delivery capacity behind their own client relationships.",
    href: "/partnerships/staffing",
    cta: "Partnership overview",
    icon: Layers,
  },
  {
    title: "Agency comparison",
    description:
      "How TaaSFlow differs from traditional agency and RPO delivery.",
    href: "/pricing",
    cta: "Read the comparison",
    icon: LineChart,
  },
];

/* -------- CANDIDATE RESOURCES -------- */

const CANDIDATE_RESOURCES: Card[] = [
  {
    title: "Open roles",
    description: "Every position TaaSFlow is actively sourcing right now.",
    href: "/jobs",
    cta: "Browse jobs",
    icon: Users,
  },
  {
    title: "Talent network",
    description: "How candidates stay visible and in control of matching.",
    href: "/talent-network",
    cta: "Learn more",
    icon: Users,
  },
  {
    title: "Knowledge base",
    description: "Reference material for TaaSFlow clients and candidates.",
    href: "/knowledge-base",
    cta: "Open knowledge base",
    icon: FileText,
  },
];

/* -------- HIRING GUIDES -------- */

const HIRING_GUIDES: Card[] = [
  {
    title: "How TaaSFlow works",
    description: "Intake, sourcing, ranked shortlists, workspace, delivery.",
    href: "/how-it-works",
    cta: "Read the guide",
    icon: Lightbulb,
  },
  {
    title: "Blog & playbooks",
    description: "Long-form articles on hiring, evaluation and candidate experience.",
    href: "/blog",
    cta: "Browse articles",
    icon: BookOpen,
  },
  {
    title: "FAQ",
    description: "Delivery, workspace access, pricing, ownership, support.",
    href: "/faq",
    cta: "Read the FAQ",
    icon: HelpCircle,
  },
];

/* ---------- Components ---------- */

function InsightCard({ i }: { i: Insight }) {
  const Icon = i.icon;
  return (
    <article className="group flex flex-col rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 transition hover:border-[color:var(--brand-ocean)]/40 hover:shadow-sm">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color:var(--brand-ocean)]/10 text-[color:var(--brand-ocean-text)]">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--brand-ocean-text)]">
          {i.eyebrow}
        </span>
      </div>
      <h3 className="mt-4 text-lg font-semibold leading-snug text-[color:var(--brand-navy)]">
        {i.headline}
      </h3>
      <p className="mt-2 flex-1 text-sm text-[color:var(--brand-navy)]/80">
        {i.takeaway}
      </p>
      <Link
        to={i.href}
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--brand-ocean-text)] hover:text-[color:var(--brand-navy)]"
      >
        {i.hrefLabel}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </article>
  );
}

function ChecklistCard({ c }: { c: Checklist }) {
  return (
    <article className="flex flex-col rounded-2xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 p-6">
      <h3 className="text-base font-semibold text-[color:var(--brand-navy)]">
        {c.title}
      </h3>
      <ul className="mt-4 space-y-2">
        {c.items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2 text-sm text-[color:var(--brand-navy)]/85"
          >
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-ocean-text)]"
              aria-hidden
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <Link
        to={c.href}
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--brand-ocean-text)] hover:underline"
      >
        {c.hrefLabel}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </article>
  );
}

function BenchmarkCard({ b }: { b: Benchmark }) {
  return (
    <Link
      to={b.href}
      className="group flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[color:var(--brand-navy)]/10 bg-white px-4 py-3 transition hover:border-[color:var(--brand-ocean)]/40"
    >
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--brand-ocean-text)]">
          {b.label}
        </div>
        <div className="mt-0.5 text-sm text-[color:var(--brand-navy)]/85">
          {b.claim}
        </div>
      </div>
      <ArrowRight
        className="h-4 w-4 shrink-0 text-[color:var(--brand-navy)]/80 transition group-hover:text-[color:var(--brand-ocean-text)]"
        aria-hidden
      />
    </Link>
  );
}

function CardGrid({ items }: { items: Card[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((r) => {
        const Icon = r.icon;
        return (
          <article
            key={r.title}
            className="flex flex-col rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 transition hover:border-[color:var(--brand-ocean)]/40"
          >
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--brand-ocean)]/10 text-[color:var(--brand-ocean-text)]">
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <h3 className="text-lg font-semibold tracking-tight text-[color:var(--brand-navy)]">
              {r.title}
            </h3>
            <p className="mt-2 flex-1 text-sm text-[color:var(--brand-navy)]/80">
              {r.description}
            </p>
            <Link
              to={r.href}
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--brand-ocean-text)] hover:underline"
            >
              {r.cta} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </article>
        );
      })}
    </div>
  );
}

function Section({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-20 scroll-mt-24">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--brand-ocean-text)]">
          {eyebrow}
        </p>
        <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-3xl">
          {title}
        </h2>
        <p className="mt-2 text-[color:var(--brand-navy)]/80">{description}</p>
      </header>
      <div className="mt-8">{children}</div>
    </section>
  );
}

const COLLECTIONS = [
  { id: "hiring-guides", label: "Hiring Guides" },
  { id: "cost-roi", label: "Cost & ROI" },
  { id: "candidate-evaluation", label: "Candidate Evaluation" },
  { id: "industry-hiring", label: "Industry Hiring" },
  { id: "recruiting-operations", label: "Recruiting Operations" },
  { id: "tools-calculators", label: "Tools & Calculators" },
  { id: "case-studies", label: "Case Studies" },
];

function CollectionsNav() {
  return (
    <nav
      aria-label="Resource collections"
      className="mt-8 flex flex-wrap gap-2 border-y border-[color:var(--brand-navy)]/10 py-4"
    >
      {COLLECTIONS.map((c) => (
        <a
          key={c.id}
          href={`#${c.id}`}
          className="inline-flex items-center rounded-full border border-[color:var(--brand-navy)]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand-navy)]/80 transition hover:border-[color:var(--brand-ocean)]/40 hover:text-[color:var(--brand-ocean-text)]"
        >
          {c.label}
        </a>
      ))}
    </nav>
  );
}

function ResourcesPage() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--brand-ocean-text)]">
            Resources
          </p>
          <h1 className="mt-3 font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            Guides, insights, and tools
          </h1>
          <p className="mt-4 text-lg text-[color:var(--brand-navy)]/80">
            Short, visual, and linked. Every insight leads to a full source
            article, calculator, or industry destination.
          </p>
        </header>

        <CollectionsNav />

        <Section
          id="cost-roi"
          eyebrow="Cost & ROI"
          title="Where hiring costs, quality, and speed collide"
          description="Three insights every talent leader is measured on."
        >
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURED_RESEARCH.map((i) => (
              <InsightCard key={i.headline} i={i} />
            ))}
          </div>
        </Section>

        <Section
          id="candidate-evaluation"
          eyebrow="Candidate evaluation"
          title="Short checklists, full playbooks"
          description="Distilled from long-form articles — click through for the full version."
        >
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CHECKLISTS.map((c) => (
              <ChecklistCard key={c.title} c={c} />
            ))}
          </div>
        </Section>

        <Section
          id="industry-hiring"
          eyebrow="Industry hiring"
          title="Context varies by industry"
          description="No fabricated statistics — every claim links to its source."
        >
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BENCHMARKS.map((b) => (
              <BenchmarkCard key={b.label} b={b} />
            ))}
          </div>
          <div className="mt-6">
            <Link
              to="/industries"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--brand-ocean-text)] hover:underline"
            >
              Open the full industry explorer
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </Section>

        <Section
          id="tools-calculators"
          eyebrow="Tools & calculators"
          title="Model your own numbers"
          description="Interactive tools you can use right now."
        >
          <CardGrid items={CALCULATORS} />
        </Section>

        <Section
          id="case-studies"
          eyebrow="Case studies"
          title="How different teams work with TaaSFlow"
          description="Enterprise programmes, agency partnerships, and traditional-agency comparison."
        >
          <CardGrid items={CASE_STUDIES} />
        </Section>

        <Section
          id="recruiting-operations"
          eyebrow="Recruiting operations"
          title="Operating rhythm for talent leaders"
          description="Reference material for how engagements start, run, and get reviewed."
        >
          <CardGrid items={CANDIDATE_RESOURCES} />
        </Section>

        <Section
          id="hiring-guides"
          eyebrow="Hiring guides"
          title="Playbooks for talent leaders"
          description="Operational reference for how engagements start and run."
        >
          <CardGrid items={HIRING_GUIDES} />
        </Section>

        <section className="mt-20 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/30 p-8 md:p-12">
          <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight text-[color:var(--brand-navy)]">
            Ready to see delivery in your own workspace?
          </h2>
          <p className="mt-3 max-w-2xl text-[color:var(--brand-navy)]/80">
            Start hiring with TaaSFlow and get a scored, ranked shortlist
            delivered inside your dedicated workspace.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/intake"
              className="rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--brand-navy)]/90"
            >
              Start hiring
            </Link>
            <Link
              to="/how-it-works"
              className="rounded-md border border-[color:var(--brand-navy)]/15 bg-white px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:border-[color:var(--brand-ocean)]/40"
            >
              See how it works
            </Link>
          </div>
        </section>
      </section>
          <PageConnections
        commercial={{ to: "/how-it-works", label: "See how it works", desc: "The operational spine behind every playbook." }}
        explainer={{ to: "/pricing", label: "What it costs", desc: "Subscription tiers and enterprise options." }}
        resource={{ to: "/blog", label: "Latest on the blog", desc: "Hiring strategy, cost math, and evaluation frameworks." }}
        audience={{ to: "/industries", label: "Explore by industry", desc: "Role blueprints across 57 verticals." }}
      />
    </SiteShell>
  );
}
