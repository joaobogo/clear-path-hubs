/**
 * /dev/industry-coverage — development-only route coverage report.
 *
 * Fails loudly (renders a red WARN state) if any known industry slug lacks a
 * complete configuration or an archetype mapping falls through the default.
 * In production the route returns notFound() so it is never publicly
 * accessible.
 */

import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { SiteShell, PublicPage, PublicSection } from "@/components/marketing/site-shell";
import { INDUSTRY_ENTRIES } from "@/content/industries-v2";
import {
  ALL_FAMILIES,
  FAMILY_LABEL,
  INDUSTRY_ARCHETYPE,
} from "@/content/industry-archetypes";
import { getIndustryConfig } from "@/content/industry-config";

type Row = {
  slug: string;
  name: string;
  archetype: string;
  family: string;
  warnings: string[];
  errors: string[];
};

function auditIndustries(): { rows: Row[]; totalErrors: number; totalWarnings: number } {
  const rows: Row[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const entry of INDUSTRY_ENTRIES) {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Archetype mapping must be explicit — the fallback exists as a safety
    // net, but every existing slug should have an intentional assignment.
    if (!INDUSTRY_ARCHETYPE[entry.slug]) {
      errors.push(`No archetype mapped in INDUSTRY_ARCHETYPE — falls back to "expertise-growth".`);
    }

    // Required narrative fields.
    if (!entry.meta?.title) errors.push("meta.title is missing.");
    if (!entry.meta?.description) errors.push("meta.description is missing.");
    if (!entry.hero?.title) errors.push("hero.title is missing.");
    if (!entry.hero?.subtitle) errors.push("hero.subtitle is missing.");
    if (!entry.cta?.title || !entry.cta?.description) errors.push("cta is incomplete.");

    // Content depth checks (warnings — page still renders, but a shallow
    // industry looks weaker than its neighbours).
    const chCount = entry.challenges?.length ?? 0;
    if (chCount < 3) warnings.push(`Only ${chCount} challenges (recommend 3–5).`);
    if (chCount > 5) warnings.push(`${chCount} challenges (recommend 3–5).`);

    const roleGroupCount =
      entry.roleFamilies?.length ?? (entry.roles?.length ? 1 : 0);
    if (!roleGroupCount) errors.push("No roleFamilies or roles.");
    else if (roleGroupCount < 2) warnings.push("Fewer than 2 role families — consider expanding.");

    const signalCount = entry.signals?.length ?? 0;
    if (signalCount < 2) warnings.push(`${signalCount} signals — recommend 3+.`);

    if (!entry.faqs?.length) warnings.push("No FAQs — JSON-LD skipped.");
    if (!entry.relatedIndustries?.length) warnings.push("No relatedIndustries.");

    const cfg = getIndustryConfig(entry);
    rows.push({
      slug: entry.slug,
      name: entry.name,
      archetype: cfg.archetype,
      family: FAMILY_LABEL[cfg.family],
      warnings,
      errors,
    });

    totalErrors += errors.length;
    totalWarnings += warnings.length;
  }

  return { rows, totalErrors, totalWarnings };
}

export const Route = createFileRoute("/dev/industry-coverage")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  head: () => ({
    meta: [
      { title: "Dev · Industry coverage" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: IndustryCoverage,
  notFoundComponent: () => (
    <SiteShell>
      <PublicPage>
        <p className="py-24 text-sm text-[color:var(--brand-navy)]/60">Not found.</p>
      </PublicPage>
    </SiteShell>
  ),
  errorComponent: ({ error }) => (
    <SiteShell>
      <PublicPage>
        <p className="py-24 text-sm text-red-600">Coverage check failed: {String(error)}</p>
      </PublicPage>
    </SiteShell>
  ),
});

function IndustryCoverage() {
  const { rows, totalErrors, totalWarnings } = auditIndustries();
  const byFamily = new Map<string, Row[]>();
  for (const r of rows) {
    const list = byFamily.get(r.family) ?? [];
    list.push(r);
    byFamily.set(r.family, list);
  }

  return (
    <SiteShell>
      <PublicSection className="border-b border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] py-10">
        <PublicPage>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-ocean)]">
            Dev · not indexed
          </p>
          <h1 className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
            Industry coverage report
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-[color:var(--brand-navy)]/70">
            {rows.length} industries · {ALL_FAMILIES.length} archetypes ·{" "}
            <span className={totalErrors ? "font-semibold text-red-600" : "text-emerald-700"}>
              {totalErrors} errors
            </span>{" "}
            ·{" "}
            <span className={totalWarnings ? "font-semibold text-amber-700" : "text-emerald-700"}>
              {totalWarnings} warnings
            </span>
          </p>
          <div className="mt-4">
            <Link
              to="/industries"
              className="text-sm font-semibold text-[color:var(--brand-ocean)] underline underline-offset-4"
            >
              ← Back to /industries
            </Link>
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-8">
        <PublicPage>
          {[...byFamily.entries()].map(([family, list]) => (
            <div key={family} className="mb-10">
              <h2 className="font-[family-name:var(--brand-font-display)] text-xl font-semibold text-[color:var(--brand-navy)]">
                {family}{" "}
                <span className="text-sm font-normal text-[color:var(--brand-navy)]/50">
                  {list.length} industries
                </span>
              </h2>
              <ul className="mt-4 divide-y divide-[color:var(--brand-navy)]/10 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white">
                {list.map((r) => (
                  <li key={r.slug} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 p-4 sm:grid-cols-[220px_1fr_auto]">
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--brand-navy)]">
                        {r.name}
                      </p>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/50">
                        {r.slug} · {r.archetype}
                      </p>
                    </div>
                    <div className="col-span-2 space-y-1 text-[13px] sm:col-span-1">
                      {r.errors.map((e) => (
                        <p key={e} className="text-red-600">
                          <span className="font-semibold">Error:</span> {e}
                        </p>
                      ))}
                      {r.warnings.map((w) => (
                        <p key={w} className="text-amber-700">
                          <span className="font-semibold">Warn:</span> {w}
                        </p>
                      ))}
                      {!r.errors.length && !r.warnings.length ? (
                        <p className="text-emerald-700">Complete — no warnings.</p>
                      ) : null}
                    </div>
                    <div className="text-right text-xs sm:col-start-3">
                      <Link
                        to="/industries/$slug"
                        params={{ slug: r.slug }}
                        className="font-semibold text-[color:var(--brand-ocean)] underline underline-offset-4"
                      >
                        View →
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </PublicPage>
      </PublicSection>
    </SiteShell>
  );
}
