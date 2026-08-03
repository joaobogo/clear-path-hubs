import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate, stripSearchParams } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { ArrowRight, Search, X } from "lucide-react";
import {
  SiteShell,
  PublicPage,
  PublicSection,
} from "@/components/marketing/site-shell";
import { marketingHead } from "@/lib/marketing/head";
import { INDUSTRY_ENTRIES } from "@/content/industries-v2";
import {
  ALL_FAMILIES,
  FAMILY_LABEL,
  FAMILY_TAGLINE,
  type IndustryFamily,
} from "@/content/industry-archetypes";
import { getIndustryConfig } from "@/content/industry-config";
import { toPublicSlug } from "@/lib/marketing/industry-slug-aliases";
import {
  BookACallDialog,
} from "@/components/marketing/book-a-call";

/**
 * /industries — deep sector-expertise library entrance.
 *
 * Editorial hero (no giant decorative photo, no repetition of individual
 * industry-page heroes), fast client search + family filters with URL
 * state, ItemList JSON-LD for indexing, accessible reset, methodology
 * explainer and a "can't find your industry?" contact CTA.
 */

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  family: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/industries/")({
  validateSearch: zodValidator(searchSchema),
  search: {
    middlewares: [stripSearchParams({ q: "", family: "" })],
  },
  head: () =>
    marketingHead(undefined, "/industries", {
      title: "Industries — TaaSFlow",
      description:
        "Fifty-seven industries, six page archetypes, one recruiting model. Search or filter to the vertical you hire for.",
    }),
  component: IndustriesIndex,
});

type Tile = {
  slug: string;
  publicSlug: string;
  name: string;
  eyebrow: string;
  family: IndustryFamily;
  familyLabel: string;
  challenge: { title: string; body: string } | null;
  roleGroups: string[];
  motifSeed: number;
  paletteToken: IndustryFamily;
};

const TILES: Tile[] = INDUSTRY_ENTRIES.map((entry) => {
  const cfg = getIndustryConfig(entry);
  const roleGroups =
    entry.roleFamilies?.slice(0, 3).map((rf) => rf.name) ??
    entry.roles.slice(0, 3);
  return {
    slug: entry.slug,
    publicSlug: cfg.publicSlug,
    name: entry.name,
    eyebrow: entry.eyebrow,
    family: cfg.family,
    familyLabel: cfg.familyLabel,
    challenge: entry.challenges?.[0] ?? null,
    roleGroups,
    motifSeed: hashSeed(entry.slug),
    paletteToken: cfg.family,
  };
}).sort((a, b) => a.name.localeCompare(b.name));

