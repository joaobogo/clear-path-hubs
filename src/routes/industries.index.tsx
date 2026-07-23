import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  SiteShell,
  PublicPage,
  PublicSection,
  CtaSection,
} from "@/components/marketing/site-shell";
import { INDUSTRY_ENTRIES } from "@/content/industries-v2";
import { marketingHead } from "@/lib/marketing/head";

export const Route = createFileRoute("/industries/")({
  head: () =>
    marketingHead(undefined, "/industries", {
      title: "Industries we serve — TaaSFlow",
      description:
        "Structured, evidence-based subscription recruiting across technology, healthcare, sales, HR, consulting, hospitality and more — one workspace per requisition.",
    }),
  component: IndustriesIndex,
});

type Category =
  | "All"
  | "Tech & Data"
  | "Professional Services"
  | "Regulated & Public"
  | "People & GTM"
  | "Operations & Services";

const CATEGORIES: Category[] = [
  "All",
  "Tech & Data",
  "Professional Services",
  "Regulated & Public",
  "People & GTM",
  "Operations & Services",
];

const CATEGORY_BY_SLUG: Record<string, Exclude<Category, "All">> = {
  tech: "Tech & Data",
  saas: "Tech & Data",
  cybersecurity: "Tech & Data",
  "data-analytics": "Tech & Data",
  media: "Tech & Data",
  ecommerce: "Tech & Data",
  consulting: "Professional Services",
  legal: "Professional Services",
  finance: "Professional Services",
  accounting: "Professional Services",
  insurance: "Professional Services",
  "private-equity": "Professional Services",
  "staffing-agencies": "Professional Services",
  healthcare: "Regulated & Public",
  "public-sector": "Regulated & Public",
  nonprofit: "Regulated & Public",
  sales: "People & GTM",
  marketing: "People & GTM",
  "human-resources": "People & GTM",
  "real-estate": "Operations & Services",
  construction: "Operations & Services",
  hospitality: "Operations & Services",
};

const CONTEXT_REASONS = [
  {
    title: "Signal lives in the domain",
    body: "A CS manager at a self-serve SaaS is a different job to one at an enterprise platform. Domain context turns identical titles into a real rubric.",
  },
  {
    title: "Language and evidence differ",
    body: "Engineers describe systems, lawyers describe matters, clinicians describe caseloads. We extract evidence in the vocabulary of the role.",
  },
  {
    title: "Regulation and constraints matter",
    body: "Jurisdictions, licences, and framework fit change who qualifies. We treat them as first-class filters, not free-text notes.",
  },
];

const HIGHLIGHT_SLUGS = [
  "tech",
  "healthcare",
  "sales",
  "human-resources",
  "consulting",
  "hospitality",
];

