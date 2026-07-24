import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Search, Sparkles } from "lucide-react";
import {
  SiteShell,
  PublicPage,
  PublicSection,
  CtaSection,
} from "@/components/marketing/site-shell";
import { marketingHead } from "@/lib/marketing/head";
import { PageConnections } from "@/components/marketing/page-connections";
import { INDUSTRY_ENTRIES } from "@/content/industries-v2";
import {
  EXPLORER_CATEGORIES,
  CATEGORY_BY_SLUG,
  type ExplorerCategory,
} from "@/components/marketing/industry-explorer";
import { getIndustryVisualIdentity } from "@/content/industry-visual-identity";

export const Route = createFileRoute("/industries/")({
  head: () =>
    marketingHead(undefined, "/industries", {
      title: "Industries — TaaSFlow",
      description:
        "Fifty-seven industries. One recruiting model. Pick a vertical and see the rubric, roles and workspace built for it.",
    }),
  component: IndustriesIndex,
});

type Tile = {
  slug: string;
  name: string;
  category: ExplorerCategory;
  eyebrow: string;
  roleCount: number;
  summary: string;
  gradient: string;
  accent: string;
};

const TILES: Tile[] = [...INDUSTRY_ENTRIES]
  .map((e) => {
    const v = getIndustryVisualIdentity(e.slug);
    return {
      slug: e.slug,
      name: e.name,
      category:
        CATEGORY_BY_SLUG[e.slug] ??
        ("Operations & Physical Industries" as ExplorerCategory),
      eyebrow: e.eyebrow,
      roleCount: e.roles?.length ?? 0,
      summary: e.summary ?? e.hero?.subtitle ?? "",
      gradient: v.gradient,
      accent: v.accent,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const FILTERS: Array<{ key: "All" | ExplorerCategory; label: string }> = [
  { key: "All", label: "All industries" },
  ...EXPLORER_CATEGORIES.map((c) => ({
    key: c,
    label: c.replace(" & ", " · "),
  })),
];

function IndustriesIndex() {
  const [active, setActive] = useState<"All" | ExplorerCategory>("All");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return TILES.filter((t) => {
      if (active !== "All" && t.category !== active) return false;
      if (!needle) return true;
      return (
        t.name.toLowerCase().includes(needle) ||
        t.category.toLowerCase().includes(needle) ||
        t.summary.toLowerCase().includes(needle)
      );
    });
  }, [active, q]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    m.set("All", TILES.length);
    for (const c of EXPLORER_CATEGORIES) m.set(c, 0);
    for (const t of TILES) m.set(t.category, (m.get(t.category) ?? 0) + 1);
    return m;
  }, []);

  return (
    <SiteShell>
      {/* Cinematic hero */}
      <section className="relative isolate overflow-hidden bg-[color:var(--brand-navy)] text-white">
        {/* Backdrop mosaic */}
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70">
          <div className="grid h-full w-full grid-cols-6 grid-rows-3">
            {TILES.slice(0, 18).map((t, i) => (
              <div
                key={t.slug}
                className={`bg-gradient-to-br ${t.gradient}`}
                style={{ opacity: 0.55 + ((i * 17) % 5) * 0.06 }}
              />
            ))}
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(6,12,32,0.55)_45%,rgba(6,12,32,0.92)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,12,32,0.55)_0%,transparent_35%,rgba(6,12,32,0.85)_100%)]" />
        </div>

        <PublicPage className="relative py-24 sm:py-32 lg:py-40">
          <div className="max-w-4xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/85 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              57 industries · one model
            </p>
            <h1 className="mt-6 font-[family-name:var(--brand-font-display)] text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Every industry, its <em className="not-italic text-white/70">own rubric.</em>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-white/75 sm:text-xl">
              Pick a vertical. See how we source, score and ship shortlists for it — with language, evidence and regulation tuned to the domain.
            </p>
          </div>
        </PublicPage>
      </section>

      {/* Sticky filter + search bar */}
      <div className="sticky top-14 z-20 border-b border-[color:var(--brand-navy)]/10 bg-white/85 backdrop-blur-md">
        <PublicPage className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
          <div className="-mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1 pb-1 sm:pb-0">
            {FILTERS.map((f) => {
              const isActive = active === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setActive(f.key)}
                  className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    isActive
                      ? "border-[color:var(--brand-navy)] bg-[color:var(--brand-navy)] text-white"
                      : "border-[color:var(--brand-navy)]/15 bg-white text-[color:var(--brand-navy)]/75 hover:border-[color:var(--brand-navy)]/40 hover:text-[color:var(--brand-navy)]"
                  }`}
                  aria-pressed={isActive}
                >
                  <span>{f.label}</span>
                  <span
                    className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${
                      isActive
                        ? "bg-white/15 text-white"
                        : "bg-[color:var(--brand-navy)]/8 text-[color:var(--brand-navy)]/60"
                    }`}
                  >
                    {counts.get(f.key) ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
          <label className="relative flex w-full items-center sm:w-72">
            <Search
              aria-hidden
              className="absolute left-3 h-4 w-4 text-[color:var(--brand-navy)]/40"
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search industries"
              className="w-full rounded-full border border-[color:var(--brand-navy)]/15 bg-white py-2 pl-9 pr-3 text-sm text-[color:var(--brand-navy)] placeholder:text-[color:var(--brand-navy)]/40 focus:border-[color:var(--brand-navy)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus-ring)]"
            />
          </label>
        </PublicPage>
      </div>

      {/* Big magazine grid */}
      <PublicSection className="py-12 sm:py-16">
        <PublicPage>
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 p-10 text-center">
              <p className="text-lg font-semibold text-[color:var(--brand-navy)]">
                No industries match “{q}”.
              </p>
              <p className="mt-2 text-sm text-[color:var(--brand-navy)]/60">
                Try a broader search or clear the filter.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((t, i) => (
                <li key={t.slug} className={i === 0 ? "sm:col-span-2 lg:col-span-2 lg:row-span-2" : ""}>
                  <IndustryTile tile={t} feature={i === 0} />
                </li>
              ))}
            </ul>
          )}
        </PublicPage>
      </PublicSection>

      {/* Enterprise strip */}
      <PublicSection className="pb-16">
        <PublicPage>
          <div className="relative overflow-hidden rounded-3xl bg-[color:var(--brand-navy)] p-8 text-white sm:p-12">
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40">
              <div className="grid h-full w-full grid-cols-8">
                {TILES.slice(20, 28).map((t) => (
                  <div key={t.slug} className={`bg-gradient-to-b ${t.gradient}`} />
                ))}
              </div>
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,12,32,0.95)_10%,rgba(6,12,32,0.4)_100%)]" />
            </div>
            <div className="relative grid gap-6 md:grid-cols-[2fr_1fr] md:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                  For enterprise
                </p>
                <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
                  Hiring across multiple industries?
                </h2>
                <p className="mt-3 max-w-xl text-white/75">
                  One workspace per business unit, one rubric per role, aggregate reporting on top. We run cross-industry programmes for enterprise account structures.
                </p>
              </div>
              <div className="flex flex-col gap-3 md:items-end">
                <Link
                  to="/enterprise"
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-white/90"
                >
                  See the enterprise model
                </Link>
                <Link
                  to="/contact"
                  className="text-sm font-semibold text-white/85 hover:text-white"
                >
                  Book enterprise consultation →
                </Link>
              </div>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow="Ready to hire?"
        title="Pick your industry. Start the intake."
        description="Submit a role and your workspace is ready when you finish the guided intake."
        primary={{ to: "/intake", label: "Start hiring" }}
        secondary={{ to: "/how-it-works", label: "See how it works" }}
      />
      <PageConnections
        commercial={{ to: "/intake", label: "Start hiring", desc: "Kick off a role in your industry." }}
        explainer={{ to: "/how-it-works", label: "How delivery works", desc: "Role blueprints, sourcing, and ranking per vertical." }}
        resource={{ to: "/case-studies", label: "Industry outcomes", desc: "Named hiring results across verticals." }}
        audience={{ to: "/solutions", label: "By team stage", desc: "Series A–C operator playbooks." }}
      />
    </SiteShell>
  );
}

