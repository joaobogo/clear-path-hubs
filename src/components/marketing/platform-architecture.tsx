/**
 * Interactive system architecture for /platform.
 *
 * Every entry below is traceable to shipped code. `surface` names the real
 * in-product surface. Nothing here describes functionality that does not
 * exist; anything directional is labelled with status "direction".
 */

import * as React from "react";
import { ArrowRight, ChevronRight, RotateCcw } from "lucide-react";

import { MODULE_SECTIONS } from "@/config/product-language";

type Status = "shipped" | "direction";

type Node = {
  key: string;
  /** Anchor id — matches MODULE_SECTIONS anchors used by the site nav. */
  anchor: string;
  name: string;
  status: Status;
  summary: string;
  inputs: readonly string[];
  does: readonly string[];
  produces: readonly string[];
  controls: readonly string[];
  records: readonly string[];
  surface: string;
};

const anchorFor = (key: string) =>
  MODULE_SECTIONS.find((m) => m.key === key)?.anchor ?? key;

const nameFor = (key: string) =>
  MODULE_SECTIONS.find((m) => m.key === key)?.name ?? key;

export const NODES: readonly Node[] = [
  {
    key: "intake",
    anchor: anchorFor("intake"),
    name: nameFor("intake"),
    status: "shipped",
    summary: "Role requirements become structured data.",
    inputs: [
      "Role brief, must-haves, nice-to-haves, constraints",
      "Job description upload (PDF)",
      "Compensation range, location and work-permission rules",
    ],
    does: [
      "Validates every field against a schema before it is stored",
      "Saves drafts so a partial intake is never lost",
      "De-duplicates repeat submissions by idempotency key",
    ],
    produces: ["A validated requisition record tied to your organisation"],
    controls: [
      "Edit any field before the role is launched",
      "Role intensity: steady, standard or aggressive",
    ],
    records: ["Who submitted the intake, when, and every later edit"],
    surface: "Intake and role launch",
  },
  {
    key: "blueprint",
    anchor: anchorFor("blueprint"),
    name: nameFor("blueprint"),
    status: "shipped",
    summary: "Requirements compile into a versioned rubric.",
    inputs: ["The validated requisition", "Your weighting preferences"],
    does: [
      "Turns must-haves into scoreable requirements",
      "Assigns weights across role fit, evidence, logistics and signal",
      "Freezes the result as a rubric version",
    ],
    produces: [
      "A rubric version that agents and scoring both read from",
      "A written blueprint you approve before sourcing starts",
    ],
    controls: [
      "Approve or send the blueprint back for changes",
      "Adjust dimension weights per role",
    ],
    records: ["Each rubric version, kept immutable once scored against"],
    surface: "Blueprint review and approval",
  },
  {
    key: "agents",
    anchor: anchorFor("agents"),
    name: nameFor("agents"),
    status: "shipped",
    summary: "Agents run sourcing, screening and scoring runs.",
    inputs: ["The approved rubric version", "Agent enablement and pause state"],
    does: [
      "Runs sourcing, screening and scoring as separate tracked runs",
      "Re-runs on a weekly cadence while the role is open",
      "Stops immediately when an agent is paused",
    ],
    produces: ["Candidate applications and matches queued for scoring"],
    controls: [
      "Enable, disable or pause any agent per role",
      "Change role intensity to change volume and outreach",
    ],
    records: ["Every agent run, its status, and who changed agent state"],
    surface: "Agent panel and activity log",
  },
  {
    key: "evidence",
    anchor: anchorFor("evidence"),
    name: nameFor("evidence"),
    status: "shipped",
    summary: "Each requirement is linked to its supporting proof.",
    inputs: ["Parsed CV text (PDF only)", "Application answers and notes"],
    does: [
      "Extracts evidence items and attaches them to specific requirements",
      "Flags requirements with no supporting evidence",
      "Surfaces contradictions instead of hiding them",
    ],
    produces: ["An evidence set per candidate, per requirement"],
    controls: [
      "Expert oversight verifies or rejects each evidence item before release",
    ],
    records: ["Who verified or rejected each item, and when"],
    surface: "Evidence review",
  },
  {
    key: "scoring",
    anchor: anchorFor("scoring"),
    name: nameFor("scoring"),
    status: "shipped",
    summary: "Verified evidence becomes a 0-100 score.",
    inputs: ["Verified evidence set", "The frozen rubric version"],
    does: [
      "Applies eligibility checks before any score is produced",
      "Computes a deterministic score: same inputs and engine version, same result",
      "Writes the run with an input hash so it can be reproduced",
    ],
    produces: ["A 0-100 score with per-dimension breakdown and cited evidence"],
    controls: [
      "Review queue where a score can be held back or returned",
      "Rubric version is fixed for the run — scores never move silently",
    ],
    records: ["Each score run, its engine version, rubric version and inputs"],
    surface: "Scoring review centre",
  },
  {
    key: "workspace",
    anchor: anchorFor("workspace"),
    name: nameFor("workspace"),
    status: "shipped",
    summary: "You compare, decide and move candidates.",
    inputs: ["Released candidates with scores and evidence"],
    does: [
      "Shows a side-by-side comparison as the default view",
      "Walks each decision through valid pipeline states only",
      "Runs interviews, scorecards and offers in the same thread",
    ],
    produces: ["Shortlists, interviews, offers and hires"],
    controls: [
      "Approve, reject or advance — with a short undo window",
      "Reason capture on rejections",
      "Escalate to a named platform expert in-thread",
    ],
    records: ["Every decision, reason and state change against your role"],
    surface: "Client decision queue and pipeline",
  },
  {
    key: "talentGraph",
    anchor: anchorFor("talentGraph"),
    name: nameFor("talentGraph"),
    status: "shipped",
    summary: "Verified outcomes stay reusable for the next role.",
    inputs: ["Decision outcomes", "Verified evidence", "Role memory notes"],
    does: [
      "Tags strong runners-up with the reason they were not hired",
      "Resurfaces past candidates against a new role's rubric",
      "Carries role memory notes into the next brief",
    ],
    produces: ["A reusable talent pool scoped to your organisation"],
    controls: [
      "Edit or remove any retained record",
      "Choose whether a candidate is re-engaged",
    ],
    records: ["Every re-engagement and resurface event"],
    surface: "Talent pool and role fit rediscovery",
  },
  {
    key: "governance",
    anchor: anchorFor("governance"),
    name: nameFor("governance"),
    status: "shipped",
    summary: "Everything above writes to one audit trail.",
    inputs: ["State changes, overrides, access and release events"],
    does: [
      "Appends an audit event for each recorded action",
      "Enforces row-level access so data stays inside your organisation",
      "Keeps candidate contact release as a separate permission",
    ],
    produces: ["A queryable history for any role, candidate or decision"],
    controls: ["Team roles and seat permissions", "Data visibility settings"],
    records: ["The audit trail itself — append-only"],
    surface: "Audit history and team settings",
  },
];

