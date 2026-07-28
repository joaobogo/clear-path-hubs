import { useMemo, useState } from "react";
import {
  Wallet,
  Users,
  Eye,
  GitBranch,
  Timer,
  TrendingUp,
  Repeat,
  ArrowRight,
} from "lucide-react";

type IntentKey = "one" | "several" | "continuous";
type DimensionKey =
  | "cost"
  | "delivery"
  | "visibility"
  | "ownership"
  | "effort"
  | "scalability"
  | "continuity";

type Dimension = {
  key: DimensionKey;
  label: string;
  icon: typeof Wallet;
  agency: string;
  taasflow: string;
  emphasis: Record<IntentKey, string>;
};

const DIMENSIONS: Dimension[] = [
  {
    key: "cost",
    label: "Cost model",
    icon: Wallet,
    agency: "A new percentage-based fee every time you hire.",
    taasflow: "A predictable recruiting model designed for continuous hiring.",
    emphasis: {
      one: "Even a single hire keeps cost inside a predictable envelope.",
      several: "Multiple hires stay under one continuous commitment, not stacked fees.",
      continuous: "Continuous hiring runs at a flat, forecastable cadence.",
    },
  },
  {
    key: "delivery",
    label: "Candidate delivery",
    icon: Users,
    agency: "A batch of CVs handed over with limited context.",
    taasflow: "Ranked candidates with evidence, coverage, and interview questions.",
    emphasis: {
      one: "For one role, every shortlisted candidate arrives already qualified.",
      several: "Across roles, each shortlist stays consistent and comparable.",
      continuous: "Continuous delivery keeps a warm bench moving into your pipeline.",
    },
  },
  {
    key: "visibility",
    label: "Visibility",
    icon: Eye,
    agency: "Progress lives in email threads and status calls.",
    taasflow: "A shared workspace with stages, evidence, and audit trail.",
    emphasis: {
      one: "One role, one live view — no follow-up chasing required.",
      several: "All roles visible in the same workspace, same stages.",
      continuous: "Continuous visibility across every open and future requirement.",
    },
  },
  {
    key: "ownership",
    label: "Pipeline ownership",
    icon: GitBranch,
    agency: "The pipeline leaves with the agency when the engagement ends.",
    taasflow: "Candidates, evidence, and history stay in your workspace.",
    emphasis: {
      one: "Even one hire leaves behind a documented pipeline you keep.",
      several: "Cross-role candidates and evidence compound in your workspace.",
      continuous: "Continuous hiring builds a permanent, searchable pipeline.",
    },
  },
  {
    key: "effort",
    label: "Internal HR effort",
    icon: Timer,
    agency: "Your team screens, re-briefs, and coordinates each round.",
    taasflow: "We run intake, screening, and evidence before HR reviews.",
    emphasis: {
      one: "For one role, HR reviews a shortlist instead of a longlist.",
      several: "For several roles, HR effort scales sublinearly, not per-role.",
      continuous: "Continuous hiring stops re-briefing the same context twice.",
    },
  },
  {
    key: "scalability",
    label: "Scalability",
    icon: TrendingUp,
    agency: "More roles means more agencies and more coordination overhead.",
    taasflow: "Add roles inside the same workspace and the same process.",
    emphasis: {
      one: "Starts with one role, ready to expand when you are.",
      several: "Several roles run in parallel without multiplying vendors.",
      continuous: "Continuous hiring scales without adding coordination.",
    },
  },
  {
    key: "continuity",
    label: "Hiring continuity",
    icon: Repeat,
    agency: "Every new role restarts briefing, sourcing, and calibration.",
    taasflow: "Context, calibration, and evidence carry across roles.",
    emphasis: {
      one: "First role establishes the calibration you reuse later.",
      several: "Multiple roles inherit calibration instead of restarting.",
      continuous: "Continuous hiring never restarts from zero.",
    },
  },
];

const INTENTS: { key: IntentKey; label: string }[] = [
  { key: "one", label: "Hiring one role" },
  { key: "several", label: "Hiring several roles" },
  { key: "continuous", label: "Building continuously" },
];

