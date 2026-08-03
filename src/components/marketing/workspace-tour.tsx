import { useState } from "react";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  UserSquare2,
  GitCompare,
  MessageSquare,
  CheckCircle2,
  Circle,
  Star,
  ArrowUpRight,
  Clock,
  Send,
  FileText,
  Activity,
} from "lucide-react";

type ViewKey =
  | "overview"
  | "positions"
  | "candidates"
  | "detail"
  | "compare"
  | "collab";

type View = {
  key: ViewKey;
  label: string;
  icon: typeof LayoutDashboard;
  explanation: string;
  value: string;
};

const VIEWS: View[] = [
  {
    key: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    explanation: "Every action, active role, and delivery in one glance.",
    value: "You always know what needs your attention next.",
  },
  {
    key: "positions",
    label: "Positions",
    icon: Briefcase,
    explanation: "Pipeline health and search activity per role.",
    value: "See where every position stands without asking.",
  },
  {
    key: "candidates",
    label: "Candidates",
    icon: Users,
    explanation: "Ranked candidates across all your open roles.",
    value: "The strongest fit surfaces at the top, always.",
  },
  {
    key: "detail",
    label: "Candidate detail",
    icon: UserSquare2,
    explanation: "Fit, requirement coverage, evidence, and interview questions.",
    value: "Decide with quoted proof, not guesswork.",
  },
  {
    key: "compare",
    label: "Comparison",
    icon: GitCompare,
    explanation: "Side-by-side across the requirements that matter for the role.",
    value: "Choose between finalists in minutes.",
  },
  {
    key: "collab",
    label: "Collaboration",
    icon: MessageSquare,
    explanation: "Messages, activity, and decisions in one thread per role.",
    value: "Your team stays aligned without status meetings.",
  },
];

