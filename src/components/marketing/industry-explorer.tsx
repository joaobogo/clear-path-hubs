import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, ArrowRight, CheckCircle2, Sparkles, Award } from "lucide-react";
import { INDUSTRY_ENTRIES, type IndustryEntry } from "@/content/industries-v2";
import { INDUSTRY_ENTRIES_BATCH2 } from "@/content/industries-batch2";

export type ExplorerCategory =
  | "Technology & Digital"
  | "Financial & Professional"
  | "People & Commercial"
  | "Health & Social Impact"
  | "Operations & Physical Industries";

export const EXPLORER_CATEGORIES: ExplorerCategory[] = [
  "Technology & Digital",
  "Financial & Professional",
  "People & Commercial",
  "Health & Social Impact",
  "Operations & Physical Industries",
];

const CATEGORY_BY_SLUG: Record<string, ExplorerCategory> = {
  // Technology & Digital
  tech: "Technology & Digital",
  saas: "Technology & Digital",
  cybersecurity: "Technology & Digital",
  "data-analytics": "Technology & Digital",
  "ai-ml": "Technology & Digital",
  fintech: "Technology & Digital",
  healthtech: "Technology & Digital",
  edtech: "Technology & Digital",
  proptech: "Technology & Digital",
  gaming: "Technology & Digital",
  web3: "Technology & Digital",
  devops: "Technology & Digital",
  ecommerce: "Technology & Digital",
  media: "Technology & Digital",
  // Financial & Professional
  finance: "Financial & Professional",
  accounting: "Financial & Professional",
  insurance: "Financial & Professional",
  "private-equity": "Financial & Professional",
  "investment-banking": "Financial & Professional",
  "wealth-management": "Financial & Professional",
  "venture-capital": "Financial & Professional",
  consulting: "Financial & Professional",
  legal: "Financial & Professional",
  architecture: "Financial & Professional",
  "staffing-agencies": "Financial & Professional",
  "human-resources": "Financial & Professional",
  // People & Commercial
  sales: "People & Commercial",
  marketing: "People & Commercial",
  "customer-success": "People & Commercial",
  "product-management": "People & Commercial",
  design: "People & Commercial",
  retail: "People & Commercial",
  hospitality: "People & Commercial",
  fashion: "People & Commercial",
  travel: "People & Commercial",
  sports: "People & Commercial",
  // Health & Social Impact
  healthcare: "Health & Social Impact",
  pharmaceuticals: "Health & Social Impact",
  biotech: "Health & Social Impact",
  "medical-devices": "Health & Social Impact",
  nonprofit: "Health & Social Impact",
  "public-sector": "Health & Social Impact",
  education: "Health & Social Impact",
  "higher-education": "Health & Social Impact",
  defense: "Health & Social Impact",
  // Operations & Physical Industries
  "real-estate": "Operations & Physical Industries",
  construction: "Operations & Physical Industries",
  manufacturing: "Operations & Physical Industries",
  logistics: "Operations & Physical Industries",
  automotive: "Operations & Physical Industries",
  energy: "Operations & Physical Industries",
  "renewable-energy": "Operations & Physical Industries",
  "oil-gas": "Operations & Physical Industries",
  agriculture: "Operations & Physical Industries",
  "food-beverage": "Operations & Physical Industries",
  telecom: "Operations & Physical Industries",
  aviation: "Operations & Physical Industries",
};

type Decorated = IndustryEntry & { explorerCategory: ExplorerCategory };

