import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { marketingHead } from "@/lib/marketing/head";
import { SiteShell, PublicPage, PublicSection, CtaSection } from "@/components/marketing/site-shell";
import { Input } from "@/components/ui/input";
import {
  INTEGRATIONS,
  INTEGRATIONS_LAST_REVIEWED,
  AVAILABILITY_LABEL,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  type Availability,
  type Integration,
  type IntegrationCategory,
} from "@/config/integrations-directory";
import {
  Activity,
  ArrowRight,
  Clock,
  FileText,
  Plug,
  Search,
  ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/integrations")({
  head: () =>
    marketingHead(undefined, "/integrations", {
      title: "Integrations — connections TaaSFlow supports today | TaaSFlow",
      description:
        "Every TaaSFlow integration with its purpose, connection method, data exchanged, permissions and current availability. Planned connections are labelled as planned, never as available.",
    }),
  component: IntegrationsPage,
});

const AVAILABILITY_ORDER: Availability[] = ["available", "beta", "custom", "planned"];

const AVAILABILITY_CLASS: Record<Availability, string> = {
  available:
    "bg-emerald-500/10 text-emerald-700 border-emerald-600/20",
  beta: "bg-sky-500/10 text-sky-700 border-sky-600/20",
  custom: "bg-amber-500/10 text-amber-700 border-amber-600/20",
  planned:
    "border-[color:var(--brand-navy)]/15 bg-[color:var(--brand-navy)]/5 text-[color:var(--brand-navy)]/70",
};

