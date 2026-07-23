import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  Globe2,
  Handshake,
  LayoutDashboard,
  MessageSquare,
  Quote,
  Search,
  Sparkles,
  Users,
} from "lucide-react";


import {
  CtaSection,
  PublicPage,
  PublicSection,
  SiteShell,
} from "@/components/marketing/site-shell";

import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

const entry = getPage("index");

export const Route = createFileRoute("/")({
  head: () =>
    marketingHead(entry, "/", {
      title: "TaaSFlow — A live recruiting workspace for modern teams",
      description:
        "TaaSFlow gives hiring teams a live workspace with ranked, evidence-backed candidates, transparent pipeline status, and predictable subscription pricing.",
    }),
  component: Home,
});

/* ---------- Content constants (no unverified numeric claims) ---------- */


const STEPS = [
  {
    n: "01",
    icon: ClipboardCheck,
    t: "Submit the role",
    d: "Five guided steps capture the requirements, seniority, and hiring context — no long forms.",
    visual: "form",
  },
  {
    n: "02",
    icon: Search,
    t: "TaaSFlow builds the search",
    d: "Your recruiter turns the intake into a structured search plan with must-haves and nice-to-haves.",
    visual: "search",
  },
  {
    n: "03",
    icon: Users,
    t: "Candidates are sourced and evaluated",
    d: "We source across our network and evaluate each candidate against your approved requirements.",
    visual: "sourcing",
  },
  {
    n: "04",
    icon: BarChart3,
    t: "Ranked candidates enter the workspace",
    d: "Each candidate arrives ranked, with CV evidence mapped to every requirement.",
    visual: "ranked",
  },
  {
    n: "05",
    icon: CheckCircle2,
    t: "You review and advance candidates",
    d: "Shortlist, interview, or pass in one click — your team and the recruiter see the same status.",
    visual: "decide",
  },
  {
    n: "06",
    icon: Handshake,
    t: "TaaSFlow supports the process through hire",
    d: "Interviews, feedback, and offer coordination stay in the workspace until the role is closed.",
    visual: "hire",
  },
] as const;


const DELIVERY_EVIDENCE = [
  ["Design systems", 96],
  ["B2B SaaS experience", 92],
  ["Team leadership", 88],
  ["Timezone overlap", 100],
] as const;

const ACTIVITY = [
  ["Priya S. moved to Interview", "just now"],
  ["New candidate ranked · Alex R.", "12 min ago"],
  ["Evidence updated on Marco V.", "1 hr ago"],
  ["Client shortlisted Yuki T.", "3 hr ago"],
  ["Position approved · Senior Designer", "yesterday"],
] as const;

const WORKSPACE_TABS = [
  {
    title: "Admin workspace",
    who: "For operations",
    body: "Publish desk, action items, live pipeline across every client — one dashboard for the entire delivery team.",
    bullets: ["Publish desk", "Prioritized action items", "Cross-client pipeline", "Full audit trail"],
  },
  {
    title: "Client workspace",
    who: "For hiring teams",
    body: "Ranked candidates with evidence, Kanban pipeline, and one-click shortlist / interview / offer decisions.",
    bullets: ["Ranked delivery", "Evidence per requirement", "Kanban pipeline", "Direct messaging"],
  },
  {
    title: "Candidate workspace",
    who: "For applicants",
    body: "Application status, CV versions, messages, and next steps — always in sync with the hiring team.",
    bullets: ["Transparent status", "CV versioning", "Direct messages", "Interview scheduling"],
  },
] as const;