const ALL_ENTRIES: Decorated[] = [...INDUSTRY_ENTRIES, ...INDUSTRY_ENTRIES_BATCH2]
  .map((e) => ({
    ...e,
    explorerCategory:
      CATEGORY_BY_SLUG[e.slug] ?? "Operations & Physical Industries",
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function IndustryExplorer({ compact = false }: { compact?: boolean }) {
  const [category, setCategory] = useState<ExplorerCategory>(
    "Technology & Digital",
  );
  const [query, setQuery] = useState("");
  const [activeSlug, setActiveSlug] = useState<string>("tech");

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    return ALL_ENTRIES.filter((e) => {
      if (q) {
        const hay = [
          e.name,
          e.summary ?? "",
          (e.aliases ?? []).join(" "),
          e.roles.join(" "),
          (e.skills ?? []).join(" "),
          (e.certifications ?? []).join(" "),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      }
      return e.explorerCategory === category;
    });
  }, [q, category]);

  const active =
    filtered.find((e) => e.slug === activeSlug) ??
    filtered[0] ??
    ALL_ENTRIES[0];

  const counts = useMemo(() => {
    const map: Record<ExplorerCategory, number> = {
      "Technology & Digital": 0,
      "Financial & Professional": 0,
      "People & Commercial": 0,
      "Health & Social Impact": 0,
      "Operations & Physical Industries": 0,
    };
    for (const e of ALL_ENTRIES) map[e.explorerCategory] += 1;
    return map;
  }, []);

  return (
    <div className="mt-8">
      {/* Category rail + search */}
      <div className="flex flex-col gap-4">
        <div
          role="tablist"
          aria-label="Industry categories"
          className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          {EXPLORER_CATEGORIES.map((c) => {
            const isActive = c === category && !q;
            return (
              <button
                key={c}
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setCategory(c);
                  setQuery("");
                }}
                className={`inline-flex shrink-0 snap-start items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "border-[color:var(--brand-navy)] bg-[color:var(--brand-navy)] text-white"
                    : "border-[color:var(--brand-navy)]/15 bg-white text-[color:var(--brand-navy)] hover:border-[color:var(--brand-ocean)]/40"
                }`}
              >
                <span className="truncate">{c}</span>
                <span
                  className={`rounded-full px-1.5 text-[10px] font-bold ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-[color:var(--brand-mist)] text-[color:var(--brand-navy)]/70"
                  }`}
                >
                  {counts[c]}
                </span>
              </button>
            );
          })}
        </div>

        <label className="relative block max-w-md">
          <span className="sr-only">Search industries, roles, skills</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--brand-navy)]/50"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search industry, role, skill, certification or alias"
            className="w-full rounded-full border border-[color:var(--brand-navy)]/15 bg-white py-2.5 pl-9 pr-4 text-sm text-[color:var(--brand-navy)] placeholder:text-[color:var(--brand-navy)]/50 focus:border-[color:var(--brand-ocean)] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus-ring)]"
          />
        </label>
      </div>

      {/* Body */}
      <div className="mt-6 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Industry list */}
        <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white">
          <div className="border-b border-[color:var(--brand-navy)]/10 px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-[color:var(--brand-navy)]/60">
            {q ? `${filtered.length} matches` : `${filtered.length} industries`}
          </div>
          <ul
            role="listbox"
            aria-label="Industries"
            className="max-h-[420px] overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-4 py-6 text-sm text-[color:var(--brand-navy)]/60">
                No matches. Try a role, skill or certification.
              </li>
            ) : (
              filtered.map((e) => {
                const isActive = e.slug === active.slug;
                return (
                  <li key={e.slug}>
                    <button
                      role="option"
                      aria-selected={isActive}
                      onClick={() => setActiveSlug(e.slug)}
                      className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition ${
                        isActive
                          ? "bg-[color:var(--brand-ocean)]/10 font-semibold text-[color:var(--brand-navy)]"
                          : "text-[color:var(--brand-navy)]/85 hover:bg-[color:var(--brand-mist)]/50"
                      }`}
                    >
                      <span className="truncate">{e.name}</span>
                      {isActive ? (
                        <ArrowRight
                          className="h-3.5 w-3.5 shrink-0 text-[color:var(--brand-ocean)]"
                          aria-hidden
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        {/* Detail panel */}
        <IndustryDetail entry={active} compact={compact} />
      </div>
    </div>
  );
}

function IndustryDetail({
  entry,
  compact,
}: {
  entry: Decorated;
  compact: boolean;
}) {
  const challenge = entry.challenges[0];
  const approach = entry.solutions?.[0] ?? entry.candidateSignals?.[0];
  const signals = entry.candidateSignals?.slice(0, 3) ?? [];
  const skills = (entry.skills ?? []).slice(0, compact ? 6 : 12);
  const certs = (entry.certifications ?? []).slice(0, compact ? 3 : 6);
  const roles = entry.roles.slice(0, compact ? 4 : 8);

  return (
    <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--brand-ocean)]">
            {entry.explorerCategory}
          </p>
          <h3 className="mt-1 font-[family-name:var(--brand-font-display)] text-2xl font-semibold text-[color:var(--brand-navy)] sm:text-3xl">
            {entry.name}
          </h3>
          {entry.aliases && entry.aliases.length > 0 ? (
            <p className="mt-1 text-xs text-[color:var(--brand-navy)]/55">
              Also: {entry.aliases.slice(0, 4).join(" · ")}
            </p>
          ) : null}
        </div>
        <Link
          to="/industries/$slug"
          params={{ slug: entry.slug }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[color:var(--brand-navy)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[color:var(--brand-ocean)]"
        >
          Open industry page
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      {entry.summary ? (
        <p className="mt-4 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">
          {entry.summary}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {challenge ? (
          <Panel
            eyebrow="The challenge"
            title={challenge.title}
            body={challenge.body}
            tone="mist"
          />
        ) : null}
        {approach ? (
          <Panel
            eyebrow="TaaSFlow approach"
            title={approach.title}
            body={approach.body}
            tone="ocean"
          />
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--brand-navy)]/55">
            Typical roles
          </div>
          <ul className="mt-2 grid grid-cols-1 gap-1.5">
            {roles.map((r) => (
              <li
                key={r}
                className="flex items-start gap-2 text-sm text-[color:var(--brand-navy)]/85"
              >
                <CheckCircle2
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--brand-ocean)]"
                  aria-hidden
                />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          {signals.length > 0 ? (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--brand-navy)]/55">
                Candidate signals evaluated
              </div>
              <ul className="mt-2 space-y-1.5">
                {signals.map((s) => (
                  <li
                    key={s.title}
                    className="flex items-start gap-2 text-xs text-[color:var(--brand-navy)]/80"
                  >
                    <Sparkles
                      className="mt-0.5 h-3 w-3 shrink-0 text-[color:var(--brand-ocean)]"
                      aria-hidden
                    />
                    <span>
                      <span className="font-semibold text-[color:var(--brand-navy)]">
                        {s.title}.
                      </span>{" "}
                      {s.body}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {skills.length > 0 ? (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--brand-navy)]/55">
                Relevant skills
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-[color:var(--brand-mist)]/60 px-2.5 py-0.5 text-[11px] font-medium text-[color:var(--brand-navy)]/80"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {certs.length > 0 ? (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--brand-navy)]/55">
                Certifications
              </div>
              <ul className="mt-2 space-y-1">
                {certs.map((c) => (
                  <li
                    key={c}
                    className="flex items-center gap-2 text-xs text-[color:var(--brand-navy)]/80"
                  >
                    <Award
                      className="h-3 w-3 shrink-0 text-[color:var(--brand-ocean)]"
                      aria-hidden
                    />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Panel({
  eyebrow,
  title,
  body,
  tone,
}: {
  eyebrow: string;
  title: string;
  body: string;
  tone: "mist" | "ocean";
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        tone === "ocean"
          ? "border-[color:var(--brand-ocean)]/20 bg-[color:var(--brand-ocean)]/5"
          : "border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40"
      }`}
    >
      <div
        className={`text-[10px] font-semibold uppercase tracking-widest ${
          tone === "ocean"
            ? "text-[color:var(--brand-ocean)]"
            : "text-[color:var(--brand-navy)]/60"
        }`}
      >
        {eyebrow}
      </div>
      <div className="mt-1 text-sm font-semibold text-[color:var(--brand-navy)]">
        {title}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-[color:var(--brand-navy)]/75">
        {body}
      </p>
    </div>
  );
}
