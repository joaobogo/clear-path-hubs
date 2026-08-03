import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { SiteShell } from "@/components/marketing/site-shell";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

const entry = getPage("knowledge-base");

export const Route = createFileRoute("/knowledge-base")({
  head: () =>
    marketingHead(entry, "/knowledge-base", {
      title: "Knowledge base — TaaSFlow",
      description:
        "How-to guides and reference material for TaaSFlow clients and candidates.",
    }),
  component: KnowledgeBasePage,
});

// Visibility gate: only "public" articles render.
// - "public"  = educational content anyone can read
// - "support" = product-support content, requires signed-in dashboard (linked out, not rendered here)
// - "internal" = ops/runbook material — NEVER shown here
type Visibility = "public" | "support" | "internal";

type Category = {
  slug: string;
  name: string;
  description: string;
};

type Article = {
  slug: string;
  category: string;
  title: string;
  summary: string;
  readMinutes: number;
  visibility: Visibility;
  href?: string; // for support articles, deep-link to /login or /dashboard
};

const CATEGORIES: Category[] = [
  {
    slug: "getting-started",
    name: "Getting started",
    description: "What TaaSFlow is and how the process works end-to-end.",
  },
  {
    slug: "for-employers",
    name: "For employers",
    description: "Intake, scoring, pipeline, and hiring workflow.",
  },
  {
    slug: "for-candidates",
    name: "For candidates",
    description: "Profile, application, and interview flow.",
  },
  {
    slug: "pricing-billing",
    name: "Pricing & billing",
    description: "Subscription mechanics, pilots, and invoicing.",
  },
  {
    slug: "security-compliance",
    name: "Security & compliance",
    description: "Data handling, RLS, and access controls.",
  },
];

const ARTICLES: Article[] = [
  // ---- Getting started (public educational) ----
  {
    slug: "what-is-taas",
    category: "getting-started",
    title: "What is Talent-as-a-Service?",
    summary:
      "A subscription model that combines agency-quality sourcing with in-house pipeline visibility, priced per role per month.",
    readMinutes: 3,
    visibility: "public",
  },
  {
    slug: "how-the-process-works",
    category: "getting-started",
    title: "How the process works",
    summary:
      "From intake blueprint to ranked shortlist — the five stages every engagement runs through.",
    readMinutes: 5,
    visibility: "public",
  },
  {
    slug: "employer-onboarding",
    category: "getting-started",
    title: "Getting started as an employer",
    summary:
      "Account setup, first intake, and what to expect during your first two weeks.",
    readMinutes: 4,
    visibility: "public",
  },
  {
    slug: "candidate-onboarding",
    category: "getting-started",
    title: "Getting started as a candidate",
    summary:
      "How to apply, what happens after you upload your CV, and how to track your application.",
    readMinutes: 3,
    visibility: "public",
  },

  // ---- For employers ----
  {
    slug: "intake-blueprint",
    category: "for-employers",
    title: "How to complete the intake blueprint",
    summary:
      "The 5-step wizard that translates a role into sourceable requirements and screening questions.",
    readMinutes: 5,
    visibility: "public",
  },
  {
    slug: "candidate-scoring",
    category: "for-employers",
    title: "How candidate scoring works",
    summary:
      "The evidence-first, role-specific scoring engine — what it measures and how to interpret results.",
    readMinutes: 4,
    visibility: "public",
  },
  {
    slug: "hiring-pipeline",
    category: "for-employers",
    title: "Managing your hiring pipeline",
    summary:
      "Using the Kanban board to move candidates through review, interview, decision, and offer stages.",
    readMinutes: 4,
    visibility: "support",
    href: "/login",
  },
  {
    slug: "weekly-drops",
    category: "for-employers",
    title: "Weekly candidate drops",
    summary: "Delivery cadence, what each drop contains, and how to give feedback.",
    readMinutes: 3,
    visibility: "public",
  },
  {
    slug: "invite-team",
    category: "for-employers",
    title: "Inviting your team to the dashboard",
    summary:
      "Add hiring managers and reviewers so they can score candidates and leave feedback.",
    readMinutes: 2,
    visibility: "support",
    href: "/login",
  },

  // ---- For candidates ----
  {
    slug: "standout-profile",
    category: "for-candidates",
    title: "Building a standout candidate profile",
    summary:
      "How the CV parser reads your document and what to include so the scoring engine can find you.",
    readMinutes: 5,
    visibility: "public",
  },
  {
    slug: "application-matching",
    category: "for-candidates",
    title: "The application and matching process",
    summary:
      "What happens after you apply — parsing, scoring, admin review, and client visibility.",
    readMinutes: 4,
    visibility: "public",
  },
  {
    slug: "interview-prep",
    category: "for-candidates",
    title: "Interview preparation guide",
    summary:
      "Common formats used by TaaSFlow clients, and how to prepare for role-specific technical rounds.",
    readMinutes: 6,
    visibility: "public",
  },
  {
    slug: "application-status",
    category: "for-candidates",
    title: "Tracking your application status",
    summary:
      "How to read the stages in your candidate dashboard and what each one means.",
    readMinutes: 3,
    visibility: "support",
    href: "/login",
  },

  // ---- Pricing & billing ----
  {
    slug: "pilot-pricing",
    category: "pricing-billing",
    title: "How the paid pilot works",
    summary:
      "One live role, one ranked shortlist within 14 days, no placement fee if you hire.",
    readMinutes: 3,
    visibility: "public",
  },
  {
    slug: "subscription-mechanics",
    category: "pricing-billing",
    title: "How subscription pricing works",
    summary:
      "Per-role monthly pricing, add-ons, pausing engagements, and how billing differs from agency retainers.",
    readMinutes: 4,
    visibility: "public",
  },
  {
    slug: "invoices-payments",
    category: "pricing-billing",
    title: "Invoices and payments",
    summary:
      "Where to find your invoices, supported payment methods, and how to update billing details.",
    readMinutes: 2,
    visibility: "support",
    href: "/login",
  },

  // ---- Security & compliance (public) ----
  {
    slug: "data-security",
    category: "security-compliance",
    title: "How TaaSFlow secures your data",
    summary:
      "Row-level security, tenant isolation, encryption at rest and in transit, and access-control model.",
    readMinutes: 4,
    visibility: "public",
  },
  {
    slug: "candidate-privacy",
    category: "security-compliance",
    title: "Candidate privacy and CV handling",
    summary:
      "Consent, retention windows, storage buckets, and what clients can and cannot see.",
    readMinutes: 4,
    visibility: "public",
  },
];

