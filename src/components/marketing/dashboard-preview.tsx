/**
 * Homepage dashboard preview — a static, anonymized rendering of the client
 * candidate dashboard. Illustrative data only (clearly labelled), no live
 * queries, no fabricated customer identities.
 */
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  MessageSquare,
  XCircle,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

type Row = {
  id: string;
  initials: string;
  name: string;
  headline: string;
  location: string;
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
    headline: "Senior Product Designer · 8 yrs · B2B SaaS",
    location: "Lisbon, PT · Remote-friendly",
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
    headline: "Senior Product Designer · 7 yrs · Fintech",
    location: "Berlin, DE · Hybrid",
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
    headline: "Senior Product Designer · 9 yrs · Marketplaces",
    location: "Remote · CET timezone",
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
  { label: "Request Info", icon: MessageSquare, primary: false },
  { label: "Reject", icon: XCircle, primary: false },
] as const;

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
      className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--brand-navy)]/10"
      role="presentation"
    >
      <div
        className="h-full rounded-full bg-[color:var(--brand-ocean)]"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export function DashboardPreview() {
  return (
    <figure className="m-0">
      <div className="overflow-hidden rounded-2xl border border-[color:var(--brand-navy)]/12 bg-white shadow-[var(--brand-shadow-lg)]">
        {/* Window chrome */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-navy)]/80">
              Client workspace · Shortlist
            </p>
            <p className="truncate text-sm font-semibold text-[color:var(--brand-navy)]">
              Senior Product Designer · Week 2 delivery
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-[color:var(--brand-navy)]/80">
            <span className="rounded-full border border-[color:var(--brand-navy)]/12 bg-white px-2.5 py-1">
              3 new candidates
            </span>
            <span className="rounded-full border border-[color:var(--brand-navy)]/12 bg-white px-2.5 py-1">
              Scored 0–100
            </span>
          </div>
        </div>

        {/* Column labels — desktop only */}
        <div className="hidden grid-cols-[minmax(0,1.25fr)_minmax(0,1.6fr)_auto] gap-4 border-b border-[color:var(--brand-navy)]/8 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/80 lg:grid">
          <span>Candidate</span>
          <span>Role Fit · Evidence · Logistics · Signal</span>
          <span className="text-right">Decision</span>
        </div>

        <ul className="divide-y divide-[color:var(--brand-navy)]/8">
          {ROWS.map((r) => (
            <li
              key={r.id}
              className="grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1.6fr)_auto] lg:items-center"
            >
              {/* Identity + overall score */}
              <div className="flex min-w-0 items-start gap-3">
                <span
                  aria-hidden
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color:var(--brand-navy)]/[0.07] text-xs font-semibold text-[color:var(--brand-navy)]"
                >
                  {r.initials}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[color:var(--brand-navy)]">
                      {r.name}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${bandClass(r.band)}`}
                    >
                      {r.band}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[color:var(--brand-navy)]/80">
                    {r.headline}
                  </p>
                  <p className="truncate text-xs text-[color:var(--brand-navy)]/80">
                    {r.location} · {r.stage}
                  </p>
                </div>
                <div className="ml-auto shrink-0 text-right lg:hidden">
                  <div className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold leading-none text-[color:var(--brand-navy)]">
                    {r.score}
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/80">
                    / 100
                  </div>
                </div>
              </div>

              {/* Category scores */}
              <div className="flex items-center gap-4">
                <div className="hidden shrink-0 text-right lg:block">
                  <div className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold leading-none text-[color:var(--brand-navy)]">
                    {r.score}
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/80">
                    / 100
                  </div>
                </div>
                <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
                  {r.categories.map((c) => (
                    <div key={c.label} className="min-w-0">
                      <dt className="truncate text-[10px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/80">
                        {c.label}
                      </dt>
                      <div className="mt-1 flex items-center gap-2">
                        <ScoreBar value={c.value} />
                        <dd className="shrink-0 text-[11px] font-semibold tabular-nums text-[color:var(--brand-navy)]">
                          {c.value}
                        </dd>
                      </div>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-1.5 lg:justify-end">
                {ACTIONS.map((a) => {
                  const Icon = a.icon;
                  return (
                    <span
                      key={a.label}
                      aria-hidden
                      className={
                        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold " +
                        (a.primary
                          ? "border-transparent bg-[color:var(--brand-navy)] text-white"
                          : "border-[color:var(--brand-navy)]/15 bg-white text-[color:var(--brand-navy)]/80")
                      }
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                      {a.label}
                    </span>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--brand-navy)]/8 bg-[color:var(--brand-paper)] px-4 py-3 text-xs text-[color:var(--brand-navy)]/80 sm:px-5">
          <span>
            Every score links to the recruiter-written evidence behind it.
          </span>
          <Link
            to="/platform"
            className="inline-flex items-center gap-1 font-semibold text-[color:var(--brand-ocean-text)] hover:text-[color:var(--brand-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
          >
            See the full workspace <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>

      <figcaption className="mt-3 text-xs text-[color:var(--brand-navy)]/80">
        Illustrative dashboard view. Candidate names, scores, and roles are
        anonymized examples — not real candidates.
      </figcaption>
    </figure>
  );
}
