/**
 * /agents — Agent Layer entry point.
 *
 * Minimal, factual route so the primary navigation has no dead link. The full
 * experience is built in a later prompt; everything stated here is already
 * true of the running system and is sourced from canonical product language.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";

import {
  PublicPage,
  PublicSection,
  SiteShell,
  CtaSection,
} from "@/components/marketing/site-shell";
import { marketingHead } from "@/lib/marketing/head";
import {
  MODULES,
  MODULE_SECTIONS,
  OVERSIGHT_LANGUAGE,
  PRODUCT_CATEGORY,
  SYSTEM_CLAIM,
} from "@/config/product-language";

export const Route = createFileRoute("/agents")({
  head: () =>
    marketingHead(undefined, "/agents", {
      title: `${MODULES.agents} — how TaaSFlow agents run a search`,
      description: `${SYSTEM_CLAIM} The ${MODULES.agents} sources, screens and scores against a versioned blueprint, with expert oversight as the approval gate before any shortlist reaches you.`,
    }),
  component: AgentsPage,
});

/** What the agents do, in the order the system runs them. */
const RUNS = [
  {
    name: "Sourcing",
    detail:
      "Continuously identifies candidates matching the compiled blueprint, refreshed on a weekly cadence rather than batched between calls.",
  },
  {
    name: "Screening",
    detail:
      "Reads each CV against the role's must-haves and records what supports or contradicts each requirement.",
  },
  {
    name: "Scoring",
    detail:
      "Produces a 0–100 score under a fixed rubric version, with the cited evidence attached to every line.",
  },
] as const;

const CONTROLS = [
  OVERSIGHT_LANGUAGE.approvalGate,
  OVERSIGHT_LANGUAGE.escalation,
  OVERSIGHT_LANGUAGE.governance,
] as const;

function AgentsPage() {
  const related = MODULE_SECTIONS.filter((m) =>
    ["blueprint", "evidence", "scoring", "workspace"].includes(m.key),
  );

  return (
    <SiteShell>
      <PublicSection className="bg-white">
        <PublicPage>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
              {PRODUCT_CATEGORY}
            </p>
            <h1 className="mt-2 font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">
              {MODULES.agents}
            </h1>
            <p className="mt-4 text-lg text-[color:var(--brand-navy)]/80">
              {SYSTEM_CLAIM} Agents run against the rubric compiled from your
              intake — and every candidate they rank carries the evidence behind
              the score.
            </p>
          </div>

          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {RUNS.map((r, i) => (
              <li
                key={r.name}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] p-6"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
                  Run {String(i + 1).padStart(2, "0")}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[color:var(--brand-navy)]">
                  {r.name}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">
                  {r.detail}
                </p>
              </li>
            ))}
          </ol>
        </PublicPage>
      </PublicSection>

      <PublicSection className="border-y border-[color:var(--brand-navy)]/8 bg-[color:var(--brand-paper)]">
        <PublicPage>
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)]">
                {OVERSIGHT_LANGUAGE.label}
              </h2>
              <p className="mt-3 text-[color:var(--brand-navy)]/80">
                Agents do the search. People keep the controls.
              </p>
              <ul className="mt-6 space-y-3">
                {CONTROLS.map((c) => (
                  <li
                    key={c}
                    className="flex items-start gap-2 text-sm text-[color:var(--brand-navy)]/85"
                  >
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-ocean-text)]"
                      aria-hidden
                    />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)]">
                What the agents connect to
              </h2>
              <ul className="mt-6 space-y-2">
                {related.map((m) => (
                  <li key={m.anchor}>
                    <Link
                      to="/platform"
                      hash={m.anchor}
                      className="group block rounded-lg border border-[color:var(--brand-navy)]/10 bg-white p-4 transition-colors hover:border-[color:var(--brand-navy)]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
                    >
                      <span className="flex items-center gap-2 font-medium text-[color:var(--brand-navy)]">
                        {m.name}
                        <ArrowRight
                          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      </span>
                      <span className="mt-1 block text-sm text-[color:var(--brand-navy)]/80">
                        {m.description}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      <CtaSection />
    </SiteShell>
  );
}
