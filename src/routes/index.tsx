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
  MapPin,
  MessageCircle,
  MessageSquare,
  Quote,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
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

const AUDIENCES = [
  {
    icon: Rocket,
    t: "Growing startups",
    d: "Founders and Heads of People hiring in bursts who need pipeline without hiring a full in-house recruiting team.",
  },
  {
    icon: Building2,
    t: "Scale-ups & mid-market",
    d: "Talent teams filling several roles in parallel that want a single workspace instead of juggling agencies and spreadsheets.",
  },
  {
    icon: LayoutDashboard,
    t: "In-house recruiting teams",
    d: "Recruiters who want an on-demand sourcing pod that plugs in beside their ATS and shares the same status with hiring managers.",
  },
  {
    icon: Handshake,
    t: "Hiring managers",
    d: "Owners of a role who want ranked candidates with evidence — not 40 CVs to skim — and one click to shortlist, interview, or pass.",
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

      {/* 3 — WHO TAASFLOW IS FOR */}
      <section className="border-y border-[color:var(--brand-navy)]/8 bg-white">
        <PublicSection>
          <PublicPage>
            <SectionHead
              eyebrow="Who TaaSFlow is for"
              title="Teams that would rather hire than manage recruiters."
              lead="TaaSFlow is built for hiring teams that want an on-demand recruiting function without the friction of traditional agency work."
            />
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {AUDIENCES.map((a) => (
                <Card key={a.t}>
                  <a.icon className="h-6 w-6 text-[color:var(--brand-ocean)]" aria-hidden />
                  <h3 className="mt-4 text-base font-semibold text-[color:var(--brand-navy)]">
                    {a.t}
                  </h3>
                  <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">{a.d}</p>
                </Card>
              ))}
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

      {/* 6 — CANDIDATE DELIVERY & EVIDENCE */}
      <PublicSection>
        <PublicPage>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <SectionHead
                eyebrow="Candidate delivery & evidence"
                title="Recruiter-written fit narratives — not attached PDFs."
                lead="Each candidate arrives in your workspace with a role-specific score and the exact CV quotes behind every requirement. Debate the requirement, not the candidate."
              />
              <ul className="mt-6 space-y-3 text-sm text-[color:var(--brand-navy)]">
                {[
                  "Ranked delivery with a composite score per candidate",
                  "Evidence and CV quotes mapped to every must-have",
                  "Recruiter-written fit narrative attached to the profile",
                  "One-click shortlist, interview, or pass",
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
            <Card className="p-6 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[color:var(--brand-navy)]">
                    Alex R.
                  </div>
                  <div className="truncate text-xs text-[color:var(--brand-navy)]/60">
                    Senior Product Designer · Remote
                  </div>
                </div>
                <div className="shrink-0 rounded-md bg-[color:var(--brand-ocean)]/12 px-3 py-1 text-sm font-semibold tabular-nums text-[color:var(--brand-ocean)]">
                  94
                </div>
              </div>
              <div className="mt-5 space-y-2.5">
                {DELIVERY_EVIDENCE.map(([k, v]) => (
                  <div key={String(k)} className="flex items-center gap-3 text-xs">
                    <span className="w-24 shrink-0 truncate text-[color:var(--brand-navy)]/60 sm:w-36">
                      {k}
                    </span>
                    <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[color:var(--brand-navy)]/8">
                      <div
                        className="h-full rounded-full bg-[color:var(--brand-ocean)]"
                        style={{ width: `${v}%` }}
                        aria-hidden
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right font-semibold tabular-nums text-[color:var(--brand-navy)]">
                      {v}
                    </span>
                  </div>
                ))}
              </div>
              <blockquote className="mt-5 flex gap-2 border-t border-[color:var(--brand-navy)]/8 pt-4 text-xs text-[color:var(--brand-navy)]/70">
                <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--brand-navy)]/40" aria-hidden />
                <span>
                  "Led design system rollout, reducing component debt by ~40%."
                  <span className="ml-1 text-[color:var(--brand-navy)]/50">— CV, page 2</span>
                </span>
              </blockquote>
            </Card>
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
