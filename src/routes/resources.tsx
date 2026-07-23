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
} from "lucide-react";
import { SiteShell } from "@/components/marketing/site-shell";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

const entry = getPage("resources");

export const Route = createFileRoute("/resources")({
  head: () =>
    marketingHead(entry, "/resources", {
      title: "Resources — TaaSFlow",
      description:
        "Hiring guides, industry insights, candidate resources, and knowledge-base links from TaaSFlow.",
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

const FEATURED: Card[] = [
  {
    title: "How TaaSFlow works",
    description:
      "End-to-end walkthrough of intake, sourcing, ranked shortlists, workspace visibility, and delivery cadence.",
    href: "/how-it-works",
    cta: "Read the guide",
    icon: Lightbulb,
  },
  {
    title: "Employer onboarding",
    description:
      "What to expect after your first intake — what TaaSFlow prepares, what the client provides, and how workspace access begins.",
    href: "/employer-onboarding",
    cta: "See the journey",
    icon: GraduationCap,
  },
  {
    title: "Pricing & engagement paths",
    description:
      "Subscription-based recruiting with no placement fees. Review the model and how engagements start.",
    href: "/pricing",
    cta: "Review pricing",
    icon: LineChart,
  },
];

const HIRING_GUIDES: Card[] = [
  {
    title: "Blog & playbooks",
    description:
      "Long-form articles on hiring strategy, evaluation, candidate experience, and modern talent operations.",
    href: "/blog",
    cta: "Browse articles",
    icon: BookOpen,
  },
  {
    title: "Enterprise operating model",
    description:
      "How multi-role hiring programs run inside TaaSFlow with shared workspace visibility across teams.",
    href: "/enterprise",
    cta: "See enterprise model",
    icon: Building2,
  },
  {
    title: "Staffing partnerships",
    description:
      "How agencies use TaaSFlow to expand delivery capacity while keeping their own client relationships.",
    href: "/partnerships/staffing",
    cta: "Partnership overview",
    icon: Layers,
  },
];

const INDUSTRY_INSIGHTS: Card[] = [
  {
    title: "Industry hub",
    description:
      "Hiring context across Technology, Healthcare, Sales, Human Resources, Consulting, Hospitality and more.",
    href: "/industries",
    cta: "Open the hub",
    icon: Layers,
  },
  {
    title: "Category-organized articles",
    description:
      "Browse insights grouped by discipline and functional area rather than a single generic feed.",
    href: "/blog",
    cta: "See categories",
    icon: BookOpen,
  },
];

const CANDIDATE_RESOURCES: Card[] = [
  {
    title: "Open roles",
    description:
      "Search current positions actively being sourced by TaaSFlow across every partner engagement.",
    href: "/jobs",
    cta: "Browse jobs",
    icon: Users,
  },
  {
    title: "Talent network",
    description:
      "How the private candidate network works, how matching happens, and how candidates stay in control of visibility.",
    href: "/talent-network",
    cta: "Learn more",
    icon: Users,
  },
];

const KNOWLEDGE_BASE: Card[] = [
  {
    title: "Knowledge base",
    description:
      "Reference material and how-to guides for TaaSFlow clients and candidates.",
    href: "/knowledge-base",
    cta: "Open knowledge base",
    icon: FileText,
  },
  {
    title: "Frequently asked questions",
    description:
      "Answers on delivery, workspace access, pricing model, ownership, and support.",
    href: "/faq",
    cta: "Read the FAQ",
    icon: HelpCircle,
  },
];

function CardGrid({ items }: { items: Card[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((r) => {
        const Icon = r.icon;
        return (
          <article
            key={r.title}
            className="flex flex-col rounded-2xl border border-border/60 bg-card p-6"
          >
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <h3 className="text-lg font-semibold tracking-tight">{r.title}</h3>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">
              {r.description}
            </p>
            <Link
              to={r.href}
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
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
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-20">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h2>
        <p className="mt-2 text-muted-foreground">{description}</p>
      </header>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function ResourcesPage() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Resources
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Guides, insights, and reference material
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Everything you need to evaluate TaaSFlow — how delivery works, what
            the workspace looks like, and where to go for role-specific context.
          </p>
        </header>

        <Section
          eyebrow="Featured"
          title="Start here"
          description="The three resources most clients open first."
        >
          <CardGrid items={FEATURED} />
        </Section>

        <Section
          eyebrow="Hiring guides"
          title="Playbooks for talent leaders"
          description="Operational guides on how engagements are structured and delivered."
        >
          <CardGrid items={HIRING_GUIDES} />
        </Section>

        <Section
          eyebrow="Industry insights"
          title="Context by industry"
          description="Hiring dynamics and role expectations across the industries TaaSFlow supports."
        >
          <CardGrid items={INDUSTRY_INSIGHTS} />
        </Section>

        <Section
          eyebrow="Candidate resources"
          title="For candidates"
          description="Ways to explore roles and join the private talent network."
        >
          <CardGrid items={CANDIDATE_RESOURCES} />
        </Section>

        <Section
          eyebrow="Knowledge base"
          title="Reference material"
          description="Direct links to detailed reference documentation."
        >
          <CardGrid items={KNOWLEDGE_BASE} />
        </Section>

        <section className="mt-20 rounded-2xl border border-border/60 bg-muted/20 p-8 md:p-12">
          <h2 className="text-2xl font-semibold tracking-tight">
            Ready to see delivery in your own workspace?
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Start hiring with TaaSFlow and get a scored, ranked shortlist
            delivered inside your dedicated workspace.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/intake"
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Start Hiring
            </Link>
            <Link
              to="/how-it-works"
              className="rounded-md border border-border/60 bg-background px-5 py-2.5 text-sm font-semibold hover:bg-muted"
            >
              See How It Works
            </Link>
          </div>
        </section>
      </section>
    </SiteShell>
  );
}
