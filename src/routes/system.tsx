import { createFileRoute } from "@tanstack/react-router";
import { marketingHead } from "@/lib/marketing/head";
import { CTA_BOOK } from "@/config/cta";
import { OFFER_CATEGORY, WHO_RUNS_THE_SEARCH, CALL_NAME } from "@/config/offer-facts";
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
      title: "How the TaaSFlow system works | TaaSFlow",
      description:
        "TaaSFlow is a recruiting platform with managed execution: agents source and score, a recruiter reviews every shortlist, and you make every hiring decision.",
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
      "The system reaches candidates through professional networks, communities, referrals, our own talent network and the TaaSFlow job board, chosen per role. Every touch is logged and attributed to its channel. Outbound distribution to external job boards is planned, not built.",
    bullets: [
      "Inbound + outbound in one funnel",
      "Channel attribution on every candidate",
      "Past finalists can be brought back in",
    ],
  },
  {
    id: "research",
    icon: Search,
    eyebrow: "Research and verification",
    title: "Claims are checked, not assumed.",
    body:
      "Scoring uses evidence from the material a candidate submits, such as their CV and application answers. A recruiter verifies the important claims before anything reaches you. No external data-enrichment source is connected today.",
    bullets: [
      "Evidence taken from submitted material",
      "Prior interactions and outcomes shown to your recruiter",
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
      "Parsing, deduping, screening questions, status changes, notifications, handoffs, reminders, publish gates — automated with audit trails. People approve, override and unblock; the system does the mechanical work in between.",
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
      "Evidence record behind every score",
    ],
  },
  {
    id: "workspace",
    icon: MonitorCog,
    eyebrow: "Live workspace",
    title: "You see the pipeline move.",
    body:
      "You see the same board we work in, with no weekly PDF and no BCC threads. Kanban, decisions, offers, hire tracking, and pipeline activity all read from one system of record.",
    bullets: [
      "Kanban + decision cockpit + offers board",
      "Updates appear as work happens",
      "One system of record for the whole hire",
    ],
  },
  {
    id: "operators",
    icon: UserCheck,
    eyebrow: "People in the loop",
    title: "Humans decide. The system removes drag.",
    body:
      "A recruiter reviews every shortlist before you see it. The system automates parsing, scoring math, evidence linking and audit logging so people spend their time on judgment: outreach quality, calibration and your hiring decisions.",
    bullets: [
      "A recruiter owns calibration and escalation",
      "Claims are verified before the shortlist",
      "You make every hiring decision",
    ],
  },
];

const HONESTY_LINES = [
  {
    icon: Sparkles,
    title: "What the system does well",
    body:
      "Parses, dedupes, structures evidence, scores against a shared rubric, runs the workflow, keeps the audit trail and surfaces context.",
  },
  {
    icon: UserCheck,
    title: "What humans still own",
    body:
      "Outreach voice, calibration on borderline candidates and the hiring decision. A recruiter reviews every shortlist before you see it.",
  },
  {
    icon: ShieldCheck,
    title: "What we don't claim",
    body:
      "No fully autonomous AI recruiter. No black-box magic. No promises the system cannot back with evidence and an audit row.",
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
            Software and people, both visible.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/80">
            {OFFER_CATEGORY}. {WHO_RUNS_THE_SEARCH} Both parts, the software and the people,
            are visible.
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
              is an example of the same component, showing a number, a partial sample and an
              honest "not enough data" state. The figures are illustrative.
            </p>
          </div>

          <div className="mt-10">
            <IntelligencePreview />
          </div>
        </PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow="See the system on your role"
        title={`A ${CALL_NAME} about your role.`}
        description="We walk through the process, the scoring rubric, the evidence record and the audit trail, using your role as the example."
        primary={CTA_BOOK}
        secondary={{ to: "/trust", label: "Read the trust pack" }}
      />
    </SiteShell>
  );
}
