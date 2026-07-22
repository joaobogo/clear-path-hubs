import { createFileRoute, Link } from "@tanstack/react-router";
import { Calculator, FileText, Lightbulb, HelpCircle, ArrowRight } from "lucide-react";
import { SiteShell } from "@/components/marketing/site-shell";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

const entry = getPage("resources");

export const Route = createFileRoute("/resources")({
  head: () =>
    marketingHead(entry, "/resources", {
      title: "Resources — TaaSFlow",
      description:
        "Playbooks, calculators, deliverable samples, and guides for evaluating subscription recruiting.",
    }),
  component: ResourcesPage,
});

type ResourceCard = {
  title: string;
  description: string;
  href: string;
  external?: boolean;
  cta: string;
  icon: typeof Calculator;
  kind: string;
};

const RESOURCES: ResourceCard[] = [
  {
    kind: "Calculator",
    title: "Recruiting ROI calculator",
    description:
      "Model your annual hiring spend against subscription pricing versus 20–30% agency placement fees.",
    href: "/pricing",
    cta: "Open calculator",
    icon: Calculator,
  },
  {
    kind: "Sample",
    title: "Sample candidate shortlist",
    description:
      "See exactly what a scored, evidence-backed shortlist looks like — fit scores, strengths, gaps, and reviewer notes.",
    href: "/how-it-works",
    cta: "View sample",
    icon: FileText,
  },
  {
    kind: "Guide",
    title: "How TaaSFlow works",
    description:
      "The end-to-end process, from intake call to your first ranked shortlist in 7–14 days.",
    href: "/how-it-works",
    cta: "Read the guide",
    icon: Lightbulb,
  },
  {
    kind: "FAQ",
    title: "Frequently asked questions",
    description:
      "How pricing, delivery, ownership, and support differ from traditional agency retainers.",
    href: "/faq",
    cta: "Read FAQ",
    icon: HelpCircle,
  },
];

const LIBRARIES = [
  {
    title: "Blog & playbooks",
    description:
      "72+ articles on hiring strategy, candidate experience, scoring, and market data.",
    href: "/blog",
  },
  {
    title: "Case studies",
    description:
      "Documented engagements with real timelines and outcomes — no invented metrics.",
    href: "/case-studies",
  },
  {
    title: "Knowledge base",
    description:
      "How-to guides and reference material for TaaSFlow clients and candidates.",
    href: "/knowledge-base",
  },
  {
    title: "Industry playbooks",
    description:
      "22 industry-specific hiring guides covering tech, healthcare, legal, finance, and more.",
    href: "/industries",
  },
];

function ResourcesPage() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Resources
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Everything you need to evaluate subscription recruiting
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Sample deliverables, pricing benchmarks, and process walkthroughs —
            built for talent leaders who need answers before committing.
          </p>
        </header>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {RESOURCES.map((r) => {
            const Icon = r.icon;
            return (
              <article
                key={r.title}
                className="flex flex-col rounded-2xl border border-border/60 bg-card p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {r.kind}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold tracking-tight">
                      {r.title}
                    </h2>
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">{r.description}</p>
                <Link
                  to={r.href}
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  {r.cta} <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </article>
            );
          })}
        </div>

        <section className="mt-20">
          <h2 className="text-2xl font-semibold tracking-tight">
            Content libraries
          </h2>
          <p className="mt-2 text-muted-foreground">
            Deeper reference material organized by intent.
          </p>
          <ul className="mt-8 grid gap-4 md:grid-cols-2">
            {LIBRARIES.map((l) => (
              <li
                key={l.title}
                className="rounded-xl border border-border/60 bg-background p-5 hover:border-primary/40"
              >
                <Link to={l.href} className="group block">
                  <h3 className="text-base font-semibold group-hover:text-primary">
                    {l.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {l.description}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-20 rounded-2xl border border-border/60 bg-muted/20 p-8 md:p-12">
          <h2 className="text-2xl font-semibold tracking-tight">
            Prefer to see it live?
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Start a paid pilot for one live role and receive a scored, ranked
            shortlist in 7–14 days. Full dashboard access from day one.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/pilot"
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Start a pilot
            </Link>
            <Link
              to="/contact"
              className="rounded-md border border-border/60 bg-background px-5 py-2.5 text-sm font-semibold hover:bg-muted"
            >
              Talk to us
            </Link>
          </div>
        </section>
      </section>
    </SiteShell>
  );
}
