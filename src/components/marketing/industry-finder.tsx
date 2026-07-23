import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search,
  ArrowUpRight,
  Building2,
  Target,
  Users,
  Award,
  Wrench,
  Sparkles,
  X,
  ChevronRight,
} from "lucide-react";
import { INDUSTRY_ENTRIES, type IndustryEntry } from "@/content/industries-v2";
import {
  EXPLORER_CATEGORIES,
  CATEGORY_BY_SLUG,
  type ExplorerCategory,
} from "@/components/marketing/industry-explorer";
import { getIndustryVisualIdentity } from "@/content/industry-visual-identity";
import { IndustryHeroBackdrop } from "@/components/marketing/industry-hero-backdrop";

/**
 * IndustryFinder — premium two-pane explorer for /industries.
 *
 * Left pane: filters (category chips + typed search + dimension pill),
 * a matching count, and a compact list of industries. No card wall.
 * Right pane: the selected industry's operating brief — challenges,
 * roles, candidate signals, tools & certifications, TaaSFlow approach,
 * and a per-industry CTA linking to the dedicated page.
 */

type Dim = "all" | "role" | "skill" | "cert" | "alias";

type Entry = IndustryEntry & { category: ExplorerCategory };

const ALL_ENTRIES: Entry[] = [...INDUSTRY_ENTRIES]
  .map((e) => ({
    ...e,
    category:
      CATEGORY_BY_SLUG[e.slug] ??
      ("Operations & Physical Industries" as ExplorerCategory),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const DIM_LABEL: Record<Dim, string> = {
  all: "Anywhere",
  role: "Role",
  skill: "Skill",
  cert: "Certification",
  alias: "Alias",
};

function matches(entry: Entry, q: string, dim: Dim) {
  if (!q) return true;
  const needle = q.toLowerCase();
  const inList = (arr?: string[]) =>
    !!arr?.some((s) => s.toLowerCase().includes(needle));
  switch (dim) {
    case "role":
      return (
        inList(entry.roles) ||
        !!entry.roleFamilies?.some(
          (rf) =>
            rf.name.toLowerCase().includes(needle) || inList(rf.roles),
        )
      );
    case "skill":
      return inList(entry.skills) || inList(entry.tools);
    case "cert":
      return inList(entry.certifications) || inList(entry.regulatedRequirements);
    case "alias":
      return (
        entry.name.toLowerCase().includes(needle) || inList(entry.aliases)
      );
    case "all":
    default:
      return (
        entry.name.toLowerCase().includes(needle) ||
        entry.eyebrow.toLowerCase().includes(needle) ||
        (entry.summary ?? "").toLowerCase().includes(needle) ||
        inList(entry.aliases) ||
        inList(entry.roles) ||
        inList(entry.skills) ||
        inList(entry.tools) ||
        inList(entry.certifications) ||
        inList(entry.regulatedRequirements)
      );
  }
}

export function IndustryFinder({
  initialSlug = "tech",
}: {
  initialSlug?: string;
}) {
  const [query, setQuery] = useState("");
  const [dim, setDim] = useState<Dim>("all");
  const [cat, setCat] = useState<ExplorerCategory | "all">("all");
  const [slug, setSlug] = useState<string>(initialSlug);

  const filtered = useMemo(() => {
    return ALL_ENTRIES.filter(
      (e) =>
        (cat === "all" || e.category === cat) && matches(e, query.trim(), dim),
    );
  }, [query, dim, cat]);

  // Auto-select first match if selection falls out of results
  const selected: Entry =
    filtered.find((e) => e.slug === slug) ??
    filtered[0] ??
    ALL_ENTRIES.find((e) => e.slug === slug) ??
    ALL_ENTRIES[0];

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
      {/* ── Left: filters + list ─────────────────────────────── */}
      <aside className="lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
        <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white">
          {/* Search */}
          <div className="border-b border-[color:var(--brand-navy)]/10 p-4">
            <label className="relative block">
              <span className="sr-only">Search industries</span>
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--brand-navy)]/50"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  dim === "role"
                    ? "Search a role, e.g. staff engineer"
                    : dim === "skill"
                      ? "Search a skill, e.g. Kubernetes"
                      : dim === "cert"
                        ? "Search a certification, e.g. CISSP"
                        : dim === "alias"
                          ? "Search an industry alias, e.g. IT"
                          : "Search industry, role, skill, certification…"
                }
                className="w-full rounded-md border border-[color:var(--brand-navy)]/15 bg-white py-2.5 pl-9 pr-9 text-sm text-[color:var(--brand-navy)] placeholder:text-[color:var(--brand-navy)]/45 focus:border-[color:var(--brand-ocean)] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus-ring)]"
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[color:var(--brand-navy)]/50 hover:bg-[color:var(--brand-navy)]/5 hover:text-[color:var(--brand-navy)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </label>

            {/* Dimension pills */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(Object.keys(DIM_LABEL) as Dim[]).map((k) => {
                const on = dim === k;
                return (
                  <button
                    key={k}
                    onClick={() => setDim(k)}
                    className={
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition " +
                      (on
                        ? "bg-[color:var(--brand-navy)] text-white"
                        : "border border-[color:var(--brand-navy)]/15 text-[color:var(--brand-navy)]/70 hover:border-[color:var(--brand-navy)]/40")
                    }
                  >
                    {DIM_LABEL[k]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category chips */}
          <div className="border-b border-[color:var(--brand-navy)]/10 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/55">
              Category
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <CategoryChip
                active={cat === "all"}
                onClick={() => setCat("all")}
                label="All"
                count={ALL_ENTRIES.length}
              />
              {EXPLORER_CATEGORIES.map((c) => {
                const count = ALL_ENTRIES.filter((e) => e.category === c).length;
                return (
                  <CategoryChip
                    key={c}
                    active={cat === c}
                    onClick={() => setCat(c)}
                    label={c.split(" ")[0]}
                    count={count}
                  />
                );
              })}
            </div>
          </div>

          {/* Result list */}
          <div className="flex items-center justify-between border-b border-[color:var(--brand-navy)]/10 px-4 py-2.5 text-[11px] uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/55">
            <span className="font-semibold">
              {filtered.length} of {ALL_ENTRIES.length}
            </span>
            {(query || cat !== "all" || dim !== "all") && (
              <button
                onClick={() => {
                  setQuery("");
                  setCat("all");
                  setDim("all");
                }}
                className="font-semibold text-[color:var(--brand-ocean)] hover:underline"
              >
                Reset
              </button>
            )}
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="p-6 text-sm text-[color:var(--brand-navy)]/60">
                No industries matched. Try a broader keyword or reset the filters.
              </li>
            ) : (
              filtered.map((e) => (
                <li key={e.slug}>
                  <button
                    onClick={() => setSlug(e.slug)}
                    aria-current={selected.slug === e.slug ? "true" : undefined}
                    className={
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition " +
                      (selected.slug === e.slug
                        ? "bg-[color:var(--brand-paper)]"
                        : "hover:bg-[color:var(--brand-paper)]/60")
                    }
                  >
                    <IndustrySwatch slug={e.slug} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/55">
                        {e.eyebrow}
                      </p>
                      <p className="truncate text-sm font-semibold text-[color:var(--brand-navy)]">
                        {e.name}
                      </p>
                    </div>
                    <ChevronRight
                      className={
                        "h-4 w-4 shrink-0 transition " +
                        (selected.slug === e.slug
                          ? "text-[color:var(--brand-navy)]"
                          : "text-[color:var(--brand-navy)]/25")
                      }
                    />
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </aside>

      {/* ── Right: selected industry panel ─────────────────────── */}
      <IndustryPanel entry={selected} />
    </div>
  );
}

/* ── UI atoms ────────────────────────────────────────────────── */

function CategoryChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition " +
        (active
          ? "bg-[color:var(--brand-navy)] text-white"
          : "border border-[color:var(--brand-navy)]/15 bg-white text-[color:var(--brand-navy)]/80 hover:border-[color:var(--brand-navy)]/40")
      }
    >
      {label}
      <span
        className={
          "text-[10px] " + (active ? "text-white/70" : "text-[color:var(--brand-navy)]/50")
        }
      >
        {count}
      </span>
    </button>
  );
}

function IndustrySwatch({ slug }: { slug: string }) {
  const v = getIndustryVisualIdentity(slug);
  return (
    <span
      aria-hidden
      className={`relative block h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gradient-to-br ${v.gradient}`}
    >
      <span className={`absolute inset-0 ${v.accent} opacity-70`} />
    </span>
  );
}

/* ── Selected-industry panel ─────────────────────────────────── */

function IndustryPanel({ entry }: { entry: Entry }) {
  const v = getIndustryVisualIdentity(entry.slug);
  return (
    <section
      key={entry.slug}
      aria-live="polite"
      className="overflow-hidden rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white"
    >
      {/* Panel hero */}
      <div className="relative">
        <div className="relative aspect-[16/6] w-full overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-br ${v.gradient}`} />
          <div className={`absolute inset-0 ${v.accent} opacity-90`}>
            <div className="absolute inset-0 [&>figure]:!aspect-auto [&>figure]:!h-full [&>figure]:!min-h-0 [&>figure]:!rounded-none [&>figure]:!border-0 [&>figure]:!shadow-none">
              <IndustryHeroBackdrop
                gradient={v.gradient}
                accent={v.accent}
                pattern={v.pattern}
                label=""
                eyebrow=""
              />
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 p-6 text-white sm:p-8">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">
                {entry.eyebrow} · {entry.category}
              </p>
              <h2 className="mt-1 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
                {entry.name}
              </h2>
            </div>
            <Link
              to="/industries/$slug"
              params={{ slug: entry.slug }}
              className="hidden shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/25 sm:inline-flex"
            >
              Full page <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-2">
        {/* Challenge */}
        <PanelBlock icon={Target} title="The hiring challenge">
          {entry.challenges.length ? (
            <ul className="space-y-3">
              {entry.challenges.slice(0, 3).map((c) => (
                <li key={c.title}>
                  <p className="text-sm font-semibold text-[color:var(--brand-navy)]">
                    {c.title}
                  </p>
                  <p className="mt-0.5 text-sm text-[color:var(--brand-navy)]/70">
                    {c.body}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <PanelEmpty>Challenges published on the full page.</PanelEmpty>
          )}
        </PanelBlock>

        {/* Roles */}
        <PanelBlock icon={Users} title="Roles we run">
          {entry.roles.length ? (
            <div className="flex flex-wrap gap-1.5">
              {entry.roles.slice(0, 12).map((r) => (
                <span
                  key={r}
                  className="rounded-full border border-[color:var(--brand-navy)]/12 bg-[color:var(--brand-paper)] px-2.5 py-1 text-xs text-[color:var(--brand-navy)]"
                >
                  {r}
                </span>
              ))}
            </div>
          ) : (
            <PanelEmpty>Roles listed on the full page.</PanelEmpty>
          )}
        </PanelBlock>

        {/* Signals */}
        <PanelBlock icon={Sparkles} title="Candidate signals we score">
          {entry.candidateSignals?.length ? (
            <ul className="space-y-3">
              {entry.candidateSignals.slice(0, 4).map((s) => (
                <li key={s.title}>
                  <p className="text-sm font-semibold text-[color:var(--brand-navy)]">
                    {s.title}
                  </p>
                  <p className="mt-0.5 text-sm text-[color:var(--brand-navy)]/70">
                    {s.body}
                  </p>
                </li>
              ))}
            </ul>
          ) : entry.signals?.length ? (
            <ul className="space-y-1.5 text-sm text-[color:var(--brand-navy)]/80">
              {entry.signals.slice(0, 4).map((s) => (
                <li key={s} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-ocean)]" />
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <PanelEmpty>Signals published on the full page.</PanelEmpty>
          )}
        </PanelBlock>

        {/* Tools + certs */}
        <PanelBlock icon={Wrench} title="Tools & certifications">
          <div className="space-y-4">
            {entry.tools?.length ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/55">
                  Tools
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {entry.tools.slice(0, 12).map((t) => (
                    <span
                      key={t}
                      className="rounded-md border border-[color:var(--brand-navy)]/10 bg-white px-2 py-0.5 text-xs text-[color:var(--brand-navy)]/80"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {entry.certifications?.length ? (
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/55">
                  <Award className="h-3 w-3" /> Certifications
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {entry.certifications.slice(0, 8).map((c) => (
                    <span
                      key={c}
                      className="rounded-md border border-[color:var(--brand-navy)]/10 bg-white px-2 py-0.5 text-xs text-[color:var(--brand-navy)]/80"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {!entry.tools?.length && !entry.certifications?.length && (
              <PanelEmpty>See the full page for tools & certifications.</PanelEmpty>
            )}
          </div>
        </PanelBlock>

        {/* TaaSFlow approach */}
        <PanelBlock icon={Building2} title="The TaaSFlow approach" wide>
          {entry.solutions?.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {entry.solutions.slice(0, 4).map((s) => (
                <li
                  key={s.title}
                  className="rounded-lg border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)]/60 p-3"
                >
                  <p className="text-sm font-semibold text-[color:var(--brand-navy)]">
                    {s.title}
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--brand-navy)]/70">
                    {s.body}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[color:var(--brand-navy)]/70">
              {entry.hero.subtitle}
            </p>
          )}
        </PanelBlock>
      </div>

      {/* CTA */}
      <div className="flex flex-col gap-4 border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="max-w-2xl">
          <p className="font-[family-name:var(--brand-font-display)] text-lg font-semibold text-[color:var(--brand-navy)]">
            {entry.cta.title}
          </p>
          <p className="mt-1 text-sm text-[color:var(--brand-navy)]/70">
            {entry.cta.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link
            to="/intake"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Start hiring in {entry.name}
          </Link>
          <Link
            to="/industries/$slug"
            params={{ slug: entry.slug }}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/20 bg-white px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
          >
            Open {entry.name} page
            <ArrowUpRight className="ml-1.5 h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function PanelBlock({
  icon: Icon,
  title,
  children,
  wide = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "lg:col-span-2" : ""}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-[color:var(--brand-ocean)]" />
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-navy)]/60">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function PanelEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-[color:var(--brand-navy)]/15 p-3 text-xs text-[color:var(--brand-navy)]/55">
      {children}
    </p>
  );
}