function AvailabilityBadge({ availability }: { availability: Availability }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${AVAILABILITY_CLASS[availability]}`}
    >
      {AVAILABILITY_LABEL[availability]}
    </span>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-navy)]/70">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-[color:var(--brand-navy)]/75">{value}</dd>
    </div>
  );
}

function IntegrationCard({ item }: { item: Integration }) {
  return (
    <article className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white/70 p-5 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-[family-name:var(--brand-font-display)] text-xl font-semibold tracking-tight">
            {item.name}
          </h3>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-navy)]/70">
            {CATEGORY_LABEL[item.category]}
          </p>
        </div>
        <AvailabilityBadge availability={item.availability} />
      </header>

      <p className="mt-4 text-sm text-[color:var(--brand-navy)]/75">{item.purpose}</p>

      {item.availability === "planned" ? (
        <p className="mt-4 rounded-xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-navy)]/[0.03] p-4 text-sm text-[color:var(--brand-navy)]/70">
          Not available yet. {item.plannedNote}
        </p>
      ) : (
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Connection method" value={item.connectionMethod} />
          <Field label="Data exchanged" value={item.dataExchanged} />
          <Field label="Permissions required" value={item.permissions} />
          <Field label="Health visibility" value={item.healthNote} />
        </dl>
      )}

      <footer className="mt-5 flex flex-wrap items-center gap-3 text-sm">
        {item.healthVisibility && item.availability !== "planned" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--brand-navy)]/12 px-3 py-1.5 text-[color:var(--brand-navy)]/70">
            <Activity className="h-4 w-4" aria-hidden />
            Health monitored
          </span>
        ) : null}
        {item.docs ? (
          <Link
            to={item.docs.to}
            hash={item.docs.hash}
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--brand-navy)]/12 px-3 py-1.5 font-medium hover:bg-[color:var(--brand-navy)]/5"
          >
            <FileText className="h-4 w-4" aria-hidden />
            {item.docs.label}
          </Link>
        ) : (
          <span className="text-[color:var(--brand-navy)]/70">
            No setup documentation — nothing to set up yet.
          </span>
        )}
      </footer>
    </article>
  );
}

function IntegrationsPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<IntegrationCategory | "all">("all");
  const [availability, setAvailability] = useState<Availability | "all">("all");

  const activeCategories = useMemo(
    () => CATEGORY_ORDER.filter((c) => INTEGRATIONS.some((i) => i.category === c)),
    [],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return INTEGRATIONS.filter((i) => {
      if (category !== "all" && i.category !== category) return false;
      if (availability !== "all" && i.availability !== availability) return false;
      if (!q) return true;
      return `${i.name} ${CATEGORY_LABEL[i.category]} ${i.purpose}`.toLowerCase().includes(q);
    });
  }, [query, category, availability]);

  const grouped = useMemo(
    () =>
      activeCategories
        .map((c) => ({ category: c, items: results.filter((i) => i.category === c) }))
        .filter((g) => g.items.length > 0),
    [activeCategories, results],
  );

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm transition ${
      active
        ? "border-[color:var(--brand-navy)]/70 bg-[color:var(--brand-navy)] text-white"
        : "border-[color:var(--brand-navy)]/12 text-[color:var(--brand-navy)]/70 hover:bg-[color:var(--brand-navy)]/5"
    }`;

  return (
    <SiteShell>
      <PublicSection className="pb-4">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-navy)]/70">
            Integrations
          </p>
          <h1 className="mt-4 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            What TaaSFlow connects to today
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/70">
            Each listing states its purpose, how the connection is made, what data crosses the
            boundary and what permissions it needs. Anything not built yet is marked Planned.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-[color:var(--brand-navy)]/70">
            <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--brand-navy)]/12 px-3 py-1.5">
              <Clock className="h-4 w-4" aria-hidden />
              Last reviewed {INTEGRATIONS_LAST_REVIEWED}
            </span>
            <Link
              to="/security"
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--brand-navy)]/12 px-3 py-1.5 hover:bg-[color:var(--brand-navy)]/5"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Trust Center
            </Link>
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-8">
        <PublicPage>
          <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white/60 p-4 sm:p-5">
            <label className="relative block">
              <span className="sr-only">Search integrations</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--brand-navy)]/70"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, category or purpose"
                className="pl-9"
                type="search"
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by availability">
              <button type="button" className={chip(availability === "all")} onClick={() => setAvailability("all")}>
                All availability
              </button>
              {AVAILABILITY_ORDER.map((a) => (
                <button key={a} type="button" className={chip(availability === a)} onClick={() => setAvailability(a)}>
                  {AVAILABILITY_LABEL[a]}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
              <button type="button" className={chip(category === "all")} onClick={() => setCategory("all")}>
                All categories
              </button>
              {activeCategories.map((c) => (
                <button key={c} type="button" className={chip(category === c)} onClick={() => setCategory(c)}>
                  {CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </div>

          {grouped.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white/60 p-8 text-center">
              <Plug className="mx-auto h-6 w-6 text-[color:var(--brand-navy)]/70" aria-hidden />
              <h2 className="mt-4 font-[family-name:var(--brand-font-display)] text-xl font-semibold">
                No integration matches that
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--brand-navy)]/70">
                We only list connections that exist in the platform or are formally documented. If
                the one you need is missing, ask us for it — we prioritise by demand.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  className={chip(false)}
                  onClick={() => {
                    setQuery("");
                    setCategory("all");
                    setAvailability("all");
                  }}
                >
                  Clear filters
                </button>
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--brand-navy)] px-4 py-1.5 text-sm font-medium text-white"
                >
                  Request an integration
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-10 space-y-12">
              {grouped.map((group) => (
                <section key={group.category} id={group.category} aria-labelledby={`h-${group.category}`}>
                  <h2
                    id={`h-${group.category}`}
                    className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight"
                  >
                    {CATEGORY_LABEL[group.category]}
                  </h2>
                  <div className="mt-5 grid gap-5 lg:grid-cols-2">
                    {group.items.map((item) => (
                      <IntegrationCard key={item.id} item={item} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </PublicPage>
      </PublicSection>

      <CtaSection
        title="Need a connection that is not listed?"
        description="Tell us which system you run and what should flow between it and TaaSFlow. We build integrations by demand, and we will tell you honestly whether it is on the roadmap."
        primary={{ to: "/contact", label: "Request an integration" }}
        secondary={{ to: "/platform", label: "See the platform" }}
      />
    </SiteShell>
  );
}