function IndustriesIndex() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/industries/" });
  const resultsRef = useRef<HTMLHeadingElement>(null);
  const [inputQ, setInputQ] = useState(search.q);

  useEffect(() => {
    setInputQ(search.q);
  }, [search.q]);

  const activeFamily: IndustryFamily | "all" = useMemo(() => {
    const f = search.family as IndustryFamily;
    return ALL_FAMILIES.includes(f) ? f : "all";
  }, [search.family]);

  const filtered = useMemo(() => {
    const needle = inputQ.trim().toLowerCase();
    return TILES.filter((t) => {
      if (activeFamily !== "all" && t.family !== activeFamily) return false;
      if (!needle) return true;
      return (
        t.name.toLowerCase().includes(needle) ||
        t.familyLabel.toLowerCase().includes(needle) ||
        (t.challenge?.title.toLowerCase().includes(needle) ?? false) ||
        t.roleGroups.some((r) => r.toLowerCase().includes(needle))
      );
    });
  }, [inputQ, activeFamily]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: TILES.length };
    for (const fam of ALL_FAMILIES) m[fam] = 0;
    for (const t of TILES) m[t.family] = (m[t.family] ?? 0) + 1;
    return m;
  }, []);

  function setFamily(fam: IndustryFamily | "all") {
    navigate({
      search: (prev: { q: string; family: string }) => ({ ...prev, family: fam === "all" ? "" : fam }),
      resetScroll: false,
    });
    // Announce and focus the results heading for screen readers.
    setTimeout(() => resultsRef.current?.focus(), 30);
  }

  function commitQuery(next: string) {
    navigate({
      search: (prev: { q: string; family: string }) => ({ ...prev, q: next.trim() }),
      resetScroll: false,
    });
  }

  function reset() {
    setInputQ("");
    navigate({ search: () => ({ q: "", family: "" }), resetScroll: false });
    setTimeout(() => resultsRef.current?.focus(), 30);
  }

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: filtered.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${t.name} hiring — TaaSFlow`,
      url: `https://www.taasflow.com/industries/${t.publicSlug}`,
    })),
  };

  return (
    <SiteShell>
      {/* ================================================================
       *  EDITORIAL HERO
       * ================================================================ */}
      <PublicSection className="border-b border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] py-14 sm:py-20">
        <PublicPage>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-ocean-text)]">
            Industries · Sector expertise
          </p>
          <h1 className="mt-5 max-w-[24ch] font-[family-name:var(--brand-font-display)] text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-5xl md:text-6xl">
            Hiring intelligence, tuned to the realities of each industry.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[color:var(--brand-navy)]/80">
            One recruiting model, six page archetypes, and a rubric calibrated to
            the language, evidence and regulation of every sector we serve.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <BookACallDialog
              trigger={
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
                >
                  Discuss your hiring needs
                </button>
              }
            />
            <Link
              to="/how-it-works"
              hash="scoring"
              className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md px-3 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)]/80 hover:text-[color:var(--brand-navy)]"
            >
              See how scoring works <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </PublicPage>
      </PublicSection>

      {/* ================================================================
       *  DISCOVERY BAR
       * ================================================================ */}
      <div className="sticky top-14 z-20 border-b border-[color:var(--brand-navy)]/10 bg-white/95 backdrop-blur-md">
        <PublicPage className="py-4">
          <form
            role="search"
            aria-label="Industries"
            onSubmit={(e) => {
              e.preventDefault();
              commitQuery(inputQ);
              setTimeout(() => resultsRef.current?.focus(), 30);
            }}
            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <label className="relative flex w-full items-center">
              <Search
                aria-hidden
                className="absolute left-3 h-4 w-4 text-[color:var(--brand-navy)]/80"
              />
              <input
                type="search"
                value={inputQ}
                onChange={(e) => {
                  setInputQ(e.target.value);
                  commitQuery(e.target.value);
                }}
                placeholder="Search by industry, role group or challenge"
                aria-label="Search industries"
                className="w-full rounded-full border border-[color:var(--brand-navy)]/15 bg-white py-2.5 pl-9 pr-9 text-sm text-[color:var(--brand-navy)] placeholder:text-[color:var(--brand-navy)]/80 focus:border-[color:var(--brand-navy)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus-ring)]"
              />
              {inputQ ? (
                <button
                  type="button"
                  onClick={() => {
                    setInputQ("");
                    commitQuery("");
                  }}
                  className="absolute right-2 grid h-7 w-7 place-items-center rounded-full text-[color:var(--brand-navy)]/80 hover:bg-[color:var(--brand-navy)]/5 hover:text-[color:var(--brand-navy)]"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </label>
            {activeFamily !== "all" || inputQ ? (
              <button
                type="button"
                onClick={reset}
                className="justify-self-start rounded-full border border-[color:var(--brand-navy)]/15 px-4 py-2 text-xs font-semibold text-[color:var(--brand-navy)]/80 hover:bg-[color:var(--brand-navy)]/5"
              >
                View all industries
              </button>
            ) : null}
          </form>

          {/* Family filters */}
          <div
            role="tablist"
            aria-label="Filter by industry family"
            className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1"
          >
            <FamilyChip
              active={activeFamily === "all"}
              onClick={() => setFamily("all")}
              label="All industries"
              count={counts.all}
            />
            {ALL_FAMILIES.map((fam) => (
              <FamilyChip
                key={fam}
                active={activeFamily === fam}
                onClick={() => setFamily(fam)}
                label={FAMILY_LABEL[fam]}
                count={counts[fam] ?? 0}
              />
            ))}
          </div>
        </PublicPage>
      </div>

      {/* ================================================================
       *  RESULTS
       * ================================================================ */}
      <PublicSection className="py-10 sm:py-14">
        <PublicPage>
          <h2
            ref={resultsRef}
            tabIndex={-1}
            className="sr-only focus:not-sr-only focus:mb-2 focus:block focus:text-sm focus:text-[color:var(--brand-navy)]/80 focus:outline-none"
          >
            {activeFamily === "all"
              ? `Showing ${filtered.length} of ${TILES.length} industries`
              : `Showing ${filtered.length} ${FAMILY_LABEL[activeFamily]} ${filtered.length === 1 ? "industry" : "industries"}`}
          </h2>
          <p
            aria-live="polite"
            className="mb-6 text-sm text-[color:var(--brand-navy)]/80"
          >
            {activeFamily === "all"
              ? `${filtered.length} industries`
              : `${filtered.length} in ${FAMILY_LABEL[activeFamily]}`}
            {inputQ ? ` matching “${inputQ}”` : ""}
          </p>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 p-10 text-center">
              <p className="text-lg font-semibold text-[color:var(--brand-navy)]">
                No industries match your search.
              </p>
              <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">
                Try a broader query, clear filters, or contact us — we may serve
                the vertical without a dedicated page yet.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-full bg-[color:var(--brand-navy)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
                >
                  View all industries
                </button>
                <Link
                  to="/contact"
                  className="rounded-full border border-[color:var(--brand-navy)]/20 px-4 py-2 text-xs font-semibold text-[color:var(--brand-navy)]/85 hover:bg-[color:var(--brand-navy)]/5"
                >
                  Talk to us about your industry
                </Link>
              </div>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((t) => (
                <li key={t.slug}>
                  <IndustryCard tile={t} />
                </li>
              ))}
            </ul>
          )}
        </PublicPage>
      </PublicSection>

      {/* ================================================================
       *  METHODOLOGY EXPLAINER
       * ================================================================ */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] py-14">
        <PublicPage>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-ocean-text)]">
                Methodology
              </p>
              <h2 className="mt-3 max-w-2xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
                How industry-specific evaluation works
              </h2>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[color:var(--brand-navy)]/80">
                Every industry gets a rubric calibrated to what actually matters
                in that sector — the language on the CV, the credentials that
                gate the role, the signals that predict delivery. Nothing is
                borrowed from a generic template.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/how-it-works"
                  hash="scoring"
                  className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                >
                  See the scoring methodology <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  to="/how-it-works"
                  className="inline-flex min-h-11 items-center justify-center rounded-md px-3 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)]/80 hover:text-[color:var(--brand-navy)]"
                >
                  How delivery works
                </Link>
              </div>
            </div>
            <ol className="space-y-3">
              {[
                { t: "Sector-specific rubric", b: "Signals, credentials and outcomes match the industry — not a generic sourcing template." },
                { t: "Evidence quoted from the CV", b: "Every score point ties to a specific sentence pulled from the candidate's document." },
                { t: "Reviewed before delivery", b: "A partner reviews each shortlist against the role, jurisdiction and delivery expectations." },
                { t: "Same workflow across sectors", b: "One workspace, one intake, one commercial model — with content that adapts per industry." },
              ].map((row, i) => (
                <li
                  key={row.t}
                  className="flex items-start gap-3 rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-4"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[color:var(--brand-navy)] text-[10px] font-semibold text-white">
                    0{i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--brand-navy)]">
                      {row.t}
                    </p>
                    <p className="mt-0.5 text-[13px] text-[color:var(--brand-navy)]/80">
                      {row.b}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </PublicPage>
      </PublicSection>

      {/* ================================================================
       *  "Can't find your industry?" CTA
       * ================================================================ */}
      <PublicSection className="pb-16">
        <PublicPage>
          <div className="flex flex-col gap-6 rounded-3xl border border-[color:var(--brand-navy)]/10 bg-white p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-ocean-text)]">
                Don't see your industry?
              </p>
              <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
                We build custom rubrics for adjacent sectors.
              </h2>
              <p className="mt-3 text-[15px] text-[color:var(--brand-navy)]/80">
                Tell us what you hire for. We'll confirm coverage, share a sample
                rubric, and start a role if it's a fit.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:items-end">
              <BookACallDialog
                trigger={
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Discuss your hiring needs
                  </button>
                }
              />
              <Link
                to="/contact"
                className="text-sm font-semibold text-[color:var(--brand-navy)]/80 hover:text-[color:var(--brand-navy)]"
              >
                Or send us a message →
              </Link>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
    </SiteShell>
  );
}