function KnowledgeBasePage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("");

  const publicArticles = useMemo(
    () => ARTICLES.filter((a) => a.visibility !== "internal"),
    [],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return publicArticles.filter((a) => {
      if (cat && a.category !== cat) return false;
      if (!needle) return true;
      return (
        a.title.toLowerCase().includes(needle) ||
        a.summary.toLowerCase().includes(needle)
      );
    });
  }, [publicArticles, q, cat]);

  const byCat = (slug: string) =>
    filtered.filter((a) => a.category === slug);

  return (
    <SiteShell>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Knowledge base
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            How can we help?
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Guides and reference material for TaaSFlow clients and candidates.
            Product-support articles link into your signed-in dashboard.
          </p>
        </header>

        <div className="mt-10 flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search articles…"
              className="w-full rounded-md border border-border/60 bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCat("")}
              className={`inline-flex min-h-11 items-center rounded-full border px-3 py-1.5 text-xs font-medium sm:min-h-9 ${
                cat === ""
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/60 bg-background text-muted-foreground"
              }`}
            >
              All ({publicArticles.length})
            </button>
            {CATEGORIES.map((c) => {
              const n = publicArticles.filter((a) => a.category === c.slug).length;
              const active = cat === c.slug;
              return (
                <button
                  key={c.slug}
                  onClick={() => setCat(active ? "" : c.slug)}
                  className={`inline-flex min-h-11 items-center rounded-full border px-3 py-1.5 text-xs font-medium sm:min-h-9 ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/60 bg-background text-muted-foreground"
                  }`}
                >
                  {c.name} ({n})
                </button>
              );
            })}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-12 rounded-xl border border-dashed border-border/60 bg-muted/20 p-10 text-center">
            <p className="text-lg font-semibold">No matching articles</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Try a different search term, or{" "}
              <Link to="/contact" className="text-primary hover:underline">
                contact us
              </Link>{" "}
              if you can't find what you need.
            </p>
          </div>
        ) : (
          <div className="mt-12 space-y-14">
            {CATEGORIES.map((c) => {
              const list = byCat(c.slug);
              if (!list.length) return null;
              return (
                <section key={c.slug}>
                  <h2 className="text-xl font-semibold tracking-tight">
                    {c.name}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {c.description}
                  </p>
                  <ul className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {list.map((a) => {
                      const isSupport = a.visibility === "support";
                      const inner = (
                        <>
                          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest">
                            <span
                              className={
                                isSupport
                                  ? "rounded-full bg-warning/15 px-2 py-0.5 text-warning-foreground dark:text-warning-foreground"
                                  : "rounded-full bg-primary/10 px-2 py-0.5 text-primary"
                              }
                            >
                              {isSupport ? "Dashboard" : "Public"}
                            </span>
                            <span className="text-muted-foreground">
                              {a.readMinutes} min
                            </span>
                          </div>
                          <h3 className="mt-3 text-base font-semibold leading-snug">
                            {a.title}
                          </h3>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {a.summary}
                          </p>
                          {isSupport && (
                            <p className="mt-3 text-xs text-muted-foreground">
                              Requires a signed-in TaaSFlow account.
                            </p>
                          )}
                        </>
                      );
                      return (
                        <li
                          key={a.slug}
                          className="rounded-xl border border-border/60 bg-card p-5 hover:border-primary/40"
                        >
                          {isSupport && a.href ? (
                            <Link to={a.href} className="block">
                              {inner}
                            </Link>
                          ) : (
                            <div>{inner}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}

        <aside className="mt-20 rounded-2xl border border-border/60 bg-muted/20 p-8">
          <h2 className="text-lg font-semibold">Can't find what you need?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Reach out and we'll answer directly — usually within one business day.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/contact"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Contact us
            </Link>
            <Link
              to="/faq"
              className="rounded-md border border-border/60 bg-background px-4 py-2 text-sm font-semibold hover:bg-muted"
            >
              Read the FAQ
            </Link>
          </div>
        </aside>
      </section>
    </SiteShell>
  );
}
