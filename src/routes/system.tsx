import { createFileRoute } from "@tanstack/react-router";
import { marketingHead } from "@/lib/marketing/head";
import { IntelligencePreview } from "@/components/marketing/product-preview/intelligence-preview";
import {
  SiteShell,
  PublicPage,
  PublicSection,
  CtaSection,
} from "@/components/marketing/site-shell";
import {
  Radar,
  Search,
  Workflow,
  Layers,
  MonitorCog,
  UserCheck,
  Sparkles,
  ScanEye,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

/**
 * /system — Proprietary system story, truthfully told.
 * ---------------------------------------------------
 * Presents TaaSFlow as a serious proprietary system without faking autonomy.
 * The system does structured work. Expert operators run the loop.
 */

export const Route = createFileRoute("/system")({
  head: () =>
    marketingHead(undefined, "/system", {
      title: "The TaaSFlow System — agents, evidence, scoring, workspace",
      description:
        "TaaSFlow is an AI Hiring Intelligence Platform: multi-channel discovery, evidence extraction, versioned scoring rubrics and a live Decision Workspace — with expert approval gates, never unattended AI.",
    }),
  component: SystemPage,
});

const PILLARS = [
  {
    id: "sourcing",
    icon: Radar,
    eyebrow: "Multi-channel sourcing",
    title: "We don't wait for applicants.",
    body:
      "The system reaches candidates across job boards, professional networks, communities, referrals, and our own talent memory in parallel. Every touch is logged, attributed, and measurable — reply rate, shortlist rate, hire rate per channel.",
    bullets: [
      "Inbound + outbound in one funnel",
      "Channel attribution on every hire",
      "Silver medalists rediscovered automatically",
    ],
  },
  {
    id: "research",
    icon: Search,
    eyebrow: "Web and database research",
    title: "Context beyond the CV.",
    body:
      "For each candidate the system pulls signal from public profiles, prior companies, project trails, and our internal history with them. Researchers verify the important claims before anything reaches a client.",
    bullets: [
      "Public web enrichment (structured, sourced)",
      "Prior interactions and outcomes surfaced",
      "Every claim ties back to a source snippet",
    ],
  },
  {
    id: "scoring",
    icon: Layers,
    eyebrow: "Structured scoring",
    title: "Evidence-first, per requirement.",
    body:
      "Roles are decomposed into requirements. Each requirement is scored against explicit evidence — a CV quote, an answer, a verified fact. A single 0–100 fit score falls out of that math, not the other way around.",
    bullets: [
      "Per-requirement verdict + evidence quote",
      "Coverage %, contradiction flags, engine version",
      "Same rubric applied to every candidate on a role",
    ],
  },
  {
    id: "workflow",
    icon: Workflow,
    eyebrow: "Workflow automation",
    title: "The boring, repeatable work runs itself.",
    body:
      "Parsing, deduping, screening questions, status changes, notifications, handoffs, reminders, publish gates — automated with audit trails. Operators approve, override, and unblock; the system does the mechanical work in between.",
    bullets: [
      "Publish gates and approvals",
      "Status transitions with audit rows",
      "Notifications and reminders on rails",
    ],
  },
  {
    id: "evidence",
    icon: ScanEye,
    eyebrow: "Evidence engine",
    title: "Every claim shows its work.",
    body:
      "Scores, insights, and shortlist recommendations link back to the exact CV excerpt, application answer, or research note that produced them. Contradictions get flagged, not hidden.",
    bullets: [
      "CV excerpt viewer with requirement mapping",
      "Timeline of parsing, scoring, and decisions",
      "Downloadable evidence record for staff",
    ],
  },
  {
    id: "workspace",
    icon: MonitorCog,
    eyebrow: "Live workspace",
    title: "You watch the pipeline move in real time.",
    body:
      "Clients see the same board the platform runs on — no weekly PDF, no BCC threads. Kanban, decisions, offers, hire tracking, and pipeline activity all read from one system of record.",
    bullets: [
      "Kanban + decision cockpit + offers board",
      "Realtime refresh across every surface",
      "One system of record for the whole hire",
    ],
  },
  {
    id: "operators",
    icon: UserCheck,
    eyebrow: "Expert operators in the loop",
    title: "Humans decide. The system removes drag.",
    body:
      "Recruiters, sourcers, and researchers run the accounts. The system automates parsing, scoring math, evidence linking, and audit logging so operators spend their time on judgment — outreach quality, calibration, client conversations, hiring decisions.",
    bullets: [
      "Expert oversight owns calibration and escalation",
      "Researchers verify claims before shortlist",
      "Client success owns the relationship",
    ],
  },
];

const HONESTY_LINES = [
  {
    icon: Sparkles,
    title: "What the system does well",
    body:
      "Parses, dedupes, structures evidence, scores against a shared rubric, runs the workflow, keeps the audit trail, and surfaces context — at a scale humans can't match.",
  },
  {
    icon: UserCheck,
    title: "What humans still own",
    body:
      "Outreach voice, calibration on borderline candidates, client conversations, and the actual hire decision. We do not ship candidates unattended.",
  },
  {
    icon: ShieldCheck,
    title: "What we don't claim",
    body:
      "No fully autonomous AI recruiter. No black-box magic. No promises the system can't back with evidence and an audit row.",
  },
];

function SystemPage() {
  return (
    <SiteShell>
      <PublicSection className="pb-8 pt-16 sm:pt-20">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
            The TaaSFlow System
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">
            A proprietary recruiting system, run by expert operators.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/80">
            TaaSFlow is software plus people. The system sources, researches,
            scores, and automates the mechanical work of hiring. Recruiters,
            sourcers, and researchers run the loop. Both parts are visible.
          </p>
          <nav className="mt-8 flex flex-wrap gap-2 text-sm">
            {PILLARS.map((p) => (
              <a
                key={p.id}
                href={`#${p.id}`}
                className="rounded-full border border-[color:var(--brand-navy)]/15 px-3 py-1.5 text-[color:var(--brand-navy)]/80 hover:border-[color:var(--brand-ocean)] hover:text-[color:var(--brand-navy)]"
              >
                {p.eyebrow}
              </a>
            ))}
          </nav>
        </PublicPage>
      </PublicSection>

      {PILLARS.map((p, idx) => (
        <div id={p.id} key={p.id}>
          <PublicSection className={idx % 2 === 0 ? "py-12" : "py-12 bg-[color:var(--brand-sky)]/40"}>
            <PublicPage>
              <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
                    <p.icon className="h-3.5 w-3.5" /> {p.eyebrow}
                  </div>
                  <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
                    {p.title}
                  </h2>
                  <p className="mt-3 text-base text-[color:var(--brand-navy)]/80">
                    {p.body}
                  </p>
                </div>
                <ul className="grid gap-3 self-start rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 shadow-[var(--brand-shadow-sm)]">
                  {p.bullets.map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-3 text-sm text-[color:var(--brand-navy)]/80"
                    >
                      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-ocean-text)]" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </PublicPage>
          </PublicSection>
        </div>
      ))}

      <PublicSection className="py-14">
        <PublicPage>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
              What we do and don't claim
            </p>
            <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
              Serious system. Honest scope.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {HONESTY_LINES.map((h) => (
              <div
                key={h.title}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <div className="flex items-center gap-2 text-[color:var(--brand-ocean-text)]">
                  <h.icon className="h-4 w-4" />
                  <div className="text-xs font-semibold uppercase tracking-[0.14em]">
                    {h.title}
                  </div>
                </div>
                <p className="mt-3 text-sm text-[color:var(--brand-navy)]/80">
                  {h.body}
                </p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="border-t border-[color:var(--brand-navy)]/8 bg-white py-14">
        <PublicPage>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
              Hiring intelligence
            </p>
            <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
              Metrics that answer a question — or admit they cannot.
            </h2>
            <p className="mt-3 text-[color:var(--brand-navy)]/80">
              The workspace never draws a chart it does not have the data for. Below
              is the same component, showing a live number, a partial sample and an
              honest "not enough data" state.
            </p>
          </div>

          <div className="mt-10">
            <IntelligencePreview />
          </div>
        </PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow="See the system on your role"
        title="30-minute walkthrough on a live workspace."
        description="We open the pipeline, the scoring rubric, the evidence record, and the audit trail — with a real role, not a demo."
        primary={{ to: "/intake", label: "Start a role" }}
        secondary={{ to: "/trust", label: "Read the trust pack" }}
      />
    </SiteShell>
  );
}