/* ----------------------------------------------------------------- Family chip */

function FamilyChip({
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
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)] ${
        active
          ? "border-[color:var(--brand-navy)] bg-[color:var(--brand-navy)] text-white"
          : "border-[color:var(--brand-navy)]/15 bg-white text-[color:var(--brand-navy)]/80 hover:border-[color:var(--brand-navy)]/40 hover:text-[color:var(--brand-navy)]"
      }`}
    >
      <span>{label}</span>
      <span
        className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${
          active
            ? "bg-white/15 text-white"
            : "bg-[color:var(--brand-navy)]/5 text-[color:var(--brand-navy)]/80"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

/* ----------------------------------------------------------------- Industry card */

function IndustryCard({ tile }: { tile: Tile }) {
  return (
    <Link
      to="/industries/$slug"
      params={{ slug: tile.publicSlug }}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white transition-all duration-300 hover:-translate-y-0.5 hover:border-[color:var(--brand-ocean)]/50 hover:shadow-[0_20px_60px_-30px_rgba(10,20,50,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
      aria-label={`${tile.name} — ${tile.familyLabel}`}
    >
      {/* Family-motif band */}
      <div
        className={`relative aspect-[16/6] w-full overflow-hidden ${FAMILY_BAND_BG[tile.family]}`}
        aria-hidden
      >
        <FamilyMotif family={tile.family} seed={tile.motifSeed} />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-ocean-text)]">
          {tile.familyLabel}
        </p>
        <h3 className="mt-1 font-[family-name:var(--brand-font-display)] text-xl font-semibold text-[color:var(--brand-navy)] group-hover:text-[color:var(--brand-ocean-text)]">
          {tile.name}
        </h3>
        {tile.challenge ? (
          <p className="mt-2 line-clamp-2 text-sm text-[color:var(--brand-navy)]/80">
            <span className="font-semibold text-[color:var(--brand-navy)]">
              {tile.challenge.title}.
            </span>{" "}
            {tile.challenge.body}
          </p>
        ) : null}
        {tile.roleGroups.length ? (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {tile.roleGroups.map((r) => (
              <li
                key={r}
                className="rounded-full bg-[color:var(--brand-navy)]/5 px-2.5 py-0.5 text-[11px] font-medium text-[color:var(--brand-navy)]/80"
              >
                {r}
              </li>
            ))}
          </ul>
        ) : null}
        <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-[color:var(--brand-ocean-text)]">
          Open industry page <ArrowRight className="h-4 w-4" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

/* Family palette bands — subdued, editorial. Never a random stock photo. */
const FAMILY_BAND_BG: Record<IndustryFamily, string> = {
  "systems-capability": "bg-gradient-to-br from-[color:var(--category-systems-1)] to-[color:var(--category-systems-2)] text-white",
  "trust-compliance": "bg-gradient-to-br from-[color:var(--category-trust-1)] to-[color:var(--category-trust-2)] text-[color:var(--category-trust-fg)]",
  "risk-judgment": "bg-gradient-to-br from-[color:var(--category-risk-1)] to-[color:var(--category-risk-2)] text-[color:var(--category-risk-fg)]",
  "operations-delivery": "bg-gradient-to-br from-[color:var(--category-operations-1)] to-[color:var(--category-operations-2)] text-white",
  "service-experience": "bg-gradient-to-br from-[color:var(--category-service-1)] to-[color:var(--category-service-2)] text-white",
  "expertise-growth": "bg-gradient-to-br from-[color:var(--category-expertise-1)] to-[color:var(--category-expertise-2)] text-[color:var(--category-expertise-fg)]",
};

function FamilyMotif({
  family,
  seed,
}: {
  family: IndustryFamily;
  seed: number;
}) {
  switch (family) {
    case "systems-capability":
      return (
        <svg viewBox="0 0 400 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-40">
          <defs>
            <pattern id={`sc-${seed}`} x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M24 0 L0 0 L0 24" fill="none" stroke="currentColor" strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width="400" height="100" fill={`url(#sc-${seed})`} />
        </svg>
      );
    case "trust-compliance":
      return (
        <svg viewBox="0 0 400 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-35">
          {Array.from({ length: 3 }).map((_, i) => (
            <path
              key={i}
              d={`M0,${30 + i * 20} Q100,${10 + i * 20} 200,${30 + i * 20} T400,${30 + i * 20}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.2}
            />
          ))}
        </svg>
      );
    case "risk-judgment":
      return (
        <svg viewBox="0 0 400 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-30">
          {Array.from({ length: 12 }).map((_, i) => (
            <line
              key={i}
              x1={i * 34}
              y1={0}
              x2={i * 34}
              y2={100}
              stroke="currentColor"
              strokeWidth={i % 3 === 0 ? 1.2 : 0.5}
            />
          ))}
        </svg>
      );
    case "operations-delivery":
      return (
        <svg viewBox="0 0 400 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-30">
          {Array.from({ length: 8 }).map((_, i) => (
            <rect
              key={i}
              x={20 + i * 46}
              y={50 - ((i * 13 + seed) % 30)}
              width={18}
              height={40 + ((i * 17 + seed) % 30)}
              fill="currentColor"
              opacity={0.6}
            />
          ))}
        </svg>
      );
    case "service-experience":
      return (
        <svg viewBox="0 0 400 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-40">
          {Array.from({ length: 40 }).map((_, i) => (
            <circle
              key={i}
              cx={(i * 47 + seed) % 400}
              cy={(i * 29 + seed) % 100}
              r={1 + ((i + seed) % 2)}
              fill="currentColor"
              opacity={0.7}
            />
          ))}
        </svg>
      );
    case "expertise-growth":
      return (
        <svg viewBox="0 0 400 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-35">
          {Array.from({ length: 5 }).map((_, i) => (
            <rect
              key={i}
              x={30 + i * 70}
              y={70 - i * 12}
              width={40}
              height={20 + i * 12}
              fill="currentColor"
              opacity={0.55}
            />
          ))}
        </svg>
      );
  }
}

// Family-tagline currently unused in the compact card, but exposed via a
// small explainer if we ever want to render it — kept referenced so
// consumers can lint on unused exports without breaking the API surface.
export { FAMILY_TAGLINE as INDUSTRIES_FAMILY_TAGLINES };

function hashSeed(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
