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
  LayoutDashboard,
  MessageSquare,
  Quote,
  Sparkles,
  Users,
} from "lucide-react";

import {
  Breadcrumbs,
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

const WORKSPACE_VALUE = [
  {
    icon: LayoutDashboard,
    title: "One live workspace",
    body: "Positions, candidates, and decisions in a single place — updated the moment things change.",
  },
  {
    icon: BarChart3,
    title: "Ranked candidate delivery",
    body: "Every candidate arrives with a role-specific score and side-by-side comparison in the workspace.",
  },
  {
    icon: Sparkles,
    title: "Evidence you can read",
    body: "Actual quotes from the CV mapped to the requirements you approved — not generic keywords.",
  },
  {
    icon: ClipboardCheck,
    title: "Transparent status",
    body: "Applied · Under review · Shortlisted · Interview · Offer — your team and every candidate see the same status.",
  },
] as const;

const STEPS = [
  {
    n: "01",
    t: "Guided intake",
    d: "Tell us the role, requirements, and hiring context in five short steps.",
  },
  {
    n: "02",
    t: "Sourcing & evidence",
    d: "We source, parse, and produce a role-specific evidence sheet for every candidate.",
  },
  {
    n: "03",
    t: "Ranked shortlist in your workspace",
    d: "Delivered live. Shortlist, interview, or reject in one click — your recruiter sees it instantly.",
  },
  {
    n: "04",
    t: "Hire without placement fees",
    d: "Predictable subscription pricing — no per-hire commissions.",
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

/* ---------- Workspace preview (product-safe mock) ---------- */

function WorkspacePreview() {
  return (
    <div className="rounded-2xl border border-[color:var(--brand-navy)]/12 bg-white p-4 shadow-[var(--brand-shadow-lg)]">
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-[color:var(--brand-navy)]/8 pb-3">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="text-xs font-medium text-[color:var(--brand-navy)]/60">
          workspace · Senior Product Designer
        </span>
      </div>
      {/* candidate list */}
      <div className="mt-4 space-y-2.5">
        {[
          { n: "Alex R.", s: 94, tag: "Top match", tone: "success" },
          { n: "Priya S.", s: 88, tag: "Strong", tone: "success" },
          { n: "Marco V.", s: 82, tag: "Consider", tone: "info" },
          { n: "Yuki T.", s: 76, tag: "Shortlist", tone: "warning" },
        ].map((c) => (
          <div
            key={c.n}
            className="flex items-center gap-3 rounded-xl border border-[color:var(--brand-navy)]/8 bg-[color:var(--brand-paper)]/60 p-3"
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--brand-ocean)]/12 text-sm font-semibold text-[color:var(--brand-ocean)]">
              {c.n[0]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-[color:var(--brand-navy)]">
                {c.n}
              </div>
              <div className="text-xs text-[color:var(--brand-navy)]/60">{c.tag}</div>
            </div>
            <div className="shrink-0 rounded-md bg-[color:var(--brand-ocean)]/10 px-2 py-1 text-xs font-semibold tabular-nums text-[color:var(--brand-ocean)]">
              {c.s}
            </div>
          </div>
        ))}
      </div>
      {/* footer stats */}
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[color:var(--brand-navy)]/8 pt-3 text-center">
        {[
          ["12", "Ranked"],
          ["4", "Shortlisted"],
          ["1", "Offer"],
        ].map(([k, v]) => (
          <div key={v}>
            <div className="text-base font-semibold tabular-nums text-[color:var(--brand-navy)]">
              {k}
            </div>
            <div className="text-xs text-[color:var(--brand-navy)]/60">{v}</div>
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
      <section className="relative overflow-hidden bg-gradient-to-b from-[color:var(--brand-sky)]/30 via-[color:var(--brand-paper)] to-[color:var(--brand-paper)]">
        <PublicPage>
          <div className="grid grid-cols-1 gap-12 py-16 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:py-24">
            <div className="flex min-w-0 flex-col justify-center gap-6">
              <Eyebrow>Talent as a Service</Eyebrow>
              <h1 className="font-[family-name:var(--brand-font-display)] text-4xl font-semibold leading-tight tracking-tight text-[color:var(--brand-navy)] sm:text-5xl lg:text-[3.5rem]">
                A live recruiting workspace.
                <br className="hidden sm:block" />{" "}
                Ranked candidates. No black box.
              </h1>
              <p className="max-w-xl text-lg text-[color:var(--brand-navy)]/75">
                Positions, ranked candidates, evidence, and every hiring decision
                in one workspace your team, your recruiter, and every candidate
                can see.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  to="/intake"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[color:var(--brand-navy-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
                >
                  Start hiring <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <a
                  href="#workspace"
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/15 bg-white px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
                >
                  Explore the workspace
                </a>
              </div>
              <p className="text-xs text-[color:var(--brand-navy)]/60">
                Ranked delivery · Evidence per requirement · One live workspace
              </p>
            </div>
            <div className="min-w-0">
              <WorkspacePreview />
            </div>
          </div>
        </PublicPage>
      </section>

      {/* 2 — DASHBOARD-FIRST VALUE */}
      <PublicSection as="section" className="scroll-mt-16" >
        <span id="workspace" className="sr-only" aria-hidden />
        <PublicPage>
          <SectionHead
            eyebrow="The workspace is the product"
            title="Every candidate, every decision, one screen."
            lead="Recruiting agencies send PDFs. TaaSFlow gives you a live workspace where ranked candidates arrive, evidence is one click away, and every action updates for everyone simultaneously."
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {WORKSPACE_VALUE.map((v) => (
              <Card key={v.title}>
                <v.icon
                  className="h-6 w-6 text-[color:var(--brand-ocean)]"
                  aria-hidden
                />
                <h3 className="mt-4 text-base font-semibold text-[color:var(--brand-navy)]">
                  {v.title}
                </h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">
                  {v.body}
                </p>
              </Card>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* 3 — HOW IT WORKS */}
      <section className="border-y border-[color:var(--brand-navy)]/8 bg-white">
        <PublicSection>
          <PublicPage>
            <SectionHead
              eyebrow="How it works"
              title="From intake to hire in four clear steps."
            />
            <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <li
                  key={s.n}
                  className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 shadow-[var(--brand-shadow-xs)]"
                >
                  <div className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tabular-nums text-[color:var(--brand-ocean)]">
                    {s.n}
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-[color:var(--brand-navy)]">
                    {s.t}
                  </h3>
                  <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">
                    {s.d}
                  </p>
                </li>
              ))}
            </ol>
            <div className="mt-8">
              <Link
                to="/how-it-works"
                className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-ocean)] hover:text-[color:var(--brand-navy)]"
              >
                See the full process <ArrowRight className="h-4 w-4" aria-hidden />
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

// Re-export so unused imports don't warn if a helper is later removed.
export { Breadcrumbs };
