/**
 * /agents — the public Agent Layer page.
 *
 * Roster, orchestration and approval limits are all derived from
 * src/config/agent-roster.ts, which maps every published agent to real
 * functionality (src/lib/agents/registry.ts, the CV pipeline runner, the
 * blueprint compiler, the scoring engine and audit events).
 *
 * No live status is shown anywhere. Illustrative activity sits under a
 * visible "Representative data" label.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import {
  PublicPage,
  PublicSection,
  SiteShell,
  CtaSection,
} from "@/components/marketing/site-shell";
import { marketingHead } from "@/lib/marketing/head";
import { EditorialHero } from "@/components/marketing/editorial-hero";
import agentsHero from "@/assets/page-agents-hero.jpg";
import { AgentRunsPreview } from "@/components/marketing/product-preview/agent-runs-preview";
import {
  MODULES,
  MODULE_SECTIONS,
  OVERSIGHT_LANGUAGE,
  PRODUCT_CATEGORY,
  SYSTEM_CLAIM,
} from "@/config/product-language";
import {
  ROSTER,
  HANDOFFS,
  APPROVAL_LIMITS,
  AGENT_STATUSES,
  type RosterEntry,
} from "@/config/agent-roster";

export const Route = createFileRoute("/agents")({
  head: () =>
    marketingHead(undefined, "/agents", {
      title: `${MODULES.agents} — the eight agents that run a TaaSFlow search`,
      description: `${SYSTEM_CLAIM} Intake, blueprint, discovery, evidence, scoring, pipeline, coordination and governance agents — each with stated inputs, outputs, controls, approval gates and recorded events.`,
    }),
  component: AgentsPage,
});

const REP_LABEL = "Representative data";

function StatusChip({ status }: { status: (typeof AGENT_STATUSES)[number] }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--brand-navy)]/12 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-[color:var(--brand-navy)]/80">
      <span
        className="h-1.5 w-1.5 rounded-full bg-[color:var(--brand-ocean-text)]"
        aria-hidden
      />
      {status}
    </span>
  );
}

function DetailList({ label, items }: { label: string; items: readonly string[] }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-navy)]/70">
        {label}
      </dt>
      <dd className="mt-1.5">
        <ul className="space-y-1.5">
          {items.map((line) => (
            <li
              key={line}
              className="flex items-start gap-2 text-sm leading-snug text-[color:var(--brand-navy)]/85"
            >
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-ocean-text)]"
                aria-hidden
              />
              <span className="min-w-0">{line}</span>
            </li>
          ))}
        </ul>
      </dd>
    </div>
  );
}

function AgentCard({ agent }: { agent: RosterEntry }) {
  return (
    <li className="flex min-w-0 flex-col rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold text-[color:var(--brand-navy)]">
          {agent.role}
        </h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${
            agent.kind === "agent"
              ? "bg-[color:var(--brand-ocean)]/10 text-[color:var(--brand-ocean-text)]"
              : "bg-[color:var(--brand-navy)]/8 text-[color:var(--brand-navy)]/70"
          }`}
        >
          {agent.kind === "agent" ? "You switch it on" : "Always on"}
        </span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-[color:var(--brand-navy)]/85">
        {agent.purpose}
      </p>

      <p className="mt-3 rounded-lg bg-[color:var(--brand-paper)] px-3 py-2 text-xs leading-snug text-[color:var(--brand-navy)]/80">
        <span className="font-semibold text-[color:var(--brand-navy)]">
          Operating state:
        </span>{" "}
        {agent.operatingState}
      </p>

      <dl className="mt-4 grid gap-4">
        <DetailList label="Inputs" items={agent.inputs} />
        <DetailList label="Outputs" items={agent.outputs} />
      </dl>

      <details className="group mt-4 rounded-lg border border-[color:var(--brand-navy)]/10">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-semibold text-[color:var(--brand-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]">
          Controls, approvals and records
          <ChevronDown
            className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <dl className="grid gap-4 border-t border-[color:var(--brand-navy)]/8 px-3 py-3">
          <DetailList label="What you control" items={agent.controls} />
          <div className="min-w-0">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-navy)]/70">
              Approval required
            </dt>
            <dd className="mt-1.5 flex items-start gap-2 text-sm leading-snug text-[color:var(--brand-navy)]/85">
              <Lock
                className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-navy)]/70"
                aria-hidden
              />
              <span className="min-w-0">{agent.approval}</span>
            </dd>
          </div>
          <DetailList label="Events recorded" items={agent.events} />
        </dl>
      </details>

      <div className="mt-4 rounded-lg border border-dashed border-[color:var(--brand-navy)]/20 bg-[color:var(--brand-paper)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/70">
            {REP_LABEL}
          </span>
          <StatusChip status={agent.representative.status} />
        </div>
        <p className="mt-1.5 text-xs leading-snug text-[color:var(--brand-navy)]/80">
          {agent.representative.activity}
        </p>
      </div>
    </li>
  );
}

function AgentsPage() {
  const related = MODULE_SECTIONS.filter((m) =>
    ["blueprint", "evidence", "scoring", "workspace", "governance"].includes(m.key),
  );

  return (
    <SiteShell>
      {/* INTRO */}
      <EditorialHero
        eyebrow={PRODUCT_CATEGORY}
        title="Eight agents. Each one has a job, a limit and a log."
        lead="Agents work inside role rules, a frozen rubric and approval gates. Every action they take is recorded."
        image={agentsHero}
        imageAlt="A recruiter reviewing candidate evidence at a desk in the evening"
        stats={[
          { value: "6", label: "Agents you control" },
          { value: "2", label: "System automations" },
          { value: "0", label: "Releases without approval" },
        ]}
        primary={{ to: "/intake", label: "Start a role" }}
        secondary={{ to: "/platform", label: "See the platform" }}
      >
        <ul className="grid gap-2 sm:grid-cols-3">
          {[
            "Six agents you switch on or pause",
            "Two always-on system automations",
            "No candidate released without approval",
          ].map((t) => (
            <li
              key={t}
              className="inline-flex items-start gap-2 rounded-lg border border-[color:var(--brand-navy)]/10 bg-white px-3 py-2 text-sm font-semibold text-[color:var(--brand-navy)]"
            >
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-ocean-text)]" aria-hidden />
              <span className="min-w-0">{t}</span>
            </li>
          ))}
        </ul>
      </EditorialHero>

      {/* ROSTER */}
      <PublicSection className="bg-white">
        <PublicPage>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
              The roster
            </p>
            <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
              Every agent in the system.
            </h2>
            <p className="mt-3 text-[color:var(--brand-navy)]/80">
              Operating state describes how each agent is configured — not a live
              reading. Activity examples are labelled {REP_LABEL.toLowerCase()}.
            </p>
          </div>

          <ul className="mt-10 grid gap-4 lg:grid-cols-2">
            {ROSTER.map((a) => (
              <AgentCard key={a.id} agent={a} />
            ))}
          </ul>
        </PublicPage>
      </PublicSection>

      {/* ORCHESTRATION */}
      <PublicSection className="border-y border-[color:var(--brand-navy)]/8 bg-[color:var(--brand-paper)]">
        <PublicPage>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
              Orchestration
            </p>
            <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
              What each agent hands to the next.
            </h2>
            <p className="mt-3 text-[color:var(--brand-navy)]/80">
              Agents do not talk in prose. Each one passes a structured record
              forward, and the Governance Agent records the handoff.
            </p>
          </div>

          <ol className="mt-10 grid gap-3">
            {HANDOFFS.map((h, i) => (
              <li
                key={`${h.from}-${h.to}`}
                className="grid min-w-0 gap-2 rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-4"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[color:var(--brand-ocean)]/10 text-[11px] font-semibold text-[color:var(--brand-ocean-text)]">
                    {i + 1}
                  </span>
                  <span className="min-w-0 text-sm font-semibold text-[color:var(--brand-navy)]">
                    {h.from}
                  </span>
                </div>
                <div className="flex min-w-0 items-center gap-2 sm:justify-center">
                  <span className="min-w-0 rounded-md bg-[color:var(--brand-paper)] px-2.5 py-1 text-xs font-medium text-[color:var(--brand-navy)]/80">
                    {h.payload}
                  </span>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-[color:var(--brand-navy)]/70"
                    aria-hidden
                  />
                </div>
                <span className="min-w-0 text-sm font-semibold text-[color:var(--brand-navy)] sm:text-right">
                  {h.to}
                </span>
              </li>
            ))}
          </ol>

          <p className="mt-4 max-w-3xl text-sm text-[color:var(--brand-navy)]/75">
            Approval gates sit between the blueprint and sourcing, and between
            scoring and release. Work stops at those gates until a person clears
            it.
          </p>
        </PublicPage>
      </PublicSection>

      {/* WHAT AGENTS CANNOT DO */}
      <PublicSection className="bg-white">
        <PublicPage>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
              Hard limits
            </p>
            <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
              What no agent can do without approval.
            </h2>
            <p className="mt-3 text-[color:var(--brand-navy)]/80">
              These are enforced in the system, not stated as policy.
            </p>
          </div>

          <ul className="mt-10 grid gap-3 md:grid-cols-2">
            {APPROVAL_LIMITS.map((limit) => (
              <li
                key={limit}
                className="flex min-w-0 items-start gap-3 rounded-xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] p-4"
              >
                <ShieldCheck
                  className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--brand-ocean-text)]"
                  aria-hidden
                />
                <span className="min-w-0 text-sm leading-snug text-[color:var(--brand-navy)]/85">
                  {limit}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-8 grid gap-3 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] p-5 sm:grid-cols-3">
            {[
              OVERSIGHT_LANGUAGE.approvalGate,
              OVERSIGHT_LANGUAGE.escalation,
              OVERSIGHT_LANGUAGE.governance,
            ].map((c) => (
              <p
                key={c}
                className="min-w-0 text-sm leading-snug text-[color:var(--brand-navy)]/85"
              >
                {c}
              </p>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* WHERE THE AGENTS PLUG IN */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/8 bg-[color:var(--brand-paper)]">
        <PublicPage>
          <div className="max-w-3xl">
            <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
              What the agents connect to.
            </h2>
          </div>
          <ul className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {related.map((m) => (
              <li key={m.anchor}>
                <Link
                  to="/platform"
                  hash={m.anchor}
                  className="group block h-full rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-4 transition-colors hover:border-[color:var(--brand-navy)]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
                >
                  <span className="flex items-center gap-2 font-medium text-[color:var(--brand-navy)]">
                    {m.name}
                    <ArrowRight
                      className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
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
        </PublicPage>
      </PublicSection>

      <PublicSection className="bg-white">
        <PublicPage>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
              Agent activity
            </p>
            <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
              Every run is on the record.
            </h2>
            <p className="mt-3 text-[color:var(--brand-navy)]/80">
              This is the activity rail from the workspace: actor, action, time,
              status and result — including the runs that are waiting on a person.
            </p>
          </div>

          <div className="mt-10 max-w-2xl">
            <AgentRunsPreview />
          </div>
        </PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow="Ready to see it"
        title="Open a role and switch the agents on."
        description="You choose which agents run, what they may send, and what must be approved before a candidate reaches you."
        primary={{ to: "/intake", label: "Open your first role" }}
        secondary={{ to: "/platform", label: "See the platform" }}
      />
    </SiteShell>
  );
}