const SECTION_LABELS = [
  { key: "inputs", label: "What enters it" },
  { key: "does", label: "What it does" },
  { key: "produces", label: "What it produces" },
  { key: "controls", label: "What you control" },
  { key: "records", label: "What gets recorded" },
] as const;

export function PlatformArchitecture() {
  const [activeKey, setActiveKey] = React.useState<string>(NODES[0]!.key);
  const active = NODES.find((n) => n.key === activeKey) ?? NODES[0]!;

  // Deep links from the site navigation (/platform#agent-layer) select a module.
  React.useEffect(() => {
    const sync = () => {
      const hash = window.location.hash.replace("#", "");
      const match = NODES.find((n) => n.anchor === hash);
      if (match) setActiveKey(match.key);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      {/* Flow rail — also the module selector */}
      <div className="min-w-0">
        <p className="flex items-center gap-2 rounded-lg border border-[color:var(--brand-navy)]/10 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-navy)]/80">
          Role requirements
          <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </p>

        <div
          role="tablist"
          aria-label="System architecture modules"
          aria-orientation="vertical"
          className="mt-2 flex flex-col gap-1.5"
        >
          {NODES.map((n, i) => {
            const selected = n.key === active.key;
            return (
              <button
                key={n.key}
                id={n.anchor}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="platform-module-detail"
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveKey(n.key)}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
                  e.preventDefault();
                  const next =
                    e.key === "ArrowDown"
                      ? NODES[(i + 1) % NODES.length]!
                      : NODES[(i - 1 + NODES.length) % NODES.length]!;
                  setActiveKey(next.key);
                  document.getElementById(next.anchor)?.focus();
                }}
                className={`scroll-mt-24 min-w-0 rounded-xl border px-3.5 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)] ${
                  selected
                    ? "border-[color:var(--brand-navy)] bg-[color:var(--brand-navy)] text-white"
                    : "border-[color:var(--brand-navy)]/10 bg-white text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${
                      selected
                        ? "bg-white/20 text-white"
                        : "bg-[color:var(--brand-ocean)]/10 text-[color:var(--brand-ocean-text)]"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {n.name}
                  </span>
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 ${selected ? "opacity-90" : "opacity-40"}`}
                    aria-hidden
                  />
                </span>
                <span
                  className={`mt-1 block text-xs leading-snug ${
                    selected ? "text-white/80" : "text-[color:var(--brand-navy)]/70"
                  }`}
                >
                  {n.summary}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-2 flex items-center gap-2 rounded-lg border border-[color:var(--brand-navy)]/10 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-navy)]/80">
          <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Hiring outcomes
        </p>
        <p className="mt-2 flex items-start gap-2 rounded-lg border border-dashed border-[color:var(--brand-navy)]/20 bg-[color:var(--brand-paper)] px-3 py-2 text-xs text-[color:var(--brand-navy)]/75">
          <RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Outcomes feed the {nameFor("talentGraph")}, which the next role's rubric reads
          from.
        </p>
      </div>

      {/* Detail panel */}
      <div
        id="platform-module-detail"
        role="tabpanel"
        aria-live="polite"
        className="min-w-0 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-5 sm:p-7"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold text-[color:var(--brand-navy)]">
            {active.name}
          </h3>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${
              active.status === "shipped"
                ? "bg-[color:var(--brand-ocean)]/10 text-[color:var(--brand-ocean-text)]"
                : "bg-[color:var(--brand-navy)]/10 text-[color:var(--brand-navy)]/70"
            }`}
          >
            {active.status === "shipped" ? "In the product" : "Product direction"}
          </span>
        </div>
        <p className="mt-1 text-sm text-[color:var(--brand-navy)]/70">
          Runs in: {active.surface}
        </p>

        <dl className="mt-6 grid gap-5 sm:grid-cols-2">
          {SECTION_LABELS.map(({ key, label }) => {
            const items = active[key];
            return (
              <div key={label} className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-navy)]/70">
                  {label}
                </dt>
                <dd className="mt-2">
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
          })}
        </dl>
      </div>
    </div>
  );
}
