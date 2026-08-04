import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Rss, ExternalLink, ArrowRight } from "lucide-react";

import { marketingHead } from "@/lib/marketing/head";
import { SiteShell, PublicPage, PublicSection } from "@/components/marketing/site-shell";
import { AgentRunsPreview } from "@/components/marketing/product-preview/agent-runs-preview";
import { IntelligencePreview } from "@/components/marketing/product-preview/intelligence-preview";
import { LifecyclePreview } from "@/components/marketing/product-preview/lifecycle-preview";
import { DecisionWorkspacePreview } from "@/components/marketing/product-preview/decision-workspace-preview";
import {
  CHANGELOG_RELEASES,
  CHANGELOG_LAST_UPDATED,
  formatReleaseDate,
  usedAreas,
  usedCategories,
  type ChangelogCategory,
  type ChangelogEntry,
  type PreviewKind,
  type ProductArea,
} from "@/config/changelog";

export const Route = createFileRoute("/changelog")({
  head: () =>
    marketingHead(undefined, "/changelog", {
      title: "Changelog — what shipped in the TaaSFlow platform",
      description:
        "Verified releases for the TaaSFlow AI Hiring Intelligence Platform: what changed, what it affects, which product area it touches and who has access.",
    }),
  component: ChangelogPage,
});

/* ------------------------------------------------------------------ tokens */

const CATEGORY_TONE: Record<ChangelogCategory, string> = {
  New: "border-emerald-600/25 bg-emerald-600/[0.08] text-emerald-800",
  Improved: "border-[color:var(--brand-navy)]/20 bg-[color:var(--brand-navy)]/[0.06] text-[color:var(--brand-navy)]",
  Fixed: "border-sky-600/25 bg-sky-600/[0.07] text-sky-800",
  Security: "border-amber-500/30 bg-amber-500/[0.08] text-amber-800",
  Integration: "border-violet-500/25 bg-violet-500/[0.07] text-violet-800",
  Developer: "border-slate-500/25 bg-slate-500/[0.07] text-slate-700",
};

const PREVIEWS: Record<PreviewKind, React.ComponentType<{ className?: string }>> = {
  "agent-runs": AgentRunsPreview,
  intelligence: IntelligencePreview,
  lifecycle: LifecyclePreview,
  "decision-workspace": DecisionWorkspacePreview,
};

/* --------------------------------------------------------------- filtering */

type Filter<T> = T | "all";

function FilterRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: Filter<T>;
  onChange: (v: Filter<T>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-full text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/50 sm:w-auto">
        {label}
      </span>
      {(["all", ...options] as Filter<T>[]).map((option) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option)}
            className={`inline-flex min-h-9 items-center rounded-full border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)] ${
              active
                ? "border-[color:var(--brand-navy)] bg-[color:var(--brand-navy)] text-[color:var(--brand-paper)]"
                : "border-[color:var(--brand-navy)]/15 text-[color:var(--brand-navy)]/80 hover:border-[color:var(--brand-navy)]/35"
            }`}
          >
            {option === "all" ? "All" : option}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ entries */

function EntryCard({ entry }: { entry: ChangelogEntry }) {
  const Preview = entry.preview ? PREVIEWS[entry.preview] : null;

  return (
    <article className="rounded-xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${CATEGORY_TONE[entry.category]}`}
        >
          {entry.category}
        </span>
        <span className="text-xs text-[color:var(--brand-navy)]/60">{entry.area}</span>
      </div>

      <h3 className="mt-3 text-base font-semibold text-[color:var(--brand-navy)]">{entry.summary}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">{entry.impact}</p>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-navy)]/45">
            Availability
          </dt>
          <dd className="mt-1 text-[color:var(--brand-navy)]/80">{entry.availability}</dd>
        </div>
        {entry.docHref ? (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-navy)]/45">
              Documentation
            </dt>
            <dd className="mt-1">
              <Link
                to={entry.docHref}
                className="inline-flex min-h-9 items-center gap-1.5 font-medium text-[color:var(--brand-navy)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
              >
                {entry.docLabel ?? "Read more"}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </dd>
          </div>
        ) : null}
      </dl>

      {Preview ? (
        <div className="mt-5">
          <Preview />
        </div>
      ) : null}
    </article>
  );
}

/* --------------------------------------------------------------------- page */

function ChangelogPage() {
  const categories = React.useMemo(usedCategories, []);
  const areas = React.useMemo(usedAreas, []);
  const [category, setCategory] = React.useState<Filter<ChangelogCategory>>("all");
  const [area, setArea] = React.useState<Filter<ProductArea>>("all");

  const releases = React.useMemo(
    () =>
      CHANGELOG_RELEASES.map((release) => ({
        ...release,
        entries: release.entries.filter(
          (e) => (category === "all" || e.category === category) && (area === "all" || e.area === area),
        ),
      })).filter((release) => release.entries.length > 0),
    [category, area],
  );

  const visibleCount = releases.reduce((n, r) => n + r.entries.length, 0);

  return (
    <SiteShell>
      <PublicSection className="pb-4">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-navy)]/50">
            Changelog
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
            What shipped in the TaaSFlow platform
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[color:var(--brand-navy)]/80">
            Every entry below is live in the product. We publish verified changes only — no roadmap items and
            no reconstructed history.
          </p>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[color:var(--brand-navy)]/70">
            <span className="inline-flex items-center gap-1.5">
              <Rss className="h-4 w-4" aria-hidden />
              Last updated {formatReleaseDate(CHANGELOG_LAST_UPDATED)}
            </span>
            <Link
              to="/status"
              className="inline-flex min-h-9 items-center gap-1.5 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
            >
              Current system status
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </p>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-0">
        <PublicPage>
          <div className="flex flex-col gap-3 rounded-xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-navy)]/[0.02] p-4 sm:p-5">
            <FilterRow label="Category" options={categories} value={category} onChange={setCategory} />
            <FilterRow label="Product area" options={areas} value={area} onChange={setArea} />
          </div>
          <p className="mt-3 text-sm text-[color:var(--brand-navy)]/60" aria-live="polite">
            Showing {visibleCount} {visibleCount === 1 ? "change" : "changes"}
          </p>
        </PublicPage>
      </PublicSection>

      <PublicSection>
        <PublicPage>
          {releases.length === 0 ? (
            <p className="rounded-xl border border-[color:var(--brand-navy)]/10 p-6 text-sm text-[color:var(--brand-navy)]/70">
              No changes match that combination. Clear a filter to see the full release.
            </p>
          ) : (
            <div className="flex flex-col gap-14">
              {releases.map((release) => (
                <section key={release.version} aria-labelledby={`release-${release.version}`}>
                  <div className="border-b border-[color:var(--brand-navy)]/10 pb-5">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h2
                        id={`release-${release.version}`}
                        className="text-xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-2xl"
                      >
                        {release.title}
                      </h2>
                      <span className="rounded-full border border-[color:var(--brand-navy)]/15 px-2.5 py-0.5 text-xs font-semibold text-[color:var(--brand-navy)]/70">
                        {release.version}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[color:var(--brand-navy)]/60">
                      <time dateTime={release.date}>{formatReleaseDate(release.date)}</time>
                    </p>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[color:var(--brand-navy)]/80">
                      {release.summary}
                    </p>
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    {release.entries.map((entry) => (
                      <EntryCard key={entry.id} entry={entry} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </PublicPage>
      </PublicSection>
    </SiteShell>
  );
}