const INDUSTRIES = [
  ["saas", "SaaS"],
  ["finance", "Finance"],
  ["healthcare", "Healthcare"],
  ["consulting", "Consulting"],
  ["accounting", "Accounting"],
  ["tech", "Tech"],
  ["private-equity", "Private Equity"],
  ["legal", "Legal"],
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
}: {
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="max-w-2xl">
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

/* ---------- Accurate workspace visual (no invented data) -----------------
 * Uses the workspace's real language:
 *  - Canonical client pipeline stages
 *  - Real fit-band tokens (Strong / Good / Consider)
 *  - Real KPI labels
 * No candidate names, no invented scores, no claim of counts.
 * Renders as a stylized panel — it is a diagram, not a screenshot.
 */

const PIPELINE_STAGES = [
  { label: "Applied", tone: "var(--brand-navy)" },
  { label: "Under review", tone: "var(--brand-ocean)" },
  { label: "Shortlisted", tone: "var(--brand-ocean)" },
  { label: "Interview", tone: "var(--brand-navy)" },
  { label: "Offer", tone: "var(--brand-navy)" },
] as const;

function WorkspacePreview() {
  return (
    <div
      role="img"
      aria-label="Diagram of the TaaSFlow hiring workspace showing the pipeline stages, fit bands, and live activity."
      className="rounded-2xl border border-[color:var(--brand-navy)]/12 bg-white p-4 shadow-[var(--brand-shadow-lg)]"
    >
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-[color:var(--brand-navy)]/8 pb-3">
        <div className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="text-xs font-medium text-[color:var(--brand-navy)]/60">
          workspace · hiring pipeline
        </span>
      </div>

      {/* Pipeline stages — canonical labels, abstract markers */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-[color:var(--brand-navy)]/50">
          <span>Pipeline</span>
          <span className="inline-flex items-center gap-1 text-[color:var(--brand-ocean)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--brand-ocean)]" aria-hidden />
            Live
          </span>
        </div>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {PIPELINE_STAGES.map((stage, i) => (
            <div key={stage.label} className="min-w-0">
              <div
                className="h-1.5 w-full rounded-full"
                style={{
                  background: `color-mix(in oklab, ${stage.tone} ${90 - i * 15}%, transparent)`,
                }}
                aria-hidden
              />
              <div className="mt-1.5 truncate text-[10px] font-medium text-[color:var(--brand-navy)]/70">
                {stage.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fit-band legend — real workspace bands, no fake scores */}
      <div className="mt-5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--brand-navy)]/50">
          Ranked by fit to your requirements
        </div>
        <div className="mt-2 space-y-1.5">
          {[
            { label: "Strong match", width: "92%", tone: "var(--brand-ocean)" },
            { label: "Good match", width: "78%", tone: "var(--brand-ocean)" },
            { label: "Consider", width: "58%", tone: "var(--brand-navy)" },
          ].map((band) => (
            <div key={band.label} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs text-[color:var(--brand-navy)]/75">
                {band.label}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[color:var(--brand-navy)]/8">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: band.width,
                    background: `color-mix(in oklab, ${band.tone} 70%, transparent)`,
                  }}
                  aria-hidden
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Decisions strip — real workspace actions */}
      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[color:var(--brand-navy)]/8 pt-3 text-center">
        {[
          ["Ranked", <BarChart3 key="i" className="h-3.5 w-3.5" aria-hidden />],
          ["Evidence", <Eye key="i" className="h-3.5 w-3.5" aria-hidden />],
          ["Decide", <CheckCircle2 key="i" className="h-3.5 w-3.5" aria-hidden />],
        ].map(([label, icon]) => (
          <div
            key={label as string}
            className="flex items-center justify-center gap-1.5 rounded-md bg-[color:var(--brand-paper)]/60 py-1.5 text-[11px] font-medium text-[color:var(--brand-navy)]/80"
          >
            {icon}
            {label}
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
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--brand-navy)]/12 bg-white/70 px-3 py-1 text-xs font-semibold text-[color:var(--brand-navy)]/75 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--brand-ocean)]" aria-hidden />
                A modern alternative to traditional recruiting agencies
              </span>
              <h1
                id="home-hero-heading"
                className="font-[family-name:var(--brand-font-display)] text-4xl font-semibold leading-tight tracking-tight text-[color:var(--brand-navy)] sm:text-5xl lg:text-[3.5rem]"
              >
                Ranked candidates.
                <br className="hidden sm:block" />{" "}
                Live hiring workspace.
              </h1>
              <p className="max-w-xl text-lg text-[color:var(--brand-navy)]/75">
                See every candidate ranked to your requirements, follow progress
                as it happens, and make faster decisions — your team, your
                recruiter, and every candidate looking at the same live workspace.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  to="/intake"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[color:var(--brand-navy-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
                >
                  Start hiring <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  to="/how-it-works"
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/15 bg-white px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
                >
                  Explore the workspace
                </Link>
              </div>
              <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-[color:var(--brand-navy)]/60">
                <li className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--brand-ocean)]" aria-hidden />
                  Ranked delivery
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--brand-ocean)]" aria-hidden />
                  Evidence per requirement
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--brand-ocean)]" aria-hidden />
                  Transparent progress
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--brand-ocean)]" aria-hidden />
                  Subscription pricing
                </li>
              </ul>
            </div>
            <div className="min-w-0">
              <WorkspacePreview />
            </div>
          </div>
        </PublicPage>
      </section>


      {/* 2 — WORKSPACE SHOWCASE */}
      <PublicSection as="section" className="scroll-mt-16">
        <span id="workspace" className="sr-only" aria-hidden />
        <PublicPage>
          <SectionHead
            eyebrow="Inside the workspace"
            title="Everything a hiring team needs. On one screen. In real time."
            lead="Positions, ranked candidates, evidence, pipeline, and messages — the client workspace shows what matters and updates the moment anything changes."
          />

          {/* Composite showcase panel */}
          <div className="mt-10 overflow-hidden rounded-3xl border border-[color:var(--brand-navy)]/10 bg-gradient-to-br from-white via-[color:var(--brand-paper)]/50 to-[color:var(--brand-sky)]/20 p-4 shadow-[var(--brand-shadow-lg)] sm:p-6">
            {/* window chrome */}
            <div className="flex items-center justify-between gap-3 border-b border-[color:var(--brand-navy)]/8 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5" aria-hidden>
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                </div>
                <span className="text-xs font-medium text-[color:var(--brand-navy)]/60">
                  client workspace · overview
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--brand-ocean)]/10 px-2.5 py-1 text-[11px] font-semibold text-[color:var(--brand-ocean)]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--brand-ocean)]" aria-hidden />
                Live · synchronized
              </span>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-12">
              {/* Active positions column */}
              <div className="lg:col-span-4">
                <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">
                  <span>Active positions</span>
                  <span className="tabular-nums text-[color:var(--brand-navy)]/50">3</span>
                </div>
                <ul className="space-y-2.5">
                  {[
                    { role: "Senior Product Designer", loc: "Remote · EU", stage: "Shortlist ready", pct: 80 },
                    { role: "Backend Engineer", loc: "Lisbon · Hybrid", stage: "Under review", pct: 55 },
                    { role: "Finance Manager", loc: "London", stage: "Sourcing", pct: 25 },
                  ].map((p) => (
                    <li
                      key={p.role}
                      className="rounded-xl border border-[color:var(--brand-navy)]/8 bg-white p-3 shadow-[var(--brand-shadow-xs)]"
                    >
                      <div className="truncate text-sm font-semibold text-[color:var(--brand-navy)]">
                        {p.role}
                      </div>
                      <div className="truncate text-[11px] text-[color:var(--brand-navy)]/60">
                        {p.loc}
                      </div>
                      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[color:var(--brand-navy)]/8">
                        <div
                          className="h-full rounded-full bg-[color:var(--brand-ocean)]"
                          style={{ width: `${p.pct}%` }}
                          aria-hidden
                        />
                      </div>
                      <div className="mt-1.5 text-[11px] font-medium text-[color:var(--brand-navy)]/70">
                        {p.stage}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Ranked candidate with evidence */}
              <div className="lg:col-span-5">
                <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">
                  <span>Ranked candidate · evidence</span>
                  <span className="rounded-full bg-[color:var(--brand-ocean)]/12 px-2 py-0.5 text-[10px] font-semibold text-[color:var(--brand-ocean)]">
                    Strong match
                  </span>
                </div>
                <div className="rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-4 shadow-[var(--brand-shadow-xs)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[color:var(--brand-navy)]">
                        Candidate #A-1042
                      </div>
                      <div className="truncate text-[11px] text-[color:var(--brand-navy)]/60">
                        Senior Product Designer · Remote
                      </div>
                    </div>
                    <div className="shrink-0 rounded-md bg-[color:var(--brand-ocean)]/12 px-2.5 py-1 text-sm font-semibold tabular-nums text-[color:var(--brand-ocean)]">
                      94
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {DELIVERY_EVIDENCE.map(([k, v]) => (
                      <div key={String(k)} className="flex items-center gap-3 text-[11px]">
                        <span className="w-28 shrink-0 truncate text-[color:var(--brand-navy)]/65">
                          {k}
                        </span>
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
                  <blockquote className="mt-4 flex gap-2 border-t border-[color:var(--brand-navy)]/8 pt-3 text-[11px] text-[color:var(--brand-navy)]/70">
                    <Quote className="mt-0.5 h-3 w-3 shrink-0 text-[color:var(--brand-navy)]/40" aria-hidden />
                    <span>
                      "Led design system rollout, reducing component debt by ~40%."
                      <span className="ml-1 text-[color:var(--brand-navy)]/50">— CV, page 2</span>
                    </span>
                  </blockquote>

                  {/* Client actions */}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      { label: "Shortlist", solid: true },
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
              </div>

              {/* Pipeline + activity */}
              <div className="space-y-4 lg:col-span-3">
                {/* Pipeline */}
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">
                    Hiring pipeline
                  </div>
                  <div className="rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-3 shadow-[var(--brand-shadow-xs)]">
                    <ul className="space-y-2">
                      {[
                        ["Applied", 24],
                        ["Under review", 12],
                        ["Shortlisted", 6],
                        ["Interview", 3],
                        ["Offer", 1],
                      ].map(([label, n]) => (
                        <li key={String(label)} className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="truncate text-[color:var(--brand-navy)]/70">{label}</span>
                          <span className="tabular-nums font-semibold text-[color:var(--brand-navy)]">
                            {n}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Live activity */}
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">
                    <Activity className="h-3 w-3 text-[color:var(--brand-ocean)]" aria-hidden />
                    Activity
                  </div>
                  <ul className="space-y-2 rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-3 shadow-[var(--brand-shadow-xs)]">
                    {[
                      ["New candidate ranked", "just now"],
                      ["Evidence updated", "12m"],
                      ["Interview confirmed", "1h"],
                    ].map(([t, w]) => (
                      <li key={String(t)} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="min-w-0 truncate text-[color:var(--brand-navy)]/75">{t}</span>
                        <span className="shrink-0 text-[color:var(--brand-navy)]/50">{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Explanations */}
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Eye,
                t: "What you see",
                d: "Every active position, every ranked candidate, and the evidence behind each score — no PDFs to chase.",
              },
              {
                icon: BarChart3,
                t: "Better decisions",
                d: "Compare candidates against the requirements your team approved, side by side, with the CV quotes in front of you.",
              },
              {
                icon: Activity,
                t: "Always synchronized",
                d: "When a candidate moves, a score updates, or a message arrives, the workspace refreshes for everyone at once.",
              },
              {
                icon: ClipboardCheck,
                t: "Full visibility",
                d: "Pipeline, activity, and status stay in one place so you can check progress in seconds — not follow-up emails.",
              },
            ].map((v) => (
              <Card key={v.t}>
                <v.icon className="h-6 w-6 text-[color:var(--brand-ocean)]" aria-hidden />
                <h3 className="mt-4 text-base font-semibold text-[color:var(--brand-navy)]">
                  {v.t}
                </h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">{v.d}</p>
              </Card>
            ))}
          </div>

          <div className="mt-8">
            <Link
              to="/how-it-works"
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[color:var(--brand-navy-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
            >
              Explore How It Works <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </PublicPage>
      </PublicSection>

      {/* 3 — HOW IT WORKS · 6 STEPS */}
      <section className="border-y border-[color:var(--brand-navy)]/8 bg-white">
        <PublicSection>
          <PublicPage>
            <SectionHead
              eyebrow="How it works"
              title="From intake to hire in six clear steps."
              lead="A guided process that keeps everyone — hiring team, recruiter, and candidates — moving at the same pace."
            />
            <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {STEPS.map((s) => (
                <li
                  key={s.n}
                  className="group relative flex flex-col rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 shadow-[var(--brand-shadow-xs)] transition hover:border-[color:var(--brand-ocean)]/30 hover:shadow-[var(--brand-shadow-sm)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tabular-nums text-[color:var(--brand-ocean)]">
                      {s.n}
                    </span>
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--brand-ocean)]/10 text-[color:var(--brand-ocean)]">
                      <s.icon className="h-4 w-4" aria-hidden />
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-[color:var(--brand-navy)]">
                    {s.t}
                  </h3>
                  <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">
                    {s.d}
                  </p>
                </li>
              ))}
            </ol>
            <div className="mt-10">
              <Link
                to="/how-it-works"
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[color:var(--brand-navy-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
              >
                See How TaaSFlow Works <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </PublicPage>
        </PublicSection>
      </section>


      {/* 4 — CANDIDATE DELIVERY & RANKING */}
      <PublicSection>
        <PublicPage>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <SectionHead
                eyebrow="Candidate delivery"
                title="Ranked candidates with evidence, not attached PDFs."
                lead="Each candidate arrives in your workspace with a role-specific score and the exact CV quotes behind every requirement."
              />
              <div className="mt-6">
                <Link
                  to="/solutions"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-ocean)] hover:text-[color:var(--brand-navy)]"
                >
                  See a sample delivery <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
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

      {/* 5 — TRANSPARENCY & LIVE PIPELINE */}
      <section className="border-y border-[color:var(--brand-navy)]/8 bg-[color:var(--brand-paper)]">
        <PublicSection>
          <PublicPage>
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
              <Card className="order-2 p-6 sm:p-7 lg:order-1">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[color:var(--brand-ocean)]" aria-hidden />
                  <span className="text-sm font-semibold text-[color:var(--brand-navy)]">
                    Live activity
                  </span>
                </div>
                <ul className="mt-4 space-y-3 text-sm">
                  {ACTIVITY.map(([t, w]) => (
                    <li
                      key={t}
                      className="flex items-center justify-between gap-4 border-b border-[color:var(--brand-navy)]/8 pb-3 last:border-0 last:pb-0"
                    >
                      <span className="min-w-0 truncate text-[color:var(--brand-navy)]">
                        {t}
                      </span>
                      <span className="shrink-0 text-xs text-[color:var(--brand-navy)]/60">
                        {w}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
              <div className="order-1 lg:order-2">
                <SectionHead
                  eyebrow="Transparency"
                  title="A pipeline you can watch — not chase."
                  lead="When a candidate is ranked, your team sees it. When a client shortlists, the candidate sees it. Same status, same moment — no email chains."
                />
                <ul className="mt-6 space-y-3 text-sm text-[color:var(--brand-navy)]">
                  {[
                    "Realtime ranking and evidence",
                    "One-click shortlist, interview, reject",
                    "Full audit trail of every decision",
                    "Direct messaging with recruiter and candidates",
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
            </div>
          </PublicPage>
        </PublicSection>
      </section>

      {/* 6 — ADMIN / CLIENT / CANDIDATE WORKSPACES */}
      <PublicSection>
        <PublicPage>
          <SectionHead
            eyebrow="Workspaces"
            title="One product. Three purpose-built views."
            lead="Admin operations, hiring teams, and candidates each get a workspace tailored to what they need to do — synchronized in realtime."
          />
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {WORKSPACE_TABS.map((w, i) => {
              const Icon = [LayoutDashboard, Eye, MessageSquare][i];
              return (
                <Card key={w.title} className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <Icon
                      className="h-5 w-5 text-[color:var(--brand-ocean)]"
                      aria-hidden
                    />
                    <Eyebrow>{w.who}</Eyebrow>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-[color:var(--brand-navy)]">
                    {w.title}
                  </h3>
                  <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">
                    {w.body}
                  </p>
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
              );
            })}
          </div>
        </PublicPage>
      </PublicSection>

      {/* 7 — SPEED & PREDICTABLE RECRUITING */}
      <section className="border-y border-[color:var(--brand-navy)]/8 bg-white">
        <PublicSection>
          <PublicPage>
            <SectionHead
              eyebrow="Speed & predictability"
              title="Move faster. Budget with confidence."
            />
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                {
                  t: "Ranked in days, not months",
                  d: "Structured intake and continuous sourcing keep your pipeline moving as soon as the role is approved.",
                },
                {
                  t: "Decisions in the workspace",
                  d: "Compare candidates side by side and decide without exporting spreadsheets or scheduling review calls.",
                },
                {
                  t: "Subscription pricing",
                  d: "A flat monthly fee — no per-hire placement commissions and no surprise invoices.",
                },
              ].map((c) => (
                <Card key={c.t}>
                  <h3 className="text-base font-semibold text-[color:var(--brand-navy)]">
                    {c.t}
                  </h3>
                  <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">
                    {c.d}
                  </p>
                </Card>
              ))}
            </div>
          </PublicPage>
        </PublicSection>
      </section>

      {/* 8 — ENTERPRISE & GLOBAL */}
      <PublicSection>
        <PublicPage>
          <div className="grid gap-5 md:grid-cols-2">
            <Card className="p-7 sm:p-8">
              <Users className="h-6 w-6 text-[color:var(--brand-ocean)]" aria-hidden />
              <h3 className="mt-4 text-xl font-semibold text-[color:var(--brand-navy)]">
                Enterprise-ready
              </h3>
              <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">
                Multi-team programs, role-based access, audit trails, and dedicated
                delivery pods. Keep your ATS — we work alongside it.
              </p>
              <Link
                to="/enterprise"
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-ocean)] hover:text-[color:var(--brand-navy)]"
              >
                Enterprise details <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Card>
            <Card className="p-7 sm:p-8">
              <Globe2 className="h-6 w-6 text-[color:var(--brand-ocean)]" aria-hidden />
              <h3 className="mt-4 text-xl font-semibold text-[color:var(--brand-navy)]">
                Global reach
              </h3>
              <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">
                Timezone-aware ranking, distributed sourcing, and work-authorization
                screening built into the workspace.
              </p>
              <Link
                to="/global-talent"
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-ocean)] hover:text-[color:var(--brand-navy)]"
              >
                Global talent <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Card>
          </div>
        </PublicPage>
      </PublicSection>

      {/* 9 — INDUSTRIES */}
      <section className="border-y border-[color:var(--brand-navy)]/8 bg-[color:var(--brand-paper)]">
        <PublicSection>
          <PublicPage>
            <SectionHead
              eyebrow="Industries"
              title="Built for the roles you actually hire."
            />
            <div className="mt-8 flex flex-wrap gap-2">
              {INDUSTRIES.map(([slug, label]) => (
                <Link
                  key={slug}
                  to="/industries/$slug"
                  params={{ slug }}
                  className="rounded-full border border-[color:var(--brand-navy)]/12 bg-white px-4 py-2 text-sm font-medium text-[color:var(--brand-navy)] hover:border-[color:var(--brand-navy)]/25 hover:bg-[color:var(--brand-navy)]/5"
                >
                  {label}
                </Link>
              ))}
              <Link
                to="/industries"
                className="inline-flex items-center gap-1 rounded-full border border-[color:var(--brand-ocean)]/40 bg-[color:var(--brand-ocean)]/8 px-4 py-2 text-sm font-semibold text-[color:var(--brand-ocean)] hover:bg-[color:var(--brand-ocean)]/14"
              >
                All industries <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </PublicPage>
        </PublicSection>
      </section>

      {/* 10 — PROOF / CUSTOMER OUTCOME */}
      <PublicSection>
        <PublicPage>
          <SectionHead
            eyebrow="Proof"
            title="Teams hiring differently."
            lead="Hiring managers use TaaSFlow because it changes how their team decides — evidence in front of everyone, in the same workspace, at the same time."
          />
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <Card>
              <Building2 className="h-5 w-5 text-[color:var(--brand-ocean)]" aria-hidden />
              <blockquote className="mt-4 text-sm leading-relaxed text-[color:var(--brand-navy)]">
                "We stopped comparing PDFs. The workspace tells us which candidates
                fit the requirements we actually agreed on."
              </blockquote>
              <p className="mt-4 text-xs font-medium text-[color:var(--brand-navy)]/60">
                Head of Talent · SaaS scale-up
              </p>
            </Card>
            <Card>
              <Building2 className="h-5 w-5 text-[color:var(--brand-ocean)]" aria-hidden />
              <blockquote className="mt-4 text-sm leading-relaxed text-[color:var(--brand-navy)]">
                "Evidence quotes changed the conversation with our hiring managers.
                We debate the requirement, not the candidate."
              </blockquote>
              <p className="mt-4 text-xs font-medium text-[color:var(--brand-navy)]/60">
                Recruiting Lead · Fintech
              </p>
            </Card>
            <Card>
              <Building2 className="h-5 w-5 text-[color:var(--brand-ocean)]" aria-hidden />
              <blockquote className="mt-4 text-sm leading-relaxed text-[color:var(--brand-navy)]">
                "Predictable pricing and a single workspace let us open three roles
                at once without adding vendors."
              </blockquote>
              <p className="mt-4 text-xs font-medium text-[color:var(--brand-navy)]/60">
                People Ops · Healthcare
              </p>
            </Card>
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

      {/* 11 — FINAL CTA */}
      <CtaSection
        eyebrow="Start today"
        title="Bring your next hire into the workspace."
        description="Publish a role, invite your team, and see ranked candidates arrive with evidence — all in one place."
        primary={{ to: "/intake", label: "Start hiring" }}
        secondary={{ to: "/jobs", label: "Browse open jobs" }}
      />
    </SiteShell>
  );
}