export function WorkspaceTour() {
  const [active, setActive] = useState<ViewKey>("overview");
  const view = VIEWS.find((v) => v.key === active)!;

  return (
    <div className="mt-10">
      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Client workspace tour"
        className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {VIEWS.map((v) => {
          const Icon = v.icon;
          const isActive = v.key === active;
          return (
            <button
              key={v.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(v.key)}
              className={`inline-flex shrink-0 snap-start items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? "border-[color:var(--brand-ocean-text)] bg-[color:var(--brand-ocean-text)] text-white"
                  : "border-[color:var(--brand-navy)]/15 bg-white text-[color:var(--brand-navy)]/80 hover:border-[color:var(--brand-ocean)]/40 hover:text-[color:var(--brand-navy)]"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {v.label}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Product visual */}
        <div className="relative overflow-hidden rounded-2xl border border-[color:var(--brand-navy)]/10 bg-gradient-to-br from-white to-[color:var(--brand-mist)]/40 shadow-sm">
          <div className="flex items-center gap-1.5 border-b border-[color:var(--brand-navy)]/8 bg-white/60 px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--brand-chrome-close)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--brand-chrome-minimise)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--brand-chrome-expand)]" />
            <span className="ml-3 text-xs font-medium text-[color:var(--brand-navy)]/80">
              taasflow.com / workspace / {view.label.toLowerCase()}
            </span>
          </div>
          <div className="p-4 sm:p-6">
            {active === "overview" && <OverviewVisual />}
            {active === "positions" && <PositionsVisual />}
            {active === "candidates" && <CandidatesVisual />}
            {active === "detail" && <DetailVisual />}
            {active === "compare" && <CompareVisual />}
            {active === "collab" && <CollabVisual />}
          </div>
        </div>

        {/* Explanation */}
        <div className="flex flex-col justify-between rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-[color:var(--brand-ocean-text)]">
              {view.label}
            </div>
            <p className="mt-3 text-lg font-semibold leading-snug text-[color:var(--brand-navy)]">
              {view.explanation}
            </p>
          </div>
          <div className="mt-6 rounded-lg bg-[color:var(--brand-mist)]/50 p-4 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">
            <span className="block text-[10px] font-semibold uppercase tracking-widest text-[color:var(--brand-navy)]/80">
              Why it matters
            </span>
            <span className="mt-1 block font-medium text-[color:var(--brand-navy)]">
              {view.value}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- annotation helper ---------- */
function Annotation({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-[color:var(--brand-ocean)]/20 bg-white/95 px-2.5 py-1.5 text-xs shadow-sm">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[color:var(--brand-ocean)] text-[10px] font-bold text-white">
        {n}
      </span>
      <span className="text-[color:var(--brand-navy)]/85">{children}</span>
    </div>
  );
}

function Panel({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-[color:var(--brand-navy)]/10 bg-white p-3 ${className}`}
    >
      {title ? (
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[color:var(--brand-navy)]/80">
          {title}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/* ---------- OVERVIEW ---------- */
function OverviewVisual() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Panel title="Active roles">
        <div className="text-3xl font-bold text-[color:var(--brand-navy)]">4</div>
        <div className="mt-1 text-xs text-[color:var(--brand-navy)]/80">
          2 delivering · 2 sourcing
        </div>
      </Panel>
      <Panel title="Candidates delivered">
        <div className="text-3xl font-bold text-[color:var(--brand-navy)]">12</div>
        <div className="mt-1 text-xs text-[color:var(--brand-navy)]/80">
          Awaiting your review
        </div>
      </Panel>
      <Panel title="Progress this week">
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[color:var(--brand-mist)]">
          <div className="h-full w-[68%] rounded-full bg-[color:var(--brand-ocean)]" />
        </div>
        <div className="mt-1 text-xs text-[color:var(--brand-navy)]/80">
          68% of weekly targets
        </div>
      </Panel>
      <Panel title="Actions needed" className="md:col-span-2">
        <ul className="space-y-1.5 text-xs text-[color:var(--brand-navy)]/80">
          <li className="flex items-center gap-2">
            <Circle className="h-3 w-3 text-[color:var(--brand-ocean-text)]" />
            Review 3 candidates for Head of Growth
          </li>
          <li className="flex items-center gap-2">
            <Circle className="h-3 w-3 text-[color:var(--brand-ocean-text)]" />
            Approve interview slot — Alex R.
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-3 w-3 text-[color:var(--brand-navy)]/80" />
            <span className="line-through opacity-85">Confirm role brief — Data Eng</span>
          </li>
        </ul>
      </Panel>
      <div className="flex flex-col gap-2 md:col-span-1">
        <Annotation n={1}>Live pipeline health</Annotation>
        <Annotation n={2}>What needs you today</Annotation>
        <Annotation n={3}>Weekly delivery progress</Annotation>
      </div>
    </div>
  );
}

/* ---------- POSITIONS ---------- */
function PositionsVisual() {
  const rows = [
    { role: "Head of Growth", sourced: 42, screened: 12, delivered: 3, stage: "Delivering" },
    { role: "Senior Data Engineer", sourced: 28, screened: 7, delivered: 2, stage: "Sourcing" },
    { role: "Product Designer", sourced: 51, screened: 18, delivered: 4, stage: "Delivering" },
  ];
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.role}
              className="rounded-lg border border-[color:var(--brand-navy)]/10 bg-white p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[color:var(--brand-navy)]">
                    {r.role}
                  </div>
                  <div className="text-[11px] text-[color:var(--brand-navy)]/80">
                    {r.stage} · updated 2h ago
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-[color:var(--brand-ocean)]/10 px-2 py-0.5 text-[10px] font-semibold text-[color:var(--brand-ocean-text)]">
                  {r.stage}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className="rounded bg-[color:var(--brand-mist)]/40 py-1.5">
                  <div className="font-bold text-[color:var(--brand-navy)]">{r.sourced}</div>
                  <div className="text-[color:var(--brand-navy)]/80">Sourced</div>
                </div>
                <div className="rounded bg-[color:var(--brand-mist)]/40 py-1.5">
                  <div className="font-bold text-[color:var(--brand-navy)]">{r.screened}</div>
                  <div className="text-[color:var(--brand-navy)]/80">Screened</div>
                </div>
                <div className="rounded bg-[color:var(--brand-ocean)]/10 py-1.5">
                  <div className="font-bold text-[color:var(--brand-ocean-text)]">{r.delivered}</div>
                  <div className="text-[color:var(--brand-navy)]/80">Delivered</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <Annotation n={1}>Every open role at a glance</Annotation>
          <Annotation n={2}>Funnel stage per position</Annotation>
          <Annotation n={3}>Search activity is live</Annotation>
        </div>
      </div>
    </div>
  );
}

/* ---------- CANDIDATES ---------- */
function CandidatesVisual() {
  const cands = [
    { name: "Alex Rivera", role: "Head of Growth", score: 92 },
    { name: "Priya Menon", role: "Head of Growth", score: 88 },
    { name: "Daniel Kim", role: "Senior Data Engineer", score: 85 },
    { name: "Sofia Alvarez", role: "Product Designer", score: 83 },
    { name: "Marc Weber", role: "Product Designer", score: 79 },
  ];
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
      <div className="space-y-1.5">
        {cands.map((c, i) => (
          <div
            key={c.name}
            className="flex items-center gap-3 rounded-lg border border-[color:var(--brand-navy)]/10 bg-white px-3 py-2"
          >
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[color:var(--brand-ocean)]/10 text-xs font-bold text-[color:var(--brand-ocean-text)]">
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-[color:var(--brand-navy)]">
                {c.name}
              </div>
              <div className="truncate text-[11px] text-[color:var(--brand-navy)]/80">
                {c.role}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 text-sm font-bold text-[color:var(--brand-ocean-text)]">
              <Star className="h-3.5 w-3.5 fill-current" /> {c.score}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <Annotation n={1}>Ranked by role-specific fit</Annotation>
        <Annotation n={2}>Scores from verified evidence</Annotation>
        <Annotation n={3}>Cross-role, one place</Annotation>
      </div>
    </div>
  );
}

/* ---------- DETAIL ---------- */
function DetailVisual() {
  const reqs = [
    { label: "B2B growth leadership", pct: 95 },
    { label: "Paid + lifecycle owned", pct: 88 },
    { label: "Team of 5+ managed", pct: 82 },
    { label: "SaaS $10M→$50M ARR", pct: 76 },
  ];
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg bg-[color:var(--brand-ocean)]/10 px-3 py-2">
          <div>
            <div className="text-sm font-bold text-[color:var(--brand-navy)]">Alex Rivera</div>
            <div className="text-[11px] text-[color:var(--brand-navy)]/80">Head of Growth · Fit 92</div>
          </div>
          <div className="text-2xl font-black text-[color:var(--brand-ocean-text)]">92</div>
        </div>
        <Panel title="Requirement coverage">
          <div className="space-y-2">
            {reqs.map((r) => (
              <div key={r.label}>
                <div className="mb-0.5 flex justify-between text-[11px]">
                  <span className="text-[color:var(--brand-navy)]/80">{r.label}</span>
                  <span className="font-semibold text-[color:var(--brand-navy)]">{r.pct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--brand-mist)]">
                  <div
                    className="h-full rounded-full bg-[color:var(--brand-ocean)]"
                    style={{ width: `${r.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Evidence">
          <p className="text-[11px] italic leading-relaxed text-[color:var(--brand-navy)]/80">
            "Scaled paid + lifecycle from $12M to $47M ARR in 22 months, managing a team of 7."
          </p>
          <div className="mt-1 text-[10px] text-[color:var(--brand-navy)]/80">
            CV, p.1 · verified
          </div>
        </Panel>
      </div>
      <div className="flex flex-col gap-2">
        <Annotation n={1}>Fit score with reasoning</Annotation>
        <Annotation n={2}>Coverage per requirement</Annotation>
        <Annotation n={3}>Quoted evidence, sourced</Annotation>
      </div>
    </div>
  );
}

/* ---------- COMPARE ---------- */
function CompareVisual() {
  const rows = [
    { req: "Growth leadership", a: 95, b: 88, c: 74 },
    { req: "Paid + lifecycle", a: 88, b: 92, c: 80 },
    { req: "Team management", a: 82, b: 70, c: 85 },
    { req: "SaaS scale $10→50M", a: 76, b: 85, c: 60 },
  ];
  const bar = (n: number) => (
    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[color:var(--brand-mist)]">
      <div className="h-full rounded-full bg-[color:var(--brand-ocean)]" style={{ width: `${n}%` }} />
    </div>
  );
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
      <div className="overflow-hidden rounded-lg border border-[color:var(--brand-navy)]/10 bg-white">
        <div className="grid grid-cols-4 gap-2 border-b border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 px-3 py-2 text-[11px] font-semibold text-[color:var(--brand-navy)]/80">
          <span>Requirement</span>
          <span className="text-center">Alex R.</span>
          <span className="text-center">Priya M.</span>
          <span className="text-center">Daniel K.</span>
        </div>
        {rows.map((r) => (
          <div
            key={r.req}
            className="grid grid-cols-4 items-center gap-2 border-b border-[color:var(--brand-navy)]/5 px-3 py-2 text-[11px] last:border-b-0"
          >
            <span className="truncate text-[color:var(--brand-navy)]/85">{r.req}</span>
            <div className="flex items-center justify-center gap-1.5">
              {bar(r.a)}
              <span className="w-7 text-right font-semibold text-[color:var(--brand-navy)]">
                {r.a}
              </span>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              {bar(r.b)}
              <span className="w-7 text-right font-semibold text-[color:var(--brand-navy)]">
                {r.b}
              </span>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              {bar(r.c)}
              <span className="w-7 text-right font-semibold text-[color:var(--brand-navy)]">
                {r.c}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <Annotation n={1}>Role-specific requirements</Annotation>
        <Annotation n={2}>Same evidence, side by side</Annotation>
        <Annotation n={3}>Pick your finalist faster</Annotation>
      </div>
    </div>
  );
}

/* ---------- COLLAB ---------- */
function CollabVisual() {
  const feed = [
    {
      icon: Send,
      who: "TaaSFlow",
      text: "Delivered 3 candidates for Head of Growth.",
      when: "2h ago",
    },
    {
      icon: MessageSquare,
      who: "You",
      text: "Move Alex R. to onsite — align on comp.",
      when: "1h ago",
    },
    {
      icon: FileText,
      who: "Maria (your team)",
      text: "Uploaded final scorecard for Priya.",
      when: "35m ago",
    },
    {
      icon: Activity,
      who: "System",
      text: "Interview scheduled — Thu 3:00 PM.",
      when: "10m ago",
    },
  ];
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
      <div className="space-y-2">
        {feed.map((f, i) => {
          const Icon = f.icon;
          return (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border border-[color:var(--brand-navy)]/10 bg-white px-3 py-2"
            >
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[color:var(--brand-ocean)]/10 text-[color:var(--brand-ocean-text)]">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="font-semibold text-[color:var(--brand-navy)]">{f.who}</span>
                  <span className="inline-flex items-center gap-0.5 text-[color:var(--brand-navy)]/80">
                    <Clock className="h-2.5 w-2.5" /> {f.when}
                  </span>
                </div>
                <p className="text-[12px] text-[color:var(--brand-navy)]/85">{f.text}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-2">
        <Annotation n={1}>One thread per role</Annotation>
        <Annotation n={2}>Team + TaaSFlow together</Annotation>
        <Annotation n={3}>Every action logged</Annotation>
      </div>
    </div>
  );
}

export { ArrowUpRight };