function IndustryTile({ tile, feature }: { tile: Tile; feature?: boolean }) {
  return (
    <Link
      to="/industries/$slug"
      params={{ slug: tile.slug }}
      className={`group relative flex ${feature ? "aspect-[16/11] lg:aspect-auto lg:h-full lg:min-h-[420px]" : "aspect-[4/5] sm:aspect-[5/6]"} overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${tile.gradient} text-white shadow-[0_20px_60px_-30px_rgba(10,20,50,0.55)] transition-transform duration-500 hover:-translate-y-1 hover:shadow-[0_30px_80px_-30px_rgba(10,20,50,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]`}
      aria-label={`${tile.name} — open industry page`}
    >
      {/* Pattern layer */}
      <div aria-hidden className={`absolute inset-0 ${tile.accent} opacity-70 mix-blend-screen`}>
        <TilePattern seed={tile.slug} />
      </div>

      {/* Atmospheric orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/25 blur-3xl transition-transform duration-700 group-hover:scale-110"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-white/10 blur-3xl transition-transform duration-700 group-hover:scale-110"
      />

      {/* Vignette for legibility */}
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_35%,rgba(0,0,0,0.55)_100%)]" />

      {/* Content */}
      <div className="relative z-10 flex h-full w-full flex-col justify-between p-6 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90 backdrop-blur">
            {tile.category.split(" & ")[0]}
          </span>
          <span className="grid h-9 w-9 place-items-center rounded-full border border-white/30 bg-white/10 text-white transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </span>
        </div>

        <div>
          <h3
            className={`font-[family-name:var(--brand-font-display)] font-semibold leading-[1.04] tracking-tight ${
              feature ? "text-4xl sm:text-5xl lg:text-6xl" : "text-2xl sm:text-3xl"
            }`}
          >
            {tile.name}
          </h3>
          {feature && tile.summary ? (
            <p className="mt-4 max-w-xl text-base text-white/85 sm:text-lg">
              {tile.summary}
            </p>
          ) : null}
          <div className="mt-4 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-white/70">
            <span>{tile.roleCount} role families</span>
            <span aria-hidden>·</span>
            <span>Dedicated page</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// Deterministic seeded pseudo-random for tile motifs — same slug → same motif.
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function TilePattern({ seed }: { seed: string }) {
  const h = hash(seed);
  const kind = h % 4;
  if (kind === 0) {
    return (
      <svg viewBox="0 0 400 500" preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <pattern id={`g-${seed}`} x="0" y="0" width="34" height="34" patternUnits="userSpaceOnUse">
            <path d="M34 0 L0 0 L0 34" fill="none" stroke="currentColor" strokeWidth="0.9" />
          </pattern>
        </defs>
        <rect width="400" height="500" fill={`url(#g-${seed})`} />
      </svg>
    );
  }
  if (kind === 1) {
    return (
      <svg viewBox="0 0 400 500" preserveAspectRatio="none" className="h-full w-full">
        {Array.from({ length: 5 }).map((_, i) => (
          <path
            key={i}
            d={`M0,${80 + i * 90} Q100,${40 + i * 90} 200,${80 + i * 90} T400,${80 + i * 90}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4 - i * 0.2}
            opacity={0.9 - i * 0.15}
          />
        ))}
      </svg>
    );
  }
  if (kind === 2) {
    return (
      <svg viewBox="0 0 400 500" preserveAspectRatio="none" className="h-full w-full">
        {Array.from({ length: 60 }).map((_, i) => (
          <circle
            key={i}
            cx={((i * 53 + h) % 400)}
            cy={((i * 71 + h) % 500)}
            r={1 + ((i + h) % 3)}
            fill="currentColor"
            opacity={0.55}
          />
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 400 500" preserveAspectRatio="none" className="h-full w-full">
      {Array.from({ length: 12 }).map((_, i) => (
        <rect
          key={i}
          x={20 + i * 32}
          y={20 + ((i * 37 + h) % 200)}
          width="14"
          height={80 + ((i * 41 + h) % 260)}
          fill="currentColor"
          opacity={0.35}
        />
      ))}
    </svg>
  );
}
