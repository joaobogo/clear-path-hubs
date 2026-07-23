import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  Eye,
  FileText,
  Handshake,
  LayoutDashboard,
  ListChecks,
  MapPin,
  MessageCircle,
  MessageSquare,
  Quote,
  Radar,
  Repeat,
  Rocket,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  Workflow,
  XCircle,
  Zap,
} from "lucide-react";

import {
  CtaSection,
  PublicPage,
  PublicSection,
  SiteShell,
} from "@/components/marketing/site-shell";

import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

// Homepage metadata is authored inline (guardrail: legacy JSON entry contains
// unapproved "14 days" and totals claims). Do not pass the legacy entry here.
void getPage;

export const Route = createFileRoute("/")({
  head: () =>
    marketingHead(undefined, "/", {
      title: "TaaSFlow — Ranked candidates in a live hiring workspace",
      description:
        "TaaSFlow is subscription recruiting with a live workspace. Ranked candidates, recruiter-written evidence, transparent pipeline, and direct handover after shortlist — no placement fees.",
    }),
  component: Home,
});

/* ---------- Content constants (guardrail-safe: no pricing, no timing, no totals) ---------- */

const WEEKLY_DELIVERABLES = [
  {
    icon: BarChart3,
    t: "A ranked shortlist",
    d: "Candidates scored against the requirements your team approved — highest fit first, with the reasoning in view.",
  },
  {
    icon: Eye,
    t: "Evidence per requirement",
    d: "Recruiter-written notes and CV quotes mapped to every must-have, so decisions are grounded in what the CV actually says.",
  },
  {
    icon: Activity,
    t: "A live pipeline update",
    d: "Every stage — Applied, Under review, Shortlisted, Interview, Offer — reflects the current state, not a weekly snapshot.",
  },
  {
    icon: MessageSquare,
    t: "Direct recruiter contact",
    d: "Message your recruiter in the workspace. Same thread, same context, no forwarded emails.",
  },
] as const;

const AUDIENCE_LANES = [
  {
    icon: Rocket,
    accent: "ocean",
    name: "Founders & Hiring Managers",
    problem:
      "Limited time, no dedicated sourcing capacity, and hires that can't wait for a full internal team to be built.",
    value:
      "An on-demand recruiting function that runs beside you — sourcing, evaluating, and delivering ranked candidates without hiring a full internal team.",
    result: "Interview-ready shortlists on roles you'd otherwise leave open.",
    ctaLabel: "See How It Works",
    ctaTo: "/how-it-works",
  },
  {
    icon: Users,
    accent: "sky",
    name: "HR & Talent Acquisition",
    problem:
      "Recruiters spend too much time sourcing and too little time interviewing, supporting hiring managers, and improving candidate experience.",
    value:
      "Continuous sourcing and ranked candidate delivery through one visible workspace your TA team owns — so recruiters get their calendar back.",
    result: "Sourcing capacity that scales with demand, evidence in view.",
    ctaLabel: "Explore the Model",
    ctaTo: "/solutions",
  },
  {
    icon: Building2,
    accent: "navy",
    name: "Enterprise Hiring Teams",
    problem:
      "High-volume and multi-market hiring becomes fragmented across agencies, regions, and spreadsheets — and expensive to coordinate.",
    value:
      "Structured sourcing capacity, ranked candidate delivery, and portfolio-level visibility across every active role and business unit.",
    result: "One consolidated view across regions, roles, and teams.",
    ctaLabel: "Enterprise Solutions",
    ctaTo: "/enterprise",
  },
  {
    icon: Handshake,
    accent: "sand",
    name: "Staffing & Recruiting Agencies",
    problem:
      "Client demand exceeds internal sourcing capacity — but hiring recruiters to meet peaks doesn't fit the margin structure.",
    value:
      "A scalable sourcing and candidate-delivery partner behind the agency — you keep the client relationship, we extend the bench.",
    result: "More placements fulfilled without expanding headcount.",
    ctaLabel: "Staffing Partnerships",
    ctaTo: "/partnerships/staffing",
  },
] as const;

const SUBSCRIPTION_REASONS = [
  {
    icon: Wallet,
    t: "Predictable pricing",
    d: "A flat monthly fee per active role instead of a percentage of salary owed at hire.",
  },
  {
    icon: Zap,
    t: "Continuous delivery",
    d: "Sourcing keeps running week after week — the pipeline doesn't stop when the first shortlist lands.",
  },
  {
    icon: Compass,
    t: "Aligned incentives",
    d: "We win when your team hires and stays hired. Not when an invoice ships.",
  },
  {
    icon: ShieldCheck,
    t: "Yours to keep",
    d: "Every candidate, every note, every message stays in your workspace — even between roles.",
  },
] as const;

const DELIVERY_EVIDENCE = [
  ["Design systems", 96],
  ["B2B SaaS experience", 92],
  ["Team leadership", 88],
  ["Timezone overlap", 100],
] as const;

