import * as React from "react";
import {
  ClipboardList,
  Search,
  FileText,
  BarChart3,
  Users,
  MessagesSquare,
  Check,
  Quote,
  ArrowRight,
  Building2,
  Linkedin,
  Globe,
  Network,
  UserPlus,
  Archive,
  Megaphone,
  GraduationCap,
  Mail,
  Radar,
  Radio,
  Phone,
  Briefcase,
  Handshake,
  Sparkles,
  Signpost,
  Mic,
  Podcast,
  MapPin,
  Github,
  Youtube,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─────────────────────────── shared chrome ─────────────────────────── */

function MockChrome({
  title,
  children,
  tint = "white",
}: {
  title: string;
  children: React.ReactNode;
  tint?: "white" | "cream";
}) {
  return (
    <div
      role="img"
      aria-label={`TaaSFlow ${title} preview`}
      className={cn(
        "min-w-0 overflow-hidden rounded-2xl border border-[color:var(--brand-navy)]/12 shadow-sm",
        tint === "cream" ? "bg-[color:var(--brand-cream)]" : "bg-white",
      )}
    >
      <div className="flex items-center gap-2 border-b border-[color:var(--brand-navy)]/10 bg-white px-4 py-2.5">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-400/70" aria-hidden />
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-yellow-400/70" aria-hidden />
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-400/70" aria-hidden />
        <span className="ml-3 min-w-0 flex-1 truncate text-xs font-medium text-[color:var(--brand-navy)]/70">
          {title}
        </span>
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
          Fictional example
        </span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

/* ─────────────────────── 1 · Role blueprint mockup ────────────────────── */

export function RoleBlueprintMock() {
  return (
    <MockChrome title="Intake · Role blueprint">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-[color:var(--brand-navy)]/10 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/55">
            Role
          </p>
          <p className="mt-1 text-sm font-semibold text-[color:var(--brand-navy)]">
            Senior Backend Engineer
          </p>
          <p className="mt-0.5 text-xs text-[color:var(--brand-navy)]/65">
            Remote · EU · €90–110k · Series B fintech
          </p>
        </div>
        <div className="rounded-lg border border-[color:var(--brand-navy)]/10 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/55">
            Search plan
          </p>
          <p className="mt-1 text-xs text-[color:var(--brand-navy)]/75">
            Target: 12 companies · 3 seniority bands · 2 timezones · screening
            call before publication
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-[color:var(--brand-navy)]/10 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/55">
          Scoring rubric (weights approved at intake)
        </p>
        <ul className="mt-2 space-y-1.5">
          {[
            { label: "Distributed systems at scale", w: 30 },
            { label: "Go or Rust in production", w: 25 },
            { label: "Regulated / fintech context", w: 20 },
            { label: "Team leadership signals", w: 15 },
            { label: "Timezone overlap (CET ± 3h)", w: 10 },
          ].map((r) => (
            <li
              key={r.label}
              className="grid grid-cols-[minmax(0,1fr)_140px_36px] items-center gap-3"
            >
              <span className="truncate text-xs text-[color:var(--brand-navy)]/75">
                {r.label}
              </span>
              <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--brand-navy)]/10">
                <div
                  className="h-full rounded-full bg-[color:var(--brand-navy)]"
                  style={{ width: `${r.w * 3}%` }}
                />
              </div>
              <span className="text-right text-[11px] font-semibold text-[color:var(--brand-navy)]/70">
                {r.w}%
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {["Must-have: production Go", "Nice: fintech", "Must-have: on-call maturity", "Deal-breaker: no distributed systems"].map(
          (t) => (
            <span
              key={t}
              className="rounded-full bg-[color:var(--brand-navy)]/6 px-2.5 py-1 text-[11px] font-medium text-[color:var(--brand-navy)]/75"
            >
              {t}
            </span>
          ),
        )}
      </div>
    </MockChrome>
  );
}

/* ─────────────────────── 2 · Sourcing ecosystem map ──────────────────── */

export function SourcingEcosystemMap() {
  const groups: Array<{
    heading: string;
    caption: string;
    channels: Array<{ label: string; note: string; icon: React.ReactNode }>;
  }> = [
    {
      heading: "Digital & professional networks",
      caption: "Where the passive market lives.",
      channels: [
        { label: "LinkedIn deep sourcing", note: "Boolean + narrative screens across 900M profiles", icon: <Linkedin className="h-4 w-4" aria-hidden /> },
        { label: "LinkedIn sponsored ads", note: "Targeted role-specific campaigns to passive talent", icon: <Megaphone className="h-4 w-4" aria-hidden /> },
        { label: "GitHub / Stack Overflow", note: "Signal-based sourcing for technical roles", icon: <Github className="h-4 w-4" aria-hidden /> },
        { label: "Niche communities", note: "Slack, Discord, sub-industry forums", icon: <Users className="h-4 w-4" aria-hidden /> },
      ],
    },
    {
      heading: "Direct & proprietary",
      caption: "Recruiter-owned reach, not rented lists.",
      channels: [
        { label: "Named-target outreach", note: "Precision headhunting by named account", icon: <UserPlus className="h-4 w-4" aria-hidden /> },
        { label: "Talent network", note: "Curated pool from 20,000+ prior placements", icon: <Network className="h-4 w-4" aria-hidden /> },
        { label: "Silver medalists", note: "Rehydrated finalists from previous roles", icon: <Archive className="h-4 w-4" aria-hidden /> },
        { label: "Executive recruiter bench", note: "20+ senior recruiters across geographies", icon: <Briefcase className="h-4 w-4" aria-hidden /> },
      ],
    },
    {
      heading: "AI & intent intelligence",
      caption: "Where high-intent signals surface first.",
      channels: [
        { label: "Web-scale intent scanning", note: "Public signals: posts, layoffs, moves, launches", icon: <Radar className="h-4 w-4" aria-hidden /> },
        { label: "AI passive-market mining", note: "Semantic match across 2M+ candidate data points", icon: <Sparkles className="h-4 w-4" aria-hidden /> },
        { label: "Compensation & market data", note: "Live benchmarks per region and function", icon: <BarChart3 className="h-4 w-4" aria-hidden /> },
      ],
    },
    {
      heading: "Inbound & marketing",
      caption: "A funnel that keeps compounding.",
      channels: [
        { label: "Public job board", note: "Applicants scored on the same rubric", icon: <Globe className="h-4 w-4" aria-hidden /> },
        { label: "Email marketing", note: "Segmented nurture to opted-in talent", icon: <Mail className="h-4 w-4" aria-hidden /> },
        { label: "Employer branding campaigns", note: "Client-branded landing pages and creative", icon: <Send className="h-4 w-4" aria-hidden /> },
        { label: "YouTube & podcast presence", note: "Founders and clients on relevant shows", icon: <Podcast className="h-4 w-4" aria-hidden /> },
      ],
    },
    {
      heading: "Partnerships & offline",
      caption: "Real-world reach most tech tools skip.",
      channels: [
        { label: "University partnerships", note: "Early-career pipelines with target schools", icon: <GraduationCap className="h-4 w-4" aria-hidden /> },
        { label: "Staffing & agency partners", note: "Whitelabel bench across 50+ countries", icon: <Handshake className="h-4 w-4" aria-hidden /> },
        { label: "Cold outreach team", note: "Phone, WhatsApp, email — human, calibrated", icon: <Phone className="h-4 w-4" aria-hidden /> },
        { label: "Job boards & aggregators", note: "Indeed, Otta, Wellfound, regional boards", icon: <Signpost className="h-4 w-4" aria-hidden /> },
        { label: "Referrals & network intros", note: "Curated warm intros with attribution", icon: <MessagesSquare className="h-4 w-4" aria-hidden /> },
        { label: "Events, meetups, conferences", note: "In-person sourcing where the domain gathers", icon: <MapPin className="h-4 w-4" aria-hidden /> },
        { label: "Radio, billboards & OOH", note: "For high-volume, geo-anchored campaigns", icon: <Radio className="h-4 w-4" aria-hidden /> },
        { label: "PR & industry press", note: "Signal to senior talent through trusted outlets", icon: <Mic className="h-4 w-4" aria-hidden /> },
      ],
    },
  ];

  const total = groups.reduce((n, g) => n + g.channels.length, 0);

  return (
    <MockChrome title={`Sourcing · ${total}+ channels feeding one rubric`} tint="cream">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--brand-navy)]/15 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]">
          <Sparkles className="h-3 w-3" aria-hidden />
          {total} channels · one scoring bar
        </div>
        <div className="text-[11px] text-[color:var(--brand-navy)]/60">
          Grouped by how candidates surface
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <div
            key={g.heading}
            className="rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-3"
          >
            <div className="mb-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/70">
                {g.heading}
              </div>
              <div className="text-[11px] text-[color:var(--brand-navy)]/55">
                {g.caption}
              </div>
            </div>
            <ul className="grid gap-1.5">
              {g.channels.map((c) => (
                <ChannelPill key={c.label} {...c} />
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-[color:var(--brand-navy)]/65">
        Every candidate — regardless of channel — is evaluated against the same
        approved rubric. No side-doors that skip evidence. No channel gets a
        shortcut past the scoring bar.
      </p>
    </MockChrome>
  );
}

function ChannelPill({
  icon,
  label,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  note: string;
}) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-[color:var(--brand-navy)]/10 bg-white px-3 py-2.5">
      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[color:var(--brand-navy)]/8 text-[color:var(--brand-navy)]">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-[color:var(--brand-navy)]">
          {label}
        </div>
        <div className="truncate text-[11px] text-[color:var(--brand-navy)]/65">
          {note}
        </div>
      </div>
    </li>
  );
}

/* ─────────────────────── 3 · Evidence review panel ───────────────────── */

export function EvidenceReviewPanel() {
  const items = [
    {
      requirement: "Distributed systems at scale",
      quote:
        "Led migration of transaction ledger from monolith to 6 event-sourced services (~2.3B events/mo).",
      verdict: "Match" as const,
    },
    {
      requirement: "Go or Rust in production",
      quote:
        "Primary stack: Go 1.22, gRPC, PostgreSQL. Owned the payments-service since 2022.",
      verdict: "Match" as const,
    },
    {
      requirement: "Regulated / fintech context",
      quote:
        "Worked at a UK-regulated e-money institution; contributed to PSD2 and SCA audit prep.",
      verdict: "Partial" as const,
    },
    {
      requirement: "Team leadership signals",
      quote:
        "Mentored 3 engineers; drove hiring loop for backend team. No direct-report title.",
      verdict: "Partial" as const,
    },
  ];
  return (
    <MockChrome title="Admin review · Evidence per requirement">
      <div className="rounded-lg border border-[color:var(--brand-navy)]/10 p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[color:var(--brand-navy)]">
              Candidate #B-2178
            </p>
            <p className="text-[11px] text-[color:var(--brand-navy)]/60">
              Reviewed by recruiter before publication
            </p>
          </div>
          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            Approved to publish
          </span>
        </div>

        <ul className="mt-3 space-y-2.5">
          {items.map((i) => (
            <li key={i.requirement} className="rounded-md bg-[color:var(--brand-cream)] p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-[color:var(--brand-navy)]">
                  {i.requirement}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    i.verdict === "Match"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-800",
                  )}
                >
                  {i.verdict}
                </span>
              </div>
              <p className="mt-1.5 flex gap-2 text-[11px] italic text-[color:var(--brand-navy)]/75">
                <Quote className="mt-0.5 h-3 w-3 shrink-0 text-[color:var(--brand-navy)]/40" aria-hidden />
                <span>{i.quote}</span>
              </p>
            </li>
          ))}
        </ul>

        <p className="mt-3 text-[11px] text-[color:var(--brand-navy)]/65">
          Every score has a quote. Every quote has a source line. If a requirement
          isn't evidenced, the candidate isn't published.
        </p>
      </div>
    </MockChrome>
  );
}

