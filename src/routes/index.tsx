import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/marketing/site-shell";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";
import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Globe2,
  LayoutDashboard,
  Rocket,
  Sparkles,
  Users,
} from "lucide-react";

const entry = getPage("index");

export const Route = createFileRoute("/")({
  head: () =>
    marketingHead(entry, "/", {
      title: "TaaSFlow — Live recruiting workspace. Ranked candidates in 14 days.",
      description:
        "TaaSFlow is subscription recruiting with a live workspace. Ranked, evidence-backed shortlists in 14 days for a flat monthly fee. No placement fees.",
    }),
  component: Home,
});

const KPIS = [
  { k: "14 days", v: "To first ranked shortlist" },
  { k: "0%", v: "Placement fees" },
  { k: "50+", v: "Countries covered" },
  { k: "20,000+", v: "Candidates placed" },
] as const;

const WORKSPACE_VALUE = [
  {
    icon: LayoutDashboard,
    t: "Live hiring workspace",
    d: "Every requisition, every candidate, every decision in one workspace — updated the moment things change.",
  },
  {
    icon: BarChart3,
    t: "Ranked candidate delivery",
    d: "Candidates scored 0–100 with evidence for each requirement. Compare, shortlist, and decide in minutes.",
  },
  {
    icon: Sparkles,
    t: "Role-specific evidence",
    d: "Not generic keywords — actual quotes from the CV mapped to the requirements you approved.",
  },
  {
    icon: ClipboardCheck,
    t: "Transparent progress",
    d: "Applied · Under review · Shortlisted · Interview · Offer. Your team and every candidate see the same status.",
  },
] as const;