const WORKSPACES = [
  {
    icon: LayoutDashboard,
    who: "For operations",
    title: "Admin workspace",
    body: "Publish desk, action items, and pipeline health across every client — one dashboard for the delivery team.",
    bullets: [
      "Publish desk",
      "Prioritized action items",
      "Cross-client pipeline",
      "Full audit trail",
    ],
  },
  {
    icon: Eye,
    who: "For hiring teams",
    title: "Client workspace",
    body: "Ranked candidates, evidence per requirement, Kanban pipeline, and one-click shortlist / interview / offer.",
    bullets: [
      "Ranked delivery",
      "Evidence per requirement",
      "Kanban pipeline",
      "Direct messaging",
    ],
  },
  {
    icon: MessageSquare,
    who: "For candidates",
    title: "Candidate workspace",
    body: "Application status, CV versions, and messages — always in sync with the hiring team on the other side.",
    bullets: [
      "Transparent status",
      "CV versioning",
      "Direct messages",
      "Interview scheduling",
    ],
  },
] as const;

const AGENCY_COMPARE = [
  {
    axis: "Pricing model",
    taasflow: "Flat monthly subscription per active role",
    agency: "Percentage of first-year salary at placement",
  },
  {
    axis: "Where you see the pipeline",
    taasflow: "A live workspace shared with your team",
    agency: "Recruiter's inbox and weekly status emails",
  },
  {
    axis: "Candidate presentation",
    taasflow: "Ranked candidates with evidence per requirement",
    agency: "Attached CVs with a short cover email",
  },
  {
    axis: "Ownership after shortlist",
    taasflow: "Your team owns interviews, offer, and hire",
    agency: "Agency stays in the loop through placement",
  },
  {
    axis: "Data & candidate history",
    taasflow: "Stays in your workspace between roles",
    agency: "Leaves with the agency",
  },
] as const;

const HOMEPAGE_FAQ = [
  {
    q: "Is TaaSFlow a recruiting agency?",
    a: "No. TaaSFlow is a subscription recruiting service delivered through a live workspace. You pay for the service, not per hire.",
  },
  {
    q: "Do you charge placement fees?",
    a: "No placement fees, ever. You pay a flat monthly subscription per active role.",
  },
  {
    q: "What happens after the shortlist?",
    a: "Your team runs the interview and offer process directly with the candidate — all inside the same workspace. We stay available to support, we don't gate access.",
  },
  {
    q: "Do we keep the candidates and data?",
    a: "Yes. Every candidate, every note, and every message stays in your workspace so you can revisit past pipelines when new roles open.",
  },
  {
    q: "How is candidate scoring done?",
    a: "Each candidate is scored against the requirements you approved in the intake, with evidence and CV quotes attached. See the scoring section on How It Works for the full methodology.",
  },
] as const;

/* ---------- Small building blocks ---------- */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
      {children}
    </p>
  );
}