/* ─────────────────────── 4 · Ranking demo (interactive) ─────────────── */

type RankRow = {
  id: string;
  ref: string;
  role: string;
  scores: { label: string; v: number }[];
  fit: string;
};

const RANK_ROWS: RankRow[] = [
  {
    id: "B-2178",
    ref: "B-2178",
    role: "Senior Backend Engineer",
    scores: [
      { label: "Distributed systems", v: 95 },
      { label: "Go in production", v: 92 },
      { label: "Fintech context", v: 74 },
      { label: "Leadership signals", v: 62 },
    ],
    fit: "Deep production experience with event-sourced payments. Fintech exposure is real but recent (18 months). No formal direct reports; strong mentorship signal.",
  },
  {
    id: "B-2154",
    ref: "B-2154",
    role: "Senior Backend Engineer",
    scores: [
      { label: "Distributed systems", v: 88 },
      { label: "Go in production", v: 80 },
      { label: "Fintech context", v: 92 },
      { label: "Leadership signals", v: 78 },
    ],
    fit: "5 years in regulated fintech; led a 4-engineer squad. Go usage is present but Kotlin is primary. Solid distributed background.",
  },
  {
    id: "B-2201",
    ref: "B-2201",
    role: "Senior Backend Engineer",
    scores: [
      { label: "Distributed systems", v: 72 },
      { label: "Go in production", v: 96 },
      { label: "Fintech context", v: 40 },
      { label: "Leadership signals", v: 55 },
    ],
    fit: "Very strong Go — maintains an OSS library. Distributed systems experience is real but smaller-scale. No fintech background.",
  },
];

