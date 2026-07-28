/**
 * Homepage dashboard preview — a static, anonymized rendering of the TaaSFlow
 * client workspace as it appears on a phone. Illustrative data only (clearly
 * labelled), no live queries, no fabricated customer identities.
 */
import {
  BarChart3,
  Bell,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Home,
  MessageSquare,
  Search,
  SlidersHorizontal,
  Users,
  XCircle,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

type Row = {
  id: string;
  initials: string;
  name: string;
  headline: string;
  meta: string;
  score: number;
  band: "Top fit" | "Strong fit" | "Consider";
  stage: string;
  categories: { label: string; value: number }[];
};

const ROWS: Row[] = [
  {
    id: "A-1042",
    initials: "AR",
    name: "Candidate A-1042",
    headline: "Senior Product Designer · 8 yrs",
    meta: "Lisbon, PT · Remote-friendly",
    score: 94,
    band: "Top fit",
    stage: "Ready for review",
    categories: [
      { label: "Role Fit", value: 96 },
      { label: "Evidence", value: 93 },
      { label: "Logistics", value: 88 },
      { label: "Signal", value: 91 },
    ],
  },
  {
    id: "A-1039",
    initials: "PM",
    name: "Candidate A-1039",
    headline: "Senior Product Designer · 7 yrs",
    meta: "Berlin, DE · Hybrid",
    score: 91,
    band: "Strong fit",
    stage: "Shortlisted",
    categories: [
      { label: "Role Fit", value: 89 },
      { label: "Evidence", value: 94 },
      { label: "Logistics", value: 82 },
      { label: "Signal", value: 87 },
    ],
  },
  {
    id: "A-1037",
    initials: "DK",
    name: "Candidate A-1037",
    headline: "Senior Product Designer · 9 yrs",
    meta: "Remote · CET timezone",
    score: 87,
    band: "Consider",
    stage: "Under review",
    categories: [
      { label: "Role Fit", value: 84 },
      { label: "Evidence", value: 81 },
      { label: "Logistics", value: 94 },
      { label: "Signal", value: 78 },
    ],
  },
];

const ACTIONS = [
  { label: "Shortlist", icon: CheckCircle2, primary: true },
  { label: "Interview", icon: CalendarCheck, primary: false },
  { label: "Ask", icon: MessageSquare, primary: false },
  { label: "Reject", icon: XCircle, primary: false },
] as const;

const FILTERS = [
  { label: "All", active: true },
  { label: "Top fit", active: false },
  { label: "New", active: false },
  { label: "Remote", active: false },
] as const;

const NAV = [
  { label: "Home", icon: Home, active: false },
  { label: "Roles", icon: Briefcase, active: false },
  { label: "Candidates", icon: Users, active: true },
  { label: "Insights", icon: BarChart3, active: false },
] as const;

const HIGHLIGHTS = [
  {
    title: "One-tap decisions",
    body: "Shortlist, request an interview, ask a question or pass — from the candidate card, no extra screens.",
  },
  {
    title: "Compact score summaries",
    body: "A single 0–100 fit score, backed by Role Fit, Evidence, Logistics and Signal you can expand when you want detail.",
  },
  {
    title: "Weekly delivery view",
    body: "Each batch arrives as a clean, dated set — you always know what's new and what's still waiting on you.",
  },
];

function bandClass(band: Row["band"]) {
  if (band === "Top fit")
    return "border-[color:var(--brand-ocean)]/35 bg-[color:var(--brand-ocean)]/10 text-[color:var(--brand-navy)]";
  if (band === "Strong fit")
    return "border-[color:var(--brand-navy)]/20 bg-[color:var(--brand-navy)]/[0.06] text-[color:var(--brand-navy)]";
  return "border-[color:var(--brand-navy)]/12 bg-[color:var(--brand-paper)] text-[color:var(--brand-navy)]/80";
}

function ScoreBar({ value }: { value: number }) {
  return (
    <div
      className="h-1 w-full overflow-hidden rounded-full bg-[color:var(--brand-navy)]/10"
      role="presentation"
    >
      <div
        className="h-full rounded-full bg-[color:var(--brand-ocean)]"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function CandidateCard({ row }: { row: Row }) {
  return (
    <li className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-3 shadow-[var(--brand-shadow-sm,0_1px_2px_rgba(0,0,0,0.05))]">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--brand-navy)]/[0.07] text-[11px] font-semibold text-[color:var(--brand-navy)]"
        >
          {row.initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-semibold text-[color:var(--brand-navy)]">
              {row.name}
            </span>
            <span
              className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${bandClass(row.band)}`}
            >
              {row.band}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-[color:var(--brand-navy)]/80">
            {row.headline}
          </p>
          <p className="truncate text-[11px] text-[color:var(--brand-navy)]/80">
            {row.meta} · {row.stage}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-[family-name:var(--brand-font-display)] text-xl font-semibold leading-none text-[color:var(--brand-navy)]">
            {row.score}
          </div>
          <div className="text-[9px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/80">
            / 100
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {row.categories.map((c) => (
          <div key={c.label} className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/80">
                {c.label}
              </p>
              <span className="shrink-0 text-[10px] font-semibold tabular-nums text-[color:var(--brand-navy)]">
                {c.value}
              </span>
            </div>
            <div className="mt-1">
              <ScoreBar value={c.value} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <span
              key={a.label}
              aria-hidden
              className={
                "inline-flex flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-[9px] font-semibold " +
                (a.primary
                  ? "border-transparent bg-[color:var(--brand-navy)] text-white"
                  : "border-[color:var(--brand-navy)]/12 bg-white text-[color:var(--brand-navy)]/80")
              }
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {a.label}
            </span>
          );
        })}
      </div>
    </li>
  );
}

function PhoneMock() {
  return (
    <div className="mx-auto w-full max-w-[340px]">
      <div className="rounded-[2.25rem] border border-[color:var(--brand-navy)]/15 bg-[color:var(--brand-navy)]/[0.04] p-2 shadow-[var(--brand-shadow-lg)]">
        <div className="overflow-hidden rounded-[1.75rem] border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)]">
          {/* Status strip */}
          <div className="flex items-center justify-between bg-white px-4 pb-1 pt-2 text-[10px] font-semibold text-[color:var(--brand-navy)]/70">
            <span>9:41</span>
            <span
              aria-hidden
              className="h-1.5 w-16 rounded-full bg-[color:var(--brand-navy)]/15"
            />
            <span>TaaSFlow</span>
          </div>

          {/* App header */}
          <div className="bg-white px-4 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-navy)]/80">
                  Week 2 delivery
                </p>
                <p className="truncate text-sm font-semibold text-[color:var(--brand-navy)]">
                  Senior Product Designer
                </p>
              </div>
              <span
                aria-hidden
                className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[color:var(--brand-navy)]/12 bg-white text-[color:var(--brand-navy)]"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[color:var(--brand-ocean)]" />
              </span>
            </div>

            {/* Pipeline strip */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { n: "3", l: "New" },
                { n: "5", l: "Shortlist" },
                { n: "2", l: "Interview" },
              ].map((p) => (
                <div
                  key={p.l}
                  className="rounded-xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] px-2 py-1.5 text-center"
                >
                  <div className="font-[family-name:var(--brand-font-display)] text-base font-semibold leading-none text-[color:var(--brand-navy)]">
                    {p.n}
                  </div>
                  <div className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/80">
                    {p.l}
                  </div>
                </div>
              ))}
            </div>

            {/* Search + filters */}
            <div className="mt-3 flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-[color:var(--brand-navy)]/12 bg-[color:var(--brand-paper)] px-3 py-1.5 text-[11px] text-[color:var(--brand-navy)]/70">
                <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">Search candidates</span>
              </div>
              <span
                aria-hidden
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[color:var(--brand-navy)]/12 bg-white text-[color:var(--brand-navy)]"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <span
                  key={f.label}
                  aria-hidden
                  className={
                    "rounded-full border px-2.5 py-1 text-[10px] font-semibold " +
                    (f.active
                      ? "border-transparent bg-[color:var(--brand-navy)] text-white"
                      : "border-[color:var(--brand-navy)]/12 bg-white text-[color:var(--brand-navy)]/80")
                  }
                >
                  {f.label}
                </span>
              ))}
            </div>
          </div>

          {/* Feed */}
          <ul className="space-y-2.5 border-t border-[color:var(--brand-navy)]/8 px-3 py-3">
            {ROWS.map((r) => (
              <CandidateCard key={r.id} row={r} />
            ))}
          </ul>

          {/* Bottom nav */}
          <div className="grid grid-cols-4 border-t border-[color:var(--brand-navy)]/10 bg-white px-2 pb-3 pt-2">
            {NAV.map((n) => {
              const Icon = n.icon;
              return (
                <span
                  key={n.label}
                  aria-hidden
                  className={
                    "flex flex-col items-center gap-1 text-[9px] font-semibold " +
                    (n.active
                      ? "text-[color:var(--brand-ocean-text)]"
                      : "text-[color:var(--brand-navy)]/60")
                  }
                >
                  <Icon className="h-4 w-4" />
                  {n.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardPreview() {
  return (
    <figure className="m-0">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-center lg:gap-12">
        <PhoneMock />

        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-ocean-text)]">
            Hiring, in your pocket
          </p>
          <h3 className="mt-2 font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-3xl">
            Review the week's shortlist between meetings.
          </h3>
          <p className="mt-3 max-w-xl text-[color:var(--brand-navy)]/80">
            The same workspace your team uses on desktop, built to work
            one-handed on a phone.
          </p>

          <ul className="mt-6 space-y-4">
            {HIGHLIGHTS.map((h) => (
              <li key={h.title} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-ocean)]"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[color:var(--brand-navy)]">
                    {h.title}
                  </p>
                  <p className="mt-0.5 text-sm text-[color:var(--brand-navy)]/80">
                    {h.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <Link
            to="/platform"
            className="mt-6 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[color:var(--brand-ocean-text)] hover:text-[color:var(--brand-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
          >
            See the full workspace
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>

      <figcaption className="mt-6 text-xs text-[color:var(--brand-navy)]/80">
        Illustrative dashboard view. Candidate names, scores, and roles are
        anonymized examples — not real candidates.
      </figcaption>
    </figure>
  );
}
