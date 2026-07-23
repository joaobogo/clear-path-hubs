import { useMemo, useState } from "react";
import type { IndustryEntry, IndustryRoleFamily } from "@/content/industries-v2";

/**
 * Interactive role explorer. Selecting a role family updates the right pane
 * with role summary, typical requirements, candidate signals, key skills,
 * validation areas and sample evidence — all derived from the industry
 * entry so no per-industry code fork is required. Data is presentational
 * only; nothing here reads production candidate data.
 */
export function IndustryRoleExplorer({ entry }: { entry: IndustryEntry }) {
  const families: IndustryRoleFamily[] = useMemo(
    () =>
      entry.roleFamilies && entry.roleFamilies.length > 0
        ? entry.roleFamilies
        : [
            {
              name: `${entry.name} roles`,
              blurb: `Roles TaaSFlow sources in ${entry.name}.`,
              roles: entry.roles,
            },
          ],
    [entry],
  );

  const [activeIdx, setActiveIdx] = useState(0);
  const active = families[activeIdx];

  const requirements = (entry.challenges ?? []).slice(0, 3).map((c) => c.title);
  const signalTitles = (entry.candidateSignals ?? []).slice(0, 4).map((s) => s.title);
  const skills = (entry.skills ?? []).slice(0, 6);
  const validationAreas = (entry.regulatedRequirements ?? entry.certifications ?? []).slice(0, 4);
  const primaryRole = active.roles[0] ?? entry.roles[0] ?? `${entry.name} specialist`;
  const evidenceQuote = `“Led a ${active.name.toLowerCase()} initiative delivering measurable outcomes for a ${entry.name.toLowerCase()} team — scope, stack and stakeholders documented on the CV.”`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <div
        role="tablist"
        aria-label={`${entry.name} role families`}
        className="flex flex-col gap-2"
      >
        {families.map((fam, idx) => {
          const selected = idx === activeIdx;
          return (
            <button
              key={fam.name}
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveIdx(idx)}
              className={[
                "min-h-11 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                selected
                  ? "border-[color:var(--brand-ocean)] bg-[color:var(--brand-ocean)]/10 text-[color:var(--brand-navy)]"
                  : "border-[color:var(--brand-navy)]/10 bg-white text-[color:var(--brand-navy)]/85 hover:border-[color:var(--brand-ocean)]/40",
              ].join(" ")}
            >
              <span className="block font-semibold">{fam.name}</span>
              {fam.blurb ? (
                <span className="mt-1 block text-xs text-[color:var(--brand-navy)]/60">
                  {fam.blurb}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 motion-safe:transition-[background-color]">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold text-[color:var(--brand-navy)]">
            {active.name}
          </h3>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean)]">
            {entry.name}
          </span>
        </div>
        {active.blurb ? (
          <p className="mt-2 max-w-2xl text-sm text-[color:var(--brand-navy)]/75">
            {active.blurb}
          </p>
        ) : null}

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <ExplorerBlock title="Typical roles" items={active.roles.slice(0, 6)} />
          <ExplorerBlock title="Common requirements" items={requirements.length ? requirements : ["Documented delivery evidence", "Stack fit for the role", "Scope appropriate to seniority"]} />
          <ExplorerBlock title="Candidate signals" items={signalTitles.length ? signalTitles : ["Relevant experience", "Industry exposure", "Achievements"]} />
          <ExplorerBlock title="Key skills" items={skills.length ? skills : ["Domain expertise"]} />
          {validationAreas.length ? (
            <ExplorerBlock title="Validation areas" items={validationAreas} />
          ) : null}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/55">
              Sample evidence
            </p>
            <blockquote className="mt-2 rounded-xl bg-[color:var(--brand-mist)]/60 p-4 text-sm italic text-[color:var(--brand-navy)]/80">
              {evidenceQuote}
              <footer className="mt-2 not-italic text-xs text-[color:var(--brand-navy)]/55">
                Illustrative — quoted from candidate CVs in the workspace.
              </footer>
            </blockquote>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[color:var(--brand-navy)]/10 pt-5">
          <p className="text-sm text-[color:var(--brand-navy)]/70">
            Hiring a <span className="font-semibold text-[color:var(--brand-navy)]">{primaryRole}</span>?
          </p>
          <a
            href="/intake"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Start intake
          </a>
        </div>
      </div>
    </div>
  );
}

function ExplorerBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/55">
        {title}
      </p>
      <ul className="mt-2 space-y-1.5 text-sm text-[color:var(--brand-navy)]/85">
        {items.map((it) => (
          <li key={it} className="flex gap-2">
            <span
              aria-hidden
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-ocean)]"
            />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