const STEPS = [
  {
    n: "01",
    t: "5-step intake",
    d: "Tell us the role, requirements, and hiring context. Takes about 10 minutes.",
  },
  {
    n: "02",
    t: "Sourcing & evidence",
    d: "We source, parse, and score. Every candidate gets a role-specific evidence sheet.",
  },
  {
    n: "03",
    t: "Ranked shortlist in 14 days",
    d: "Delivered to your workspace. Shortlist, interview, or reject in one click.",
  },
  {
    n: "04",
    t: "Hire — no placement fee",
    d: "Flat monthly fee, unlimited hires per subscription. Cancel anytime.",
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

function Home() {
  return (
    <SiteShell>
      {/* 1. Hero */}
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:px-8 lg:py-28">
          <div className="flex flex-col justify-center gap-6">
            <p className="text-sm font-medium uppercase tracking-widest text-primary">
              Talent as a Service
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              A live recruiting workspace.
              <br />
              Ranked candidates in 14&nbsp;days.
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              TaaSFlow replaces the black box of agency recruiting with a
              workspace your team, your recruiter, and every candidate can see —
              at one flat monthly fee. No placement fees. Ever.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/intake"
                className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                Start a pilot
              </Link>
              <Link
                to="/jobs"
                className="rounded-md border border-input px-5 py-3 text-sm font-semibold hover:bg-accent"
              >
                Browse open roles
              </Link>
              <Link
                to="/how-it-works"
                className="rounded-md px-5 py-3 text-sm font-semibold text-primary hover:underline"
              >
                See how it works →
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">
              Ranked · Evidence-backed · Live workspace · No placement fees
            </p>
          </div>

          {/* Workspace preview mock */}
          <div className="relative">
            <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-lg">
              <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
                </div>
                <span className="text-xs text-muted-foreground">
                  workspace · Senior Product Designer
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {[
                  { n: "Alex R.", s: 94, tag: "Top match" },
                  { n: "Priya S.", s: 88, tag: "Strong" },
                  { n: "Marco V.", s: 82, tag: "Consider" },
                  { n: "Yuki T.", s: 76, tag: "Shortlist" },
                ].map((c) => (
                  <div
                    key={c.n}
                    className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/60 p-3"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {c.n[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{c.n}</div>
                      <div className="text-xs text-muted-foreground">{c.tag}</div>
                    </div>
                    <div className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold tabular-nums text-primary">
                      {c.s}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-center text-xs">
                {[
                  ["12", "Ranked"],
                  ["4", "Shortlisted"],
                  ["1", "Offer"],
                ].map(([k, v]) => (
                  <div key={v}>
                    <div className="text-base font-semibold tabular-nums">{k}</div>
                    <div className="text-muted-foreground">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Dashboard-led value proposition */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">
            The workspace is the product
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Every candidate, every decision, one screen.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Recruiting agencies send PDFs. TaaSFlow gives you a live workspace
            where ranked candidates arrive, evidence is one click away, and every
            action — shortlist, interview, offer — updates for everyone
            simultaneously.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {WORKSPACE_VALUE.map((c) => (
            <div
              key={c.t}
              className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm"
            >
              <c.icon className="h-6 w-6 text-primary" aria-hidden />
              <h3 className="mt-4 text-base font-semibold">{c.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* KPI band */}
      <section className="border-y border-border/60 bg-muted/30">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-4 lg:px-8">
          {KPIS.map((s) => (
            <div key={s.v}>
              <div className="text-3xl font-bold tabular-nums text-foreground">
                {s.k}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{s.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. How it works */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            From intake to hire in four steps.
          </h2>
        </div>
        <ol className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm"
            >
              <div className="text-2xl font-bold text-primary tabular-nums">
                {s.n}
              </div>
              <h3 className="mt-3 text-base font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8">
          <Link
            to="/how-it-works"
            className="text-sm font-medium text-primary hover:underline"
          >
            See the full process →
          </Link>
        </div>
      </section>

      {/* 4. Live workspace benefits */}
      <section className="border-t border-border/60 bg-muted/20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-primary">
              Live workspace benefits
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Synchronized updates. Faster decisions.
            </h2>
            <p className="mt-4 text-muted-foreground">
              When a candidate is scored, your team sees it. When a client
              shortlists, the candidate sees it. When an interview is scheduled,
              everyone's calendar updates. No email chains. No PDF versioning.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Realtime candidate ranking and evidence",
                "One-click shortlist, interview, or reject",
                "Cross-role talent comparison",
                "Full audit trail of every decision",
                "Direct messaging with your recruiter and candidates",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
            <div className="text-sm font-semibold">Activity feed</div>
            <ul className="mt-4 space-y-3 text-sm">
              {[
                ["Priya S. moved to Interview", "2m ago"],
                ["New candidate: Alex R. — score 94", "12m ago"],
                ["Evidence updated on Marco V.", "1h ago"],
                ["Client shortlisted Yuki T.", "3h ago"],
                ["Position approved: Senior Designer", "yesterday"],
              ].map(([t, w]) => (
                <li
                  key={t}
                  className="flex items-center justify-between gap-4 border-b border-border/40 pb-3 last:border-0 last:pb-0"
                >
                  <span className="min-w-0 truncate">{t}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{w}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 5. Speed, transparency, cost control */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Clock3,
              t: "Speed",
              d: "First ranked shortlist in 14 days. Agencies take 6–10 weeks.",
            },
            {
              icon: Sparkles,
              t: "Transparency",
              d: "Every candidate, every score, every decision — visible to your team.",
            },
            {
              icon: Rocket,
              t: "Predictable cost",
              d: "Flat monthly fee. Unlimited hires. No 20% surprises.",
            },
          ].map((c) => (
            <div
              key={c.t}
              className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm"
            >
              <c.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{c.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Candidate-delivery experience */}
      <section className="border-t border-border/60 bg-muted/20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-primary">
              Candidate delivery
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              What arrives every week.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Not a PDF. A ranked list in your workspace, each candidate with a
              fit narrative, evidence quotes from the CV, and structured screening
              answers. Compare side-by-side and decide in minutes.
            </p>
            <div className="mt-6">
              <Link
                to="/how-it-works"
                className="text-sm font-medium text-primary hover:underline"
              >
                See a sample delivery →
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Alex R.</div>
                <div className="text-xs text-muted-foreground">
                  Senior Product Designer · Remote
                </div>
              </div>
              <div className="rounded-md bg-primary/10 px-3 py-1 text-sm font-semibold tabular-nums text-primary">
                94
              </div>
            </div>
            <div className="mt-4 space-y-2 text-xs">
              {[
                ["Design systems", 96],
                ["B2B SaaS experience", 92],
                ["Team leadership", 88],
                ["Timezone overlap", 100],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex items-center gap-2 sm:gap-3">
                  <span className="w-24 shrink-0 truncate text-muted-foreground sm:w-40">{k}</span>
                  <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${v}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right tabular-nums font-medium">
                    {v}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
              "Led design system rollout at Acme (2022–2024), reducing component
              debt by 40%." — CV, page 2
            </p>
          </div>
        </div>
      </section>

      {/* 7. Enterprise & global */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-sm">
            <Users className="h-6 w-6 text-primary" />
            <h3 className="mt-4 text-xl font-semibold">Enterprise-ready</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Multi-department programs, SSO, audit trail, dedicated pod. Keep
              your ATS — we integrate.
            </p>
            <Link
              to="/enterprise"
              className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
            >
              Enterprise details →
            </Link>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-sm">
            <Globe2 className="h-6 w-6 text-primary" />
            <h3 className="mt-4 text-xl font-semibold">Global talent</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              50+ countries, timezone-aware ranking, work-authorization screening
              built in.
            </p>
            <Link
              to="/global-talent"
              className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
            >
              Global talent →
            </Link>
          </div>
        </div>
      </section>

      {/* 8. Industries */}
      <section className="border-t border-border/60 bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-widest text-primary">
              Industries
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Built for the roles you actually hire.
            </h2>
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {INDUSTRIES.map(([slug, label]) => (
              <Link
                key={slug}
                to="/industries/$slug"
                params={{ slug }}
                className="rounded-full border border-border/60 bg-card px-4 py-2 text-sm hover:bg-accent"
              >
                {label}
              </Link>
            ))}
            <Link
              to="/industries"
              className="rounded-full border border-primary/40 bg-primary/5 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10"
            >
              All industries →
            </Link>
          </div>
        </div>
      </section>

      {/* 9. Proof */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">
            Proof
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Teams hiring differently.
          </h2>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            ["80+", "Companies served"],
            ["20,000+", "Candidates placed"],
            ["50+", "Countries"],
          ].map(([k, v]) => (
            <div
              key={v}
              className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm"
            >
              <div className="text-3xl font-bold tabular-nums">{k}</div>
              <div className="mt-1 text-sm text-muted-foreground">{v}</div>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <Link
            to="/case-studies"
            className="text-sm font-medium text-primary hover:underline"
          >
            Read case studies →
          </Link>
        </div>
      </section>

      {/* 10. Final CTA */}
      <section className="border-t border-border/60 bg-gradient-to-b from-primary/5 to-background">
        <div className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Start hiring without the placement fee.
          </h2>
          <p className="mt-3 text-muted-foreground">
            One flat monthly fee. Ranked, evidence-backed candidates every week.
            A live workspace so you always know where each role stands.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/intake"
              className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Start a pilot
            </Link>
            <Link
              to="/contact"
              className="rounded-md border border-input px-5 py-3 text-sm font-semibold hover:bg-accent"
            >
              Book a consultation
            </Link>
            <Link
              to="/jobs"
              className="rounded-md px-5 py-3 text-sm font-semibold text-primary hover:underline"
            >
              Browse roles →
            </Link>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
