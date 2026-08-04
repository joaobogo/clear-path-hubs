import * as React from "react";
import { Activity, ArrowRight, Bot, CheckCircle2, ShieldCheck } from "lucide-react";

/**
 * Compact Decision Workspace panel for the homepage hero.
 * All values below are representative (non-live) and labelled as such in the UI.
 */

const ROLE_HEALTH = [
  { label: "Coverage", value: "92%", note: "requirements evidenced" },
  { label: "Time in stage", value: "3d", note: "vs 7d commitment" },
  { label: "Decisions due", value: "2", note: "awaiting approval" },
];

const AGENT_RUNS = [
  { name: "Sourcing agent", status: "Running", detail: "418 profiles matched · rubric v4" },
  { name: "Screening agent", status: "Running", detail: "26 CVs parsed · 12 evidenced" },
  { name: "Scoring agent", status: "Complete", detail: "12 scored · audit written" },
];

const EVIDENCE = [
  { req: "Design-system ownership", pct: 96, quote: "Led system rollout across three product lines." },
  { req: "B2B SaaS depth", pct: 92, quote: "Six years shipping B2B surfaces for revenue teams." },
  { req: "Team leadership", pct: 88, quote: "Managed five designers through two hiring cycles." },
];

const PIPELINE = [
  { stage: "Sourced", count: 418 },
  { stage: "Screened", count: 26 },
  { stage: "Scored", count: 12 },
  { stage: "Shortlist", count: 3 },
];

const ACTIVITY = [
  { at: "09:41", text: "Scoring run 4c1 completed · rubric v4 locked" },
  { at: "09:12", text: "Evidence verified on 3 requirements" },
  { at: "08:55", text: "Shortlist published to Decision Workspace" },
];

export function HeroDecisionWorkspace() {
  const max = Math.max(...PIPELINE.map((p) => p.count));

  return (
    <div
      aria-label="Representative view of the TaaSFlow Decision Workspace"
      className="min-w-0 rounded-2xl border border-[color:var(--brand-navy)]/12 bg-white p-3 shadow-[var(--brand-shadow-lg)] sm:p-4"
    >
      {/* Chrome */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--brand-navy)]/8 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--chrome-dot-close)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--chrome-dot-minimise)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--chrome-dot-expand)]" />
          </div>
          <span className="truncate text-xs font-medium text-[color:var(--brand-navy)]/80">
            Decision Workspace · Senior Product Designer
          </span>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--brand-navy)]/15 bg-[color:var(--brand-navy)]/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/80">
          <ShieldCheck className="h-3 w-3" aria-hidden />
          Representative data
        </span>
      </div>

      {/* Role health */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {ROLE_HEALTH.map((m) => (
          <div
            key={m.label}
            className="min-w-0 rounded-xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] p-2.5"
          >
            <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/70">
              {m.label}
            </div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums leading-none text-[color:var(--brand-navy)]">
              {m.value}
            </div>
            <div className="mt-1 truncate text-[10px] text-[color:var(--brand-navy)]/70">{m.note}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {/* Agent runs */}
        <section className="min-w-0 rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-3">
          <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/70">
            <Bot className="h-3.5 w-3.5 text-[color:var(--brand-ocean-text)]" aria-hidden />
            Active agent runs
          </h3>
          <ul className="mt-2 space-y-2">
            {AGENT_RUNS.map((r) => (
              <li key={r.name} className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12px] font-semibold text-[color:var(--brand-navy)]">
                    {r.name}
                  </span>
                  <span
                    className={
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold " +
                      (r.status === "Running"
                        ? "bg-[color:var(--brand-ocean)]/12 text-[color:var(--brand-ocean-text)]"
                        : "bg-[color:var(--brand-navy)]/8 text-[color:var(--brand-navy)]/75")
                    }
                  >
                    {r.status === "Running" ? (
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-[color:var(--brand-ocean)]"
                        aria-hidden
                      />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" aria-hidden />
                    )}
                    {r.status}
                  </span>
                </div>
                <p className="truncate text-[10px] text-[color:var(--brand-navy)]/70">{r.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Candidate score + evidence */}
        <section className="min-w-0 rounded-xl border border-[color:var(--brand-ocean)]/25 bg-[color:var(--brand-ocean)]/[0.03] p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-[12px] font-semibold text-[color:var(--brand-navy)]">
                Alex R. · A-1042
              </h3>
              <p className="truncate text-[10px] text-[color:var(--brand-navy)]/70">
                Shortlisted · rubric v4 · 4 requirements
              </p>
            </div>
            <div className="shrink-0 rounded-md bg-[color:var(--brand-ocean)]/12 px-2.5 py-1 text-center">
              <div className="text-base font-semibold tabular-nums leading-none text-[color:var(--brand-ocean-text)]">
                94
              </div>
              <div className="text-[9px] font-semibold uppercase tracking-wide text-[color:var(--brand-ocean-text)]">
                score
              </div>
            </div>
          </div>
          <ul className="mt-2.5 space-y-2">
            {EVIDENCE.map((e) => (
              <li key={e.req} className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[color:var(--brand-navy)]/85">
                    {e.req}
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums text-[color:var(--brand-navy)]">
                    {e.pct}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[color:var(--brand-navy)]/8">
                  <div
                    className="h-full rounded-full bg-[color:var(--brand-ocean)]"
                    style={{ width: `${e.pct}%` }}
                    aria-hidden
                  />
                </div>
                <p className="mt-1 text-[10px] italic leading-snug text-[color:var(--brand-navy)]/70">
                  “{e.quote}”
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* Pipeline movement */}
        <section className="min-w-0 rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-3">
          <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/70">
            <ArrowRight className="h-3.5 w-3.5 text-[color:var(--brand-ocean-text)]" aria-hidden />
            Pipeline movement · last 7 days
          </h3>
          <ul className="mt-2 space-y-1.5">
            {PIPELINE.map((p) => (
              <li key={p.stage} className="flex items-center gap-2">
                <span className="w-16 shrink-0 truncate text-[10px] font-medium text-[color:var(--brand-navy)]/75">
                  {p.stage}
                </span>
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[color:var(--brand-navy)]/8">
                  <div
                    className="h-full rounded-full bg-[color:var(--brand-navy)]/45"
                    style={{ width: `${Math.round((p.count / max) * 100)}%` }}
                    aria-hidden
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-[11px] font-semibold tabular-nums text-[color:var(--brand-navy)]">
                  {p.count}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Recent system activity */}
        <section className="min-w-0 rounded-xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] p-3">
          <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/70">
            <Activity className="h-3.5 w-3.5 text-[color:var(--brand-ocean-text)]" aria-hidden />
            Recent system activity
          </h3>
          <ul className="mt-2 space-y-1.5">
            {ACTIVITY.map((a) => (
              <li key={a.at} className="flex min-w-0 gap-2">
                <span className="shrink-0 text-[10px] font-semibold tabular-nums text-[color:var(--brand-navy)]/60">
                  {a.at}
                </span>
                <span className="min-w-0 text-[10px] leading-snug text-[color:var(--brand-navy)]/80">
                  {a.text}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

export default HeroDecisionWorkspace;
