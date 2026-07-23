import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, ArrowUpRight } from "lucide-react";
import { INDUSTRY_ENTRIES } from "@/content/industries-v2";
import {
  EXPLORER_CATEGORIES,
  CATEGORY_BY_SLUG,
  type ExplorerCategory,
} from "@/components/marketing/industry-explorer";
import { getIndustryVisualIdentity } from "@/content/industry-visual-identity";
import { IndustryHeroBackdrop } from "@/components/marketing/industry-hero-backdrop";

const CATEGORY_META: Record<
  ExplorerCategory,
  { blurb: string; tint: string }
> = {
  "Technology & Digital": {
    blurb: "Engineering, product, data, security and digital businesses.",
    tint: "from-indigo-500/10 to-transparent",
  },
  "Financial & Professional": {
    blurb: "Capital markets, advisory, legal, insurance and professional services.",
    tint: "from-sky-500/10 to-transparent",
  },
  "People & Commercial": {
    blurb: "Go-to-market, product, design and consumer-facing verticals.",
    tint: "from-rose-500/10 to-transparent",
  },
  "Health & Social Impact": {
    blurb: "Healthcare, life sciences, education, public sector and non-profit.",
    tint: "from-emerald-500/10 to-transparent",
  },
  "Operations & Physical Industries": {
    blurb: "Industrial, mobility, real assets, energy and infrastructure.",
    tint: "from-amber-500/10 to-transparent",
  },
};

type Card = {
  slug: string;
  name: string;
  eyebrow: string;
  summary?: string;
  category: ExplorerCategory;
};

const ALL_CARDS: Card[] = [...INDUSTRY_ENTRIES]
  .map((e) => ({
    slug: e.slug,
    name: e.name,
    eyebrow: e.eyebrow,
    summary: e.summary,
    category:
      CATEGORY_BY_SLUG[e.slug] ?? ("Operations & Physical Industries" as ExplorerCategory),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

function IndustryCard({ card }: { card: Card }) {
  const v = getIndustryVisualIdentity(card.slug);
  return (
    <Link
      to="/industries/$slug"
      params={{ slug: card.slug }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white transition hover:-translate-y-0.5 hover:border-[color:var(--brand-ocean)]/40 hover:shadow-lg"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${v.gradient}`} />
        <div className={`absolute inset-0 ${v.accent}`}>
          {/* reuse pattern via backdrop, but hide its label */}
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
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4 text-white">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/75">
              {card.eyebrow}
            </p>
            <p className="mt-0.5 font-[family-name:var(--brand-font-display)] text-xl font-semibold tracking-tight sm:text-2xl">
              {card.name}
            </p>
          </div>
          <span className="rounded-full bg-white/15 p-1.5 opacity-0 backdrop-blur transition group-hover:opacity-100">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      </div>
      {card.summary ? (
        <p className="line-clamp-2 px-4 py-3 text-sm text-[color:var(--brand-navy)]/70">
          {card.summary}
        </p>
      ) : null}
    </Link>
  );
}

export function IndustryGallery() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!q) return null;
    return ALL_CARDS.filter((c) =>
      [c.name, c.eyebrow, c.summary ?? "", c.slug].join(" ").toLowerCase().includes(q),
    );
  }, [q]);

  const grouped = useMemo(() => {
    const map = new Map<ExplorerCategory, Card[]>();
    for (const c of EXPLORER_CATEGORIES) map.set(c, []);
    for (const card of ALL_CARDS) map.get(card.category)!.push(card);
    return map;
  }, []);

  return (
    <div className="mt-8">
      {/* Sticky search + category jump */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block w-full max-w-md">
          <span className="sr-only">Search industries</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--brand-navy)]/50"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search industry, role, skill or keyword"
            className="w-full rounded-full border border-[color:var(--brand-navy)]/15 bg-white py-2.5 pl-9 pr-4 text-sm text-[color:var(--brand-navy)] placeholder:text-[color:var(--brand-navy)]/50 focus:border-[color:var(--brand-ocean)] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus-ring)]"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {EXPLORER_CATEGORIES.map((c) => (
            <a
              key={c}
              href={`#cat-${c.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
              className="rounded-full border border-[color:var(--brand-navy)]/15 bg-white px-3 py-1.5 text-xs font-medium text-[color:var(--brand-navy)]/80 hover:border-[color:var(--brand-ocean)]/40 hover:text-[color:var(--brand-navy)]"
            >
              {c.split(" ")[0]}{" "}
              <span className="ml-1 text-[color:var(--brand-navy)]/50">
                {grouped.get(c)?.length ?? 0}
              </span>
            </a>
          ))}
        </div>
      </div>

      {/* Search results view */}
      {matches ? (
        <div className="mt-10">
          <p className="text-sm text-[color:var(--brand-navy)]/60">
            {matches.length} match{matches.length === 1 ? "" : "es"} for "{query}"
          </p>
          {matches.length === 0 ? (
            <p className="mt-6 text-sm text-[color:var(--brand-navy)]/70">
              No industries matched. Try another role, skill or keyword.
            </p>
          ) : (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {matches.map((c) => (
                <IndustryCard key={c.slug} card={c} />
              ))}
            </div>
          )}
        </div>
      ) : (
        // Category sections
        <div className="mt-12 space-y-16">
          {EXPLORER_CATEGORIES.map((cat) => {
            const cards = grouped.get(cat) ?? [];
            const meta = CATEGORY_META[cat];
            const id = `cat-${cat.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
            return (
              <section
                key={cat}
                id={id}
                className={`relative scroll-mt-24 rounded-3xl border border-[color:var(--brand-navy)]/10 bg-gradient-to-b ${meta.tint} p-6 sm:p-8`}
              >
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="max-w-2xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-ocean)]">
                      Category · {cards.length} industries
                    </p>
                    <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
                      {cat}
                    </h2>
                    <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">
                      {meta.blurb}
                    </p>
                  </div>
                </div>
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {cards.map((c) => (
                    <IndustryCard key={c.slug} card={c} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