function IndustriesIndex() {
  const [active, setActive] = useState<Category>("All");
  const [query, setQuery] = useState("");

  const decorated = useMemo(
    () =>
      INDUSTRY_ENTRIES.map((e) => ({
        ...e,
        category: CATEGORY_BY_SLUG[e.slug] ?? "Operations & Services",
      })),
    [],
  );

  const cards = useMemo(() => {
    const q = query.trim().toLowerCase();
    return decorated.filter((e) => {
      if (active !== "All" && e.category !== active) return false;
      if (!q) return true;
      const haystack = [
        e.name,
        e.eyebrow,
        e.summary ?? "",
        (e.aliases ?? []).join(" "),
        e.roles.join(" "),
        (e.skills ?? []).join(" "),
        (e.tools ?? []).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [decorated, active, query]);

  const highlights = HIGHLIGHT_SLUGS
    .map((slug) => INDUSTRY_ENTRIES.find((e) => e.slug === slug))
    .filter((e): e is (typeof INDUSTRY_ENTRIES)[number] => Boolean(e));


  return (
    <SiteShell>
      {/* Hero */}
      <PublicSection className="pt-24">
        <PublicPage className="max-w-4xl">
          <p className="text-sm font-medium uppercase tracking-widest text-[color:var(--brand-ocean)]">
            Industries
          </p>
          <h1 className="mt-3 font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            One recruiting model. Every industry, its own rubric.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[color:var(--brand-navy)]/70">
            TaaSFlow calibrates every search to the industry you actually hire
            in. Same workspace, same transparent scoring — different rubrics,
            different evidence, different roles.
          </p>
        </PublicPage>
      </PublicSection>

      {/* Why context matters */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 py-16">
        <PublicPage>
          <h2 className="max-w-2xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
            Why industry context matters in recruiting
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {CONTEXT_REASONS.map((r) => (
              <div
                key={r.title}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <h3 className="text-lg font-semibold text-[color:var(--brand-navy)]">
                  {r.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[color:var(--brand-navy)]/70">
                  {r.body}
                </p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* Filters + Card grid */}
      <PublicSection>
        <PublicPage>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
                Industries we serve
              </h2>
              <p className="mt-3 max-w-xl text-[color:var(--brand-navy)]/70">
                Browse by category. Each industry has a dedicated page with the
                rubric approach, common roles and how the workspace is set up.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative block w-full sm:max-w-md">
              <span className="sr-only">Search industries</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search industry, role, skill or tool"
                className="w-full rounded-full border border-[color:var(--brand-navy)]/15 bg-white px-4 py-2.5 text-sm text-[color:var(--brand-navy)] placeholder:text-[color:var(--brand-navy)]/50 focus:border-[color:var(--brand-ocean)] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus-ring)]"
              />
            </label>
            <p className="text-xs text-[color:var(--brand-navy)]/60">
              Showing <span className="font-semibold text-[color:var(--brand-navy)]">{cards.length}</span> of {decorated.length} industries
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Industry categories"
            className="mt-4 flex flex-wrap gap-2"
          >
            {CATEGORIES.map((c) => {
              const isActive = c === active;
              const count =
                c === "All"
                  ? decorated.length
                  : decorated.filter((e) => e.category === c).length;
              return (
                <button
                  key={c}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActive(c)}
                  className={
                    "inline-flex min-h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors " +
                    (isActive
                      ? "border-[color:var(--brand-navy)] bg-[color:var(--brand-navy)] text-white"
                      : "border-[color:var(--brand-navy)]/15 bg-white text-[color:var(--brand-navy)] hover:border-[color:var(--brand-navy)]/40")
                  }
                >
                  {c}
                  <span className={"text-xs " + (isActive ? "text-white/70" : "text-[color:var(--brand-navy)]/50")}>{count}</span>
                </button>
              );
            })}
          </div>

          {cards.length === 0 ? (
            <p className="mt-10 rounded-2xl border border-dashed border-[color:var(--brand-navy)]/15 bg-white p-8 text-center text-sm text-[color:var(--brand-navy)]/60">
              No industries match &ldquo;{query}&rdquo;. Try a role, skill or category.
            </p>
          ) : null}


          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
              <Link
                key={c.slug}
                to="/industries/$slug"
                params={{ slug: c.slug }}
                className="group flex h-full flex-col rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 transition-colors hover:border-[color:var(--brand-ocean)]/50 hover:shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean)]">
                  {c.category}
                </p>
                <h3 className="mt-2 text-xl font-semibold text-[color:var(--brand-navy)] group-hover:text-[color:var(--brand-ocean)]">
                  {c.name}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm text-[color:var(--brand-navy)]/70">
                  {c.meta.description}
                </p>
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-navy)]/60">
                    Example roles
                  </p>
                  <p className="mt-1.5 line-clamp-2 text-sm text-[color:var(--brand-navy)]/80">
                    {c.roles.slice(0, 4).join(" · ")}
                  </p>
                </div>
                <span className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-ocean)]">
                  Explore {c.name} →
                </span>
              </Link>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* Common role families */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40">
        <PublicPage>
          <h2 className="max-w-2xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
            Common role families

          </h2>
          <p className="mt-3 max-w-2xl text-[color:var(--brand-navy)]/70">
            A snapshot of the roles TaaSFlow calibrates for across the most
            requested industries. Detail pages list the full rubric approach.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {highlights.map((h) => (
              <div
                key={h.slug}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-semibold text-[color:var(--brand-navy)]">
                    {h.name}
                  </h3>
                  <Link
                    to="/industries/$slug"
                    params={{ slug: h.slug }}
                    className="text-sm font-semibold text-[color:var(--brand-ocean)] hover:underline"
                  >
                    View page →
                  </Link>
                </div>
                <ul className="mt-4 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {h.roles.slice(0, 6).map((r) => (
                    <li
                      key={r}
                      className="text-sm text-[color:var(--brand-navy)]/80"
                    >
                      · {r}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* Enterprise CTA */}
      <PublicSection>
        <PublicPage>
          <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-8 sm:p-12">
            <div className="grid gap-8 md:grid-cols-[2fr_1fr] md:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean)]">
                  For enterprise teams
                </p>
                <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
                  Hiring across multiple industries at once?
                </h2>
                <p className="mt-3 max-w-xl text-[color:var(--brand-navy)]/70">
                  We run cross-industry programmes for enterprise account
                  structures — one workspace per business unit, one rubric per
                  role, aggregate reporting on top.
                </p>
              </div>
              <div className="flex flex-col gap-3 md:items-end">
                <Link
                  to="/enterprise"
                  className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--brand-navy)]/90"
                >
                  See the enterprise model
                </Link>
                <Link
                  to="/contact"
                  className="text-sm font-semibold text-[color:var(--brand-ocean)] hover:underline"
                >
                  Book enterprise consultation →
                </Link>
              </div>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      {/* Final CTA */}
      <CtaSection
        eyebrow="Ready to hire?"
        title="Pick your industry. Start the intake."
        description="Submit a role and your workspace is ready when you finish the guided intake."
        primary={{ to: "/intake", label: "Start hiring" }}
        secondary={{ to: "/how-it-works", label: "See how it works" }}
      />
    </SiteShell>
  );
}