function computeScore(row: RankRow, weights: Record<string, number>): number {
  const total = row.scores.reduce((sum, s) => sum + s.v * (weights[s.label] ?? 0), 0);
  const w = Object.values(weights).reduce((a, b) => a + b, 0);
  return w === 0 ? 0 : Math.round(total / w);
}

export function RankingDemo() {
  const labels = RANK_ROWS[0].scores.map((s) => s.label);
  const [weights, setWeights] = React.useState<Record<string, number>>({
    [labels[0]]: 30,
    [labels[1]]: 25,
    [labels[2]]: 25,
    [labels[3]]: 20,
  });
  const [selected, setSelected] = React.useState<string>(RANK_ROWS[0].id);

  const ranked = React.useMemo(() => {
    return [...RANK_ROWS]
      .map((r) => ({ row: r, score: computeScore(r, weights) }))
      .sort((a, b) => b.score - a.score);
  }, [weights]);

  const activeRow =
    ranked.find((r) => r.row.id === selected)?.row ?? ranked[0].row;
  const activeScore =
    ranked.find((r) => r.row.id === selected)?.score ?? ranked[0].score;

  return (
    <MockChrome title="Client workspace · Ranked shortlist (interactive)">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        {/* Weight controls */}
        <div className="rounded-lg border border-[color:var(--brand-navy)]/10 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/60">
            Rubric weights · adjust to see re-ranking
          </p>
          <ul className="mt-3 space-y-3">
            {labels.map((lab) => (
              <li key={lab}>
                <div className="mb-1 flex items-center justify-between text-[11px] text-[color:var(--brand-navy)]/75">
                  <span>{lab}</span>
                  <span className="font-semibold">{weights[lab]}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={60}
                  step={5}
                  value={weights[lab]}
                  onChange={(e) =>
                    setWeights((w) => ({ ...w, [lab]: Number(e.target.value) }))
                  }
                  aria-label={`Weight for ${lab}`}
                  className="w-full accent-[color:var(--brand-navy)]"
                />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-[color:var(--brand-navy)]/60">
            In your real workspace, weights are approved at intake — this demo just
            shows how the ranking responds to them.
          </p>
        </div>

        {/* Ranked list + active detail */}
        <div className="min-w-0 space-y-3">
          <ul className="space-y-2">
            {ranked.map(({ row, score }, i) => {
              const isActive = row.id === selected;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(row.id)}
                    aria-pressed={isActive}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition",
                      isActive
                        ? "border-[color:var(--brand-navy)] bg-[color:var(--brand-navy)]/[0.04]"
                        : "border-[color:var(--brand-navy)]/10 hover:bg-[color:var(--brand-navy)]/[0.02]",
                    )}
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold text-[color:var(--brand-navy)]">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--brand-navy)]/10 text-[10px]">
                        #{i + 1}
                      </span>
                      Candidate {row.ref}
                    </span>
                    <span className="rounded-md bg-[color:var(--brand-navy)] px-2 py-0.5 text-[11px] font-semibold text-white">
                      {score}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="rounded-lg border border-[color:var(--brand-navy)]/10 bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/60">
              Fit summary · {activeRow.ref} · {activeScore}
            </p>
            <p className="mt-1.5 text-xs text-[color:var(--brand-navy)]/80">
              {activeRow.fit}
            </p>
          </div>
        </div>
      </div>
    </MockChrome>
  );
}

/* ─────────────────────── 5 · Workspace delivery demo ─────────────────── */

export function WorkspaceDeliveryDemo() {
  const stages: { label: string; ids: string[] }[] = [
    { label: "Under review", ids: ["B-2201", "B-2154"] },
    { label: "Interview", ids: ["B-2178"] },
    { label: "Offer", ids: [] },
    { label: "Hired", ids: [] },
  ];
  return (
    <MockChrome title="Client workspace · Pipeline">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stages.map((s) => (
          <div
            key={s.label}
            className="min-h-32 rounded-lg border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-cream)] p-2.5"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/65">
                {s.label}
              </span>
              <span className="rounded-full bg-white px-1.5 text-[10px] font-semibold text-[color:var(--brand-navy)]/70">
                {s.ids.length}
              </span>
            </div>
            <ul className="space-y-1.5">
              {s.ids.map((id) => (
                <li
                  key={id}
                  className="rounded-md border border-[color:var(--brand-navy)]/10 bg-white px-2 py-1.5 text-[11px] font-semibold text-[color:var(--brand-navy)]"
                >
                  {id}
                </li>
              ))}
              {s.ids.length === 0 ? (
                <li className="rounded-md border border-dashed border-[color:var(--brand-navy)]/15 px-2 py-3 text-center text-[10px] text-[color:var(--brand-navy)]/45">
                  Empty
                </li>
              ) : null}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-[color:var(--brand-navy)]/10 p-3">
        <div className="flex items-center gap-2 text-[color:var(--brand-navy)]">
          <MessagesSquare className="h-4 w-4" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            Thread · Senior Backend Engineer
          </span>
        </div>
        <ul className="mt-2 space-y-1.5 text-xs text-[color:var(--brand-navy)]/80">
          <li>
            <span className="font-semibold">TaaSFlow pod:</span> B-2178 moved to
            Interview. Rubric coverage attached. Interview prompts drafted.
          </li>
          <li>
            <span className="font-semibold">Hiring manager:</span> Approved.
            Scheduling with tech lead tomorrow.
          </li>
        </ul>
      </div>
    </MockChrome>
  );
}

/* ─────────────────────── 6 · Client responsibility matrix ─────────────── */

type Owner = "Client" | "TaaSFlow" | "Shared";

export function ResponsibilityMatrix() {
  const rows: { activity: string; owner: Owner; note: string }[] = [
    { activity: "Role definition & must-haves", owner: "Client", note: "Your brief. We ask sharp questions." },
    { activity: "Search plan & rubric weights", owner: "Shared", note: "We propose. You approve before launch." },
    { activity: "Sourcing across channels", owner: "TaaSFlow", note: "Direct outreach, network, inbound, referrals." },
    { activity: "Evidence extraction & review", owner: "TaaSFlow", note: "Every score sourced to a CV quote." },
    { activity: "Publication gate", owner: "TaaSFlow", note: "Nothing reaches you without recruiter approval." },
    { activity: "Interviews & decisions", owner: "Client", note: "Your team runs the loop. We record decisions." },
    { activity: "Feedback loop & re-sourcing", owner: "Shared", note: "Fast feedback triggers another sourcing round." },
    { activity: "Offer & close", owner: "Client", note: "You extend. We support scheduling and comms." },
  ];
  const badge: Record<Owner, string> = {
    Client: "bg-[color:var(--brand-ocean)]/12 text-[color:var(--brand-ocean)]",
    TaaSFlow: "bg-[color:var(--brand-navy)]/10 text-[color:var(--brand-navy)]",
    Shared: "bg-amber-100 text-amber-800",
  };
  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white">
      <div className="grid grid-cols-[minmax(0,1.2fr)_120px_minmax(0,2fr)] gap-0 border-b border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-cream)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/65">
        <span>Activity</span>
        <span>Owner</span>
        <span>How it works</span>
      </div>
      <ul>
        {rows.map((r, i) => (
          <li
            key={r.activity}
            className={cn(
              "grid grid-cols-[minmax(0,1.2fr)_120px_minmax(0,2fr)] items-center gap-3 px-4 py-3 text-sm",
              i < rows.length - 1 && "border-b border-[color:var(--brand-navy)]/8",
            )}
          >
            <span className="font-semibold text-[color:var(--brand-navy)]">
              {r.activity}
            </span>
            <span>
              <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold", badge[r.owner])}>
                {r.owner}
              </span>
            </span>
            <span className="text-[color:var(--brand-navy)]/75">{r.note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────────────────── 7 · Numbered step rail ──────────────────────── */

export function StepRail() {
  const steps = [
    { n: "01", icon: <ClipboardList className="h-4 w-4" aria-hidden />, label: "Intake" },
    { n: "02", icon: <FileText className="h-4 w-4" aria-hidden />, label: "Blueprint" },
    { n: "03", icon: <Search className="h-4 w-4" aria-hidden />, label: "Sourcing" },
    { n: "04", icon: <Check className="h-4 w-4" aria-hidden />, label: "Evidence review" },
    { n: "05", icon: <BarChart3 className="h-4 w-4" aria-hidden />, label: "Ranked delivery" },
    { n: "06", icon: <Users className="h-4 w-4" aria-hidden />, label: "Client review" },
    { n: "07", icon: <Building2 className="h-4 w-4" aria-hidden />, label: "Hire & close" },
  ];
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {steps.map((s, i) => (
        <li
          key={s.n}
          className="relative flex items-center gap-2 rounded-xl border border-[color:var(--brand-navy)]/10 bg-white px-3 py-2.5"
        >
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[color:var(--brand-navy)] text-[10px] font-semibold text-white">
            {s.n}
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="text-[color:var(--brand-navy)]/60">{s.icon}</span>
            <span className="truncate text-xs font-semibold text-[color:var(--brand-navy)]">
              {s.label}
            </span>
          </span>
          {i < steps.length - 1 ? (
            <ArrowRight
              className="pointer-events-none absolute -right-2 top-1/2 hidden h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--brand-navy)]/30 lg:block"
              aria-hidden
            />
          ) : null}
        </li>
      ))}
    </ol>
  );
}