function SectionHead({
  eyebrow,
  title,
  lead,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
        {title}
      </h2>
      {lead && (
        <p className="mt-4 text-base text-[color:var(--brand-navy)]/70">{lead}</p>
      )}
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 shadow-[var(--brand-shadow-sm)] ${className}`}
    >
      {children}
    </div>
  );
}

/* ---------- Hero workspace visual (destination product, not the legacy dashboard) ---------- */

function HeroWorkspacePreview() {
  const rankedCandidates = [
    { id: "A-1042", role: "Senior Product Designer · Remote · EU", score: 94, stage: "Shortlisted", top: true },
    { id: "A-1039", role: "Senior Product Designer · Berlin", score: 91, stage: "Under review", top: false },
    { id: "A-1037", role: "Senior Product Designer · Lisbon", score: 87, stage: "Under review", top: false },
  ];
  return (
    <div
      role="img"
      aria-label="A preview of the TaaSFlow client workspace showing an active position, three ranked candidates with fit scores, requirement coverage, candidate stage, a shortlist action, and a live hiring pipeline."
      className="rounded-2xl border border-[color:var(--brand-navy)]/12 bg-white p-4 shadow-[var(--brand-shadow-lg)]"
    >
      {/* Window chrome + active position */}
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--brand-navy)]/8 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </div>
          <span className="truncate text-xs font-medium text-[color:var(--brand-navy)]/60">
            client workspace · Senior Product Designer
          </span>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[color:var(--brand-ocean)]/10 px-2.5 py-1 text-[11px] font-semibold text-[color:var(--brand-ocean)]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--brand-ocean)]" aria-hidden />
          Live
        </span>
      </div>

      {/* Ranked candidates */}
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">
            Ranked candidates · this week
          </div>
          <div className="text-[11px] font-medium text-[color:var(--brand-navy)]/55">3 of 12</div>
        </div>

        <div className="mt-2 space-y-2">
          {rankedCandidates.map((c) => (
            <div
              key={c.id}
              className={
                c.top
                  ? "rounded-xl border border-[color:var(--brand-ocean)]/25 bg-[color:var(--brand-ocean)]/[0.03] p-3"
                  : "rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-3"
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-[color:var(--brand-navy)]">
                      Candidate #{c.id}
                    </span>
                    {c.top ? (
                      <span className="shrink-0 rounded-full bg-[color:var(--brand-ocean)]/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--brand-ocean)]">
                        Top fit
                      </span>
                    ) : null}
                  </div>
                  <div className="truncate text-[11px] text-[color:var(--brand-navy)]/60">{c.role}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full border border-[color:var(--brand-navy)]/12 bg-white px-2 py-0.5 text-[10px] font-medium text-[color:var(--brand-navy)]/70">
                    {c.stage}
                  </span>
                  <div className="rounded-md bg-[color:var(--brand-ocean)]/12 px-2.5 py-1 text-sm font-semibold tabular-nums text-[color:var(--brand-ocean)]">
                    {c.score}
                  </div>
                </div>
              </div>

              {c.top ? (
                <div className="mt-3 space-y-1.5">
                  {DELIVERY_EVIDENCE.map(([k, v]) => (
                    <div key={String(k)} className="flex items-center gap-3 text-[11px]">
                      <span className="w-24 shrink-0 truncate text-[color:var(--brand-navy)]/65">{k}</span>
                      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[color:var(--brand-navy)]/8">
                        <div
                          className="h-full rounded-full bg-[color:var(--brand-ocean)]"
                          style={{ width: `${v}%` }}
                          aria-hidden
                        />
                      </div>
                      <span className="w-7 shrink-0 text-right font-semibold tabular-nums text-[color:var(--brand-navy)]">
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* Live pipeline */}
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">
            Pipeline
          </div>
          <div className="text-[11px] font-medium text-[color:var(--brand-navy)]/55">
            2 shortlisted · 1 in interview
          </div>
        </div>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {[
            { label: "Applied", pct: 100 },
            { label: "Under review", pct: 80 },
            { label: "Shortlisted", pct: 55 },
            { label: "Interview", pct: 30 },
            { label: "Offer", pct: 12 },
          ].map((s) => (
            <div key={s.label} className="min-w-0">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--brand-navy)]/8">
                <div
                  className="h-full rounded-full bg-[color:var(--brand-ocean)]"
                  style={{ width: `${s.pct}%` }}
                  aria-hidden
                />
              </div>
              <div className="mt-1.5 truncate text-[10px] font-medium text-[color:var(--brand-navy)]/70">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Client action row */}
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[color:var(--brand-navy)]/8 pt-3">
        {[
          { label: "Shortlist top fit", solid: true },
          { label: "Interview", solid: false },
          { label: "Pass", solid: false },
        ].map((a) => (
          <div
            key={a.label}
            className={
              a.solid
                ? "rounded-md bg-[color:var(--brand-navy)] px-2 py-1.5 text-center text-[11px] font-semibold text-white"
                : "rounded-md border border-[color:var(--brand-navy)]/15 bg-white px-2 py-1.5 text-center text-[11px] font-semibold text-[color:var(--brand-navy)]"
            }
          >
            {a.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientCandidateDelivery() {
  const coverage = [
    { label: "Design systems ownership", pct: 96, verdict: "Strong" },
    { label: "B2B SaaS product experience", pct: 92, verdict: "Strong" },
    { label: "Team leadership (4+ designers)", pct: 88, verdict: "Strong" },
    { label: "Design ops tooling", pct: 62, verdict: "Validate" },
  ];
  const strengths = [
    "Led design-system rollout across three product lines, reducing component debt materially.",
    "Six years shipping B2B SaaS products used by revenue and operations teams.",
    "Managed a design team through two hiring cycles and one org restructure.",
  ];
  const validations = [
    "Confirm scope of hands-on design-ops tooling ownership versus partnership with engineering.",
    "Clarify recent experience with usage-based product analytics for prioritization.",
  ];

  return (
    <div
      role="img"
      aria-label="A preview of the client candidate detail view showing candidate identity, professional headline, fit recommendation, requirement coverage, strengths, validation areas, personalized interview questions, and client decision controls."
      className="rounded-2xl border border-[color:var(--brand-navy)]/12 bg-white p-5 shadow-[var(--brand-shadow-lg)] sm:p-6"
    >
      {/* Header: identity + fit recommendation */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--brand-navy)]/8 pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--brand-ocean)]" aria-hidden />
            Candidate #A-1042
          </div>
          <div className="mt-1 text-lg font-semibold text-[color:var(--brand-navy)]">Alex R.</div>
          <div className="truncate text-sm text-[color:var(--brand-navy)]/70">
            Senior Product Designer · 8 years · B2B SaaS
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[color:var(--brand-navy)]/60">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden /> Lisbon, PT · Remote-friendly
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden /> Available in 4 weeks
            </span>
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" aria-hidden /> CV attached
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="rounded-md bg-[color:var(--brand-ocean)]/12 px-3 py-1 text-lg font-semibold tabular-nums text-[color:var(--brand-ocean)]">
            94
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-ocean)]/10 px-2 py-0.5 text-[11px] font-semibold text-[color:var(--brand-ocean)]">
            <Sparkles className="h-3 w-3" aria-hidden /> Recommended: shortlist
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--brand-navy)]/12 bg-white px-2 py-0.5 text-[11px] font-medium text-[color:var(--brand-navy)]/70">
            Stage · Under review
          </span>
        </div>
      </div>

      {/* Requirement coverage */}
      <div className="mt-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">
          Requirement coverage
        </div>
        <div className="mt-2 space-y-2">
          {coverage.map((c) => (
            <div key={c.label} className="flex items-center gap-3 text-xs">
              <span className="w-40 shrink-0 truncate text-[color:var(--brand-navy)]/75 sm:w-52">
                {c.label}
              </span>
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[color:var(--brand-navy)]/8">
                <div
                  className={`h-full rounded-full ${c.pct >= 80 ? "bg-[color:var(--brand-ocean)]" : "bg-[color:var(--brand-navy)]/35"}`}
                  style={{ width: `${c.pct}%` }}
                  aria-hidden
                />
              </div>
              <span
                className={`w-16 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wide ${c.pct >= 80 ? "text-[color:var(--brand-ocean)]" : "text-[color:var(--brand-navy)]/55"}`}
              >
                {c.verdict}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Strengths + Validation areas */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] p-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/60">
            <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--brand-ocean)]" aria-hidden />
            Strengths
          </div>
          <ul className="mt-2 space-y-1.5 text-xs text-[color:var(--brand-navy)]/80">
            {strengths.map((s) => (
              <li key={s} className="flex gap-1.5">
                <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-[color:var(--brand-ocean)]" aria-hidden />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/60">
            <Target className="h-3.5 w-3.5 text-[color:var(--brand-navy)]/60" aria-hidden />
            Validate in interview
          </div>
          <ul className="mt-2 space-y-1.5 text-xs text-[color:var(--brand-navy)]/80">
            {validations.map((v) => (
              <li key={v} className="flex gap-1.5">
                <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-[color:var(--brand-navy)]/40" aria-hidden />
                <span>{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Personalized interview question */}
      <div className="mt-4 rounded-xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-sky)]/25 p-3.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/65">
          <MessageCircle className="h-3.5 w-3.5" aria-hidden />
          Suggested interview question
        </div>
        <p className="mt-1.5 text-sm italic text-[color:var(--brand-navy)]/85">
          "Walk us through the design-system rollout you led — how you handled adoption across
          teams that hadn't asked for it."
        </p>
      </div>

      {/* Client decision controls */}
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[color:var(--brand-navy)]/8 pt-4">
        <div className="rounded-md bg-[color:var(--brand-navy)] px-3 py-2 text-center text-sm font-semibold text-white">
          Shortlist
        </div>
        <div className="rounded-md border border-[color:var(--brand-navy)]/15 bg-white px-3 py-2 text-center text-sm font-semibold text-[color:var(--brand-navy)]">
          Interview
        </div>
        <div className="rounded-md border border-[color:var(--brand-navy)]/15 bg-white px-3 py-2 text-center text-sm font-semibold text-[color:var(--brand-navy)]/70">
          Pass
        </div>
      </div>
    </div>
  );
}

/* ---------- Component ---------- */



function Home() {
  return (
    <SiteShell>
      {/* 1 — HERO */}
      <section
        aria-labelledby="home-hero-heading"
        className="relative overflow-hidden bg-gradient-to-b from-[color:var(--brand-sky)]/30 via-[color:var(--brand-paper)] to-[color:var(--brand-paper)]"
      >
        <PublicPage>
          <div className="grid grid-cols-1 gap-12 py-16 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:py-24">
            <div className="flex min-w-0 flex-col justify-center gap-6">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--brand-navy)]/12 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/75 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-[color:var(--brand-ocean)]" aria-hidden />
                Talent as a Service
              </span>
              <h1
                id="home-hero-heading"
                className="font-[family-name:var(--brand-font-display)] text-4xl font-semibold leading-[1.05] tracking-tight text-[color:var(--brand-navy)] sm:text-5xl lg:text-[3.5rem]"
              >
                Your hiring team.
                <br className="hidden sm:block" /> On demand.
              </h1>
              <p className="max-w-xl text-lg text-[color:var(--brand-navy)]/75">
                TaaSFlow gives growing companies an always-on recruiting function that
                sources, evaluates, ranks, and delivers qualified candidates through one
                transparent workspace.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  to="/intake"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[color:var(--brand-navy-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
                >
                  Start Hiring <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  to="/how-it-works"
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/15 bg-white px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
                >
                  See How It Works
                </Link>
                <Link
                  to="/pricing"
                  className="inline-flex min-h-11 items-center rounded-md px-2 py-2.5 text-sm font-medium text-[color:var(--brand-navy)]/70 underline-offset-4 hover:text-[color:var(--brand-navy)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
                >
                  View Pricing
                </Link>
              </div>
              <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-[color:var(--brand-navy)]/65">
                {[
                  "Ranked delivery",
                  "Evidence per requirement",
                  "Live pipeline",
                  "Direct handover after shortlist",
                  "No placement fees",
                ].map((t) => (
                  <li key={t} className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--brand-ocean)]" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="min-w-0">
              <HeroWorkspacePreview />
            </div>
          </div>
        </PublicPage>
      </section>

      {/* 2 — WHAT YOU GET EVERY WEEK */}
      <PublicSection>
        <PublicPage>
          <SectionHead
            eyebrow="What you get every week"
            title="A ranked shortlist, evidence, and a live pipeline."
            lead="Every week the workspace refreshes with the work that actually moves a role forward — nothing you have to chase in email."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {WEEKLY_DELIVERABLES.map((w) => (
              <Card key={w.t}>
                <w.icon className="h-6 w-6 text-[color:var(--brand-ocean)]" aria-hidden />
                <h3 className="mt-4 text-base font-semibold text-[color:var(--brand-navy)]">
                  {w.t}
                </h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">{w.d}</p>
              </Card>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* 3 — WHO TAASFLOW SERVES (Audience lanes) */}
      <section
        aria-labelledby="home-audiences-heading"
        className="border-y border-[color:var(--brand-navy)]/8 bg-white"
      >
        <PublicSection>
          <PublicPage>
            <SectionHead
              eyebrow="Who TaaSFlow serves"
              title="Four hiring realities. One recruiting function."
              lead="TaaSFlow adapts to how your team hires — from a single founder covering every role to enterprise TA leaders coordinating across regions."
            />
            <div id="home-audiences-heading" className="sr-only">
              Audiences TaaSFlow serves
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {AUDIENCE_LANES.map((lane) => {
                const accentMap: Record<string, { bar: string; icon: string; chip: string }> = {
                  ocean: {
                    bar: "bg-[color:var(--brand-ocean)]",
                    icon: "text-[color:var(--brand-ocean)] bg-[color:var(--brand-ocean)]/10",
                    chip: "bg-[color:var(--brand-ocean)]/10 text-[color:var(--brand-ocean)]",
                  },
                  sky: {
                    bar: "bg-[color:var(--brand-sky)]",
                    icon: "text-[color:var(--brand-navy)] bg-[color:var(--brand-sky)]/50",
                    chip: "bg-[color:var(--brand-sky)]/50 text-[color:var(--brand-navy)]",
                  },
                  navy: {
                    bar: "bg-[color:var(--brand-navy)]",
                    icon: "text-white bg-[color:var(--brand-navy)]",
                    chip: "bg-[color:var(--brand-navy)]/10 text-[color:var(--brand-navy)]",
                  },
                  sand: {
                    bar: "bg-[color:var(--brand-sand,#c9a76a)]",
                    icon: "text-[color:var(--brand-navy)] bg-[color:var(--brand-sand,#c9a76a)]/25",
                    chip: "bg-[color:var(--brand-sand,#c9a76a)]/25 text-[color:var(--brand-navy)]",
                  },
                };
                const a = accentMap[lane.accent] ?? accentMap.ocean;
                return (
                  <article
                    key={lane.name}
                    className="group relative flex flex-col overflow-hidden rounded-2xl border border-[color:var(--brand-navy)]/12 bg-white p-6 shadow-sm transition-shadow hover:shadow-[var(--brand-shadow-lg)] sm:p-7"
                  >
                    <span className={`absolute inset-x-0 top-0 h-1 ${a.bar}`} aria-hidden />
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${a.icon}`}
                        aria-hidden
                      >
                        <lane.icon className="h-5 w-5" />
                      </span>
                      <h3 className="text-lg font-semibold text-[color:var(--brand-navy)]">
                        {lane.name}
                      </h3>
                    </div>

                    <dl className="mt-5 space-y-4 text-sm">
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">
                          The hiring problem
                        </dt>
                        <dd className="mt-1 text-[color:var(--brand-navy)]/80">{lane.problem}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">
                          How TaaSFlow helps
                        </dt>
                        <dd className="mt-1 text-[color:var(--brand-navy)]/80">{lane.value}</dd>
                      </div>
                    </dl>

                    <div
                      className={`mt-5 inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${a.chip}`}
                    >
                      <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                      {lane.result}
                    </div>

                    <div className="mt-6 flex-1" />
                    <Link
                      to={lane.ctaTo}
                      className="mt-2 inline-flex min-h-10 w-fit items-center gap-1.5 rounded-md border border-[color:var(--brand-navy)]/15 bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
                    >
                      {lane.ctaLabel}
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </article>
                );
              })}
            </div>
          </PublicPage>
        </PublicSection>
      </section>


      {/* 3.5 — THE RECRUITING PROBLEM (old model vs TaaSFlow model) */}
      <PublicSection>
        <PublicPage>
          <SectionHead
            eyebrow="The recruiting problem"
            title="Recruiting should not restart from zero every time you hire."
            lead="Traditional agencies sell placements. When the engagement ends, the sourcing work, the candidate context, and the pipeline leave with them. Subscription recruiting is a different arrangement."
          />

          {/* Header row — hidden on mobile, shown on md+ */}
          <div className="mt-10 hidden grid-cols-[1.1fr_1fr_1fr] gap-4 md:grid">
            <div />
            <div className="rounded-t-xl border border-b-0 border-[color:var(--brand-navy)]/12 bg-[color:var(--brand-navy)]/5 px-5 py-3">
              <div className="flex items-center gap-2 text-[color:var(--brand-navy)]/70">
                <XCircle className="h-4 w-4" aria-hidden />
                <span className="text-xs font-semibold uppercase tracking-wide">
                  Traditional agency model
                </span>
              </div>
            </div>
            <div className="rounded-t-xl border border-b-0 border-[color:var(--brand-ocean)]/25 bg-[color:var(--brand-ocean)]/8 px-5 py-3">
              <div className="flex items-center gap-2 text-[color:var(--brand-ocean)]">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                <span className="text-xs font-semibold uppercase tracking-wide">
                  TaaSFlow model
                </span>
              </div>
            </div>
          </div>

          <div className="md:grid md:grid-cols-[1.1fr_1fr_1fr] md:gap-4">
            {PROBLEM_ROWS.map((row, i) => (
              <React.Fragment key={row.label}>
                {/* Row label */}
                <div
                  className={`mt-6 md:mt-0 ${
                    i > 0 ? "md:border-t md:border-[color:var(--brand-navy)]/10" : ""
                  } md:flex md:items-center md:px-5 md:py-5`}
                >
                  <div className="flex items-center gap-2">
                    <row.icon
                      className="h-4 w-4 text-[color:var(--brand-navy)]/60"
                      aria-hidden
                    />
                    <span className="text-sm font-semibold text-[color:var(--brand-navy)]">
                      {row.label}
                    </span>
                  </div>
                </div>

                {/* Old model cell */}
                <div
                  className={`mt-2 rounded-lg border border-[color:var(--brand-navy)]/12 bg-[color:var(--brand-navy)]/[0.03] px-4 py-3 text-sm text-[color:var(--brand-navy)]/75 md:mt-0 md:rounded-none md:border-x md:border-b-0 md:border-t md:border-[color:var(--brand-navy)]/12 md:bg-[color:var(--brand-navy)]/[0.03] md:px-5 md:py-5 ${
                    i === PROBLEM_ROWS.length - 1 ? "md:rounded-b-xl md:border-b" : ""
                  }`}
                >
                  <div className="flex items-start gap-2 md:hidden">
                    <XCircle
                      className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-navy)]/50"
                      aria-hidden
                    />
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">
                        Traditional agency
                      </div>
                      <div className="mt-0.5">{row.old}</div>
                    </div>
                  </div>
                  <div className="hidden md:block">{row.old}</div>
                </div>

                {/* TaaSFlow cell */}
                <div
                  className={`mt-2 rounded-lg border border-[color:var(--brand-ocean)]/30 bg-[color:var(--brand-ocean)]/8 px-4 py-3 text-sm text-[color:var(--brand-navy)] md:mt-0 md:rounded-none md:border-x md:border-b-0 md:border-t md:border-[color:var(--brand-ocean)]/25 md:px-5 md:py-5 ${
                    i === PROBLEM_ROWS.length - 1 ? "md:rounded-b-xl md:border-b" : ""
                  }`}
                >
                  <div className="flex items-start gap-2 md:hidden">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-ocean)]"
                      aria-hidden
                    />
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-ocean)]">
                        TaaSFlow
                      </div>
                      <div className="mt-0.5">{row.next}</div>
                    </div>
                  </div>
                  <div className="hidden md:block font-medium">{row.next}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* 3.6 — HOW IT WORKS (8-step process, horizontal desktop / vertical mobile) */}
      <section className="border-y border-[color:var(--brand-navy)]/8 bg-white">
        <PublicSection>
          <PublicPage>
            <SectionHead
              eyebrow="How it works"
              title="Eight steps from open role to hiring decision."
              lead="TaaSFlow manages the sourcing and evaluation work. Your team stays in control of interviews, offers, and hiring decisions."
            />

            <ol className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {PROCESS_STEPS.map((step, i) => (
                <li
                  key={step.title}
                  className="relative flex flex-col rounded-2xl border border-[color:var(--brand-navy)]/12 bg-white p-5 shadow-[var(--brand-shadow-sm)]"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--brand-navy)] text-xs font-semibold text-white"
                      aria-hidden
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <step.icon
                      className="h-5 w-5 text-[color:var(--brand-ocean)]"
                      aria-hidden
                    />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-[color:var(--brand-navy)]">
                    {step.title}
                  </h3>

                  <dl className="mt-4 space-y-3 text-xs">
                    <div>
                      <dt className="font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">
                        TaaSFlow does
                      </dt>
                      <dd className="mt-1 text-sm text-[color:var(--brand-navy)]/80">
                        {step.taasflow}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">
                        Client sees
                      </dt>
                      <dd className="mt-1 text-sm text-[color:var(--brand-navy)]/80">
                        {step.client}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold uppercase tracking-wide text-[color:var(--brand-ocean)]">
                        Produced
                      </dt>
                      <dd className="mt-1 text-sm font-medium text-[color:var(--brand-navy)]">
                        {step.output}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ol>

            <p className="mt-8 max-w-3xl rounded-xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] px-5 py-4 text-sm text-[color:var(--brand-navy)]/80">
              TaaSFlow manages the sourcing and evaluation work. Your team stays
              in control of interviews, offers, and hiring decisions.
            </p>

            <div className="mt-6">
              <Link
                to="/how-it-works"
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[color:var(--brand-navy-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
              >
                See the Full Process <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </PublicPage>
        </PublicSection>
      </section>

      {/* 4 — WHY SUBSCRIPTION RECRUITING */}
      <PublicSection>
        <PublicPage>
          <SectionHead
            eyebrow="Why subscription recruiting"
            title="A different economic model — and a different working relationship."
            lead="Placement fees create incentives to close the deal. A subscription creates incentives to keep delivering."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {SUBSCRIPTION_REASONS.map((r) => (
              <Card key={r.t}>
                <r.icon className="h-6 w-6 text-[color:var(--brand-ocean)]" aria-hidden />
                <h3 className="mt-4 text-base font-semibold text-[color:var(--brand-navy)]">
                  {r.t}
                </h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">{r.d}</p>
              </Card>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* 5 — LIVE WORKSPACE SHOWCASE */}
      <section className="border-y border-[color:var(--brand-navy)]/8 bg-[color:var(--brand-paper)]">
        <PublicSection>
          <PublicPage>
            <SectionHead
              eyebrow="Inside the workspace"
              title="One product. Three purpose-built views."
              lead="Admin operations, hiring teams, and candidates each get a workspace tailored to what they need to do — synchronized in realtime."
            />
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {WORKSPACES.map((w) => (
                <Card key={w.title} className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <w.icon className="h-5 w-5 text-[color:var(--brand-ocean)]" aria-hidden />
                    <Eyebrow>{w.who}</Eyebrow>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-[color:var(--brand-navy)]">
                    {w.title}
                  </h3>
                  <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">{w.body}</p>
                  <ul className="mt-4 space-y-2 text-sm text-[color:var(--brand-navy)]">
                    {w.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2">
                        <CheckCircle2
                          className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-ocean)]/70"
                          aria-hidden
                        />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
            <div className="mt-8">
              <Link
                to="/how-it-works"
                className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-ocean)] hover:text-[color:var(--brand-navy)]"
              >
                See how the workspace works <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </PublicPage>
        </PublicSection>
      </section>

      {/* 6 — WHAT CLIENTS RECEIVE (deliverable + candidate detail visual) */}
      <PublicSection>
        <PublicPage>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
            <div>
              <SectionHead
                eyebrow="What you receive"
                title="More than candidates. Clear hiring decisions."
                lead="Instead of receiving a stack of CVs, your team receives candidates organized around the role, with the evidence needed to decide who should move forward."
              />
              <ul className="mt-6 grid grid-cols-1 gap-x-6 gap-y-2.5 text-sm text-[color:var(--brand-navy)] sm:grid-cols-2">
                {[
                  "Ranked candidate shortlist",
                  "Role-specific fit analysis",
                  "Strengths and validation areas",
                  "Requirement coverage",
                  "Professional background",
                  "CV access",
                  "Location and availability",
                  "Personalized interview questions",
                  "Visible candidate stage",
                  "Decision controls in one click",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-ocean)]"
                      aria-hidden
                    />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            <ClientCandidateDelivery />
          </div>
        </PublicPage>
      </PublicSection>


      {/* 7 — TAASFLOW VS AGENCY MODEL */}
      <section className="border-y border-[color:var(--brand-navy)]/8 bg-white">
        <PublicSection>
          <PublicPage>
            <SectionHead
              eyebrow="TaaSFlow vs the agency model"
              title="Same objective. A different way of getting there."
              lead="A side-by-side view of how a subscription recruiting workspace compares to a traditional contingent agency."
            />
            <div className="mt-10 overflow-hidden rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white shadow-[var(--brand-shadow-sm)]">
              <div className="hidden grid-cols-[1.1fr_1.4fr_1.4fr] items-center gap-4 border-b border-[color:var(--brand-navy)]/8 bg-[color:var(--brand-paper)] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/60 md:grid">
                <span>Dimension</span>
                <span className="text-[color:var(--brand-navy)]">TaaSFlow</span>
                <span>Traditional agency</span>
              </div>
              <ul>
                {AGENCY_COMPARE.map((row) => (
                  <li
                    key={row.axis}
                    className="grid grid-cols-1 gap-2 border-b border-[color:var(--brand-navy)]/8 px-5 py-4 last:border-0 md:grid-cols-[1.1fr_1.4fr_1.4fr] md:items-start md:gap-4"
                  >
                    <div className="text-sm font-semibold text-[color:var(--brand-navy)]">
                      {row.axis}
                    </div>
                    <div className="flex items-start gap-2 text-sm text-[color:var(--brand-navy)]">
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-ocean)]"
                        aria-hidden
                      />
                      <span>{row.taasflow}</span>
                    </div>
                    <div className="text-sm text-[color:var(--brand-navy)]/60">
                      {row.agency}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </PublicPage>
        </PublicSection>
      </section>

      {/* 8 — SOCIAL PROOF / TRUST */}
      <PublicSection>
        <PublicPage>
          <SectionHead
            eyebrow="What hiring teams say"
            title="Teams hiring differently."
            lead="Hiring managers use TaaSFlow because it changes how their team decides — evidence in front of everyone, in the same workspace, at the same time."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              {
                q: "We stopped comparing PDFs. The workspace tells us which candidates fit the requirements we actually agreed on.",
                who: "Head of Talent · SaaS scale-up",
              },
              {
                q: "Evidence quotes changed the conversation with our hiring managers. We debate the requirement, not the candidate.",
                who: "Recruiting Lead · Fintech",
              },
              {
                q: "Predictable pricing and a single workspace let us open three roles at once without adding more vendors.",
                who: "People Ops · Healthcare",
              },
            ].map((t) => (
              <Card key={t.who}>
                <Building2 className="h-5 w-5 text-[color:var(--brand-ocean)]" aria-hidden />
                <blockquote className="mt-4 text-sm leading-relaxed text-[color:var(--brand-navy)]">
                  "{t.q}"
                </blockquote>
                <p className="mt-4 text-xs font-medium text-[color:var(--brand-navy)]/60">
                  {t.who}
                </p>
              </Card>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-4 text-xs text-[color:var(--brand-navy)]/60">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-[color:var(--brand-ocean)]" aria-hidden />
              Evidence-first candidate delivery
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ClipboardCheck className="h-4 w-4 text-[color:var(--brand-ocean)]" aria-hidden />
              Full audit trail on every decision
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4 text-[color:var(--brand-ocean)]" aria-hidden />
              Role-based access for your team
            </span>
          </div>
          <div className="mt-6">
            <Link
              to="/case-studies"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-ocean)] hover:text-[color:var(--brand-navy)]"
            >
              Read case studies <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </PublicPage>
      </PublicSection>

      {/* 9 — FAQ PREVIEW */}
      <section className="border-y border-[color:var(--brand-navy)]/8 bg-[color:var(--brand-paper)]">
        <PublicSection>
          <PublicPage>
            <SectionHead
              eyebrow="Quick answers"
              title="Common questions about TaaSFlow."
            />
            <dl className="mt-10 grid gap-5 md:grid-cols-2">
              {HOMEPAGE_FAQ.map((item) => (
                <Card key={item.q}>
                  <dt className="text-base font-semibold text-[color:var(--brand-navy)]">
                    {item.q}
                  </dt>
                  <dd className="mt-2 text-sm text-[color:var(--brand-navy)]/70">
                    {item.a}
                  </dd>
                </Card>
              ))}
            </dl>
            <div className="mt-8">
              <Link
                to="/faq"
                className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-ocean)] hover:text-[color:var(--brand-navy)]"
              >
                View all FAQs <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </PublicPage>
        </PublicSection>
      </section>

      {/* 10 — FINAL CTA */}
      <CtaSection
        eyebrow="Get started"
        title="A faster, clearer, more transparent way to recruit."
        description="Give your hiring team ranked candidates, evidence per requirement, and a live workspace everyone can see."
        primary={{ to: "/intake", label: "Start Hiring" }}
        secondary={{ to: "/how-it-works", label: "See How It Works" }}
      />
    </SiteShell>
  );
}