export function ModelComparison() {
  const [active, setActive] = useState<DimensionKey>("cost");
  const [intent, setIntent] = useState<IntentKey>("continuous");
  const dim = useMemo(
    () => DIMENSIONS.find((d) => d.key === active) ?? DIMENSIONS[0],
    [active],
  );
  const Icon = dim.icon;

  return (
    <div className="mt-10">
      {/* Intent selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
          Compare for
        </div>
        <div
          role="tablist"
          aria-label="Hiring intent"
          className="flex flex-wrap gap-1.5 rounded-full border border-[color:var(--brand-navy)]/10 bg-white p-1"
        >
          {INTENTS.map((i) => {
            const on = intent === i.key;
            return (
              <button
                key={i.key}
                role="tab"
                aria-selected={on}
                onClick={() => setIntent(i.key)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  on
                    ? "bg-[color:var(--brand-navy)] text-white"
                    : "text-[color:var(--brand-navy)]/70 hover:text-[color:var(--brand-navy)]"
                }`}
              >
                {i.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        {/* Dimension rail */}
        <div
          role="tablist"
          aria-label="Comparison dimensions"
          aria-orientation="vertical"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
        >
          {DIMENSIONS.map((d) => {
            const on = d.key === active;
            const DIcon = d.icon;
            return (
              <button
                key={d.key}
                role="tab"
                aria-selected={on}
                onClick={() => setActive(d.key)}
                className={`group relative flex shrink-0 items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition lg:w-full ${
                  on
                    ? "border-[color:var(--brand-navy)] bg-[color:var(--brand-navy)] text-white shadow-[var(--brand-shadow-sm)]"
                    : "border-[color:var(--brand-navy)]/10 bg-white text-[color:var(--brand-navy)] hover:border-[color:var(--brand-navy)]/25"
                }`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${
                    on
                      ? "bg-white/15 text-white"
                      : "bg-[color:var(--brand-ocean)]/10 text-[color:var(--brand-ocean)]"
                  }`}
                >
                  <DIcon className="h-4 w-4" aria-hidden />
                </span>
                <span className="whitespace-nowrap lg:whitespace-normal">{d.label}</span>
                {on && (
                  <ArrowRight
                    className="ml-auto hidden h-4 w-4 opacity-80 lg:block"
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Two-path panel */}
        <div
          className="relative overflow-hidden rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-5 shadow-[var(--brand-shadow-sm)] sm:p-7"
          aria-live="polite"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-[color:var(--brand-ocean)]/10 text-[color:var(--brand-ocean)]">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
                Dimension
              </div>
              <div className="text-lg font-semibold text-[color:var(--brand-navy)]">
                {dim.label}
              </div>
            </div>
          </div>

          {/* Animated path progression */}
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <PathCard
              key={`a-${dim.key}`}
              tone="agency"
              label="Path A · Traditional agency"
              body={dim.agency}
            />
            <PathCard
              key={`t-${dim.key}`}
              tone="taasflow"
              label="Path B · TaaSFlow"
              body={dim.taasflow}
            />
          </div>

          {/* Intent emphasis */}
          <div
            key={`e-${dim.key}-${intent}`}
            className="mt-6 flex items-start gap-3 rounded-xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] px-4 py-3 animate-fade-in"
          >
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[color:var(--brand-ocean)]" />
            <p className="text-sm leading-relaxed text-[color:var(--brand-navy)]/85">
              <span className="font-semibold text-[color:var(--brand-navy)]">
                {INTENTS.find((i) => i.key === intent)?.label}:
              </span>{" "}
              {dim.emphasis[intent]}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PathCard({
  tone,
  label,
  body,
}: {
  tone: "agency" | "taasflow";
  label: string;
  body: string;
}) {
  const isTaas = tone === "taasflow";
  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-5 animate-fade-in ${
        isTaas
          ? "border-[color:var(--brand-navy)]/15 bg-gradient-to-br from-white to-[color:var(--brand-ocean)]/5"
          : "border-dashed border-[color:var(--brand-navy)]/15 bg-white"
      }`}
    >
      {/* Animated path line */}
      <svg
        aria-hidden
        viewBox="0 0 200 8"
        className="absolute inset-x-0 top-0 h-2 w-full"
        preserveAspectRatio="none"
      >
        <path
          d="M0 4 L200 4"
          className={
            isTaas
              ? "stroke-[color:var(--brand-ocean)] animate-[dash_1.2s_ease-out_forwards]"
              : "stroke-[color:var(--brand-navy)]/25 animate-[dash_1.2s_ease-out_forwards]"
          }
          strokeWidth="2"
          fill="none"
          strokeDasharray="200"
          strokeDashoffset="200"
          style={{ animationFillMode: "forwards" }}
        />
      </svg>
      <div
        className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
          isTaas
            ? "text-[color:var(--brand-ocean)]"
            : "text-[color:var(--brand-navy)]/50"
        }`}
      >
        {label}
      </div>
      <p
        className={`mt-2 text-sm leading-relaxed ${
          isTaas
            ? "text-[color:var(--brand-navy)]"
            : "text-[color:var(--brand-navy)]/70"
        }`}
      >
        {body}
      </p>
    </div>
  );
}
