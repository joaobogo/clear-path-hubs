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
import { RoiCalculator } from "@/components/marketing/roi-calculator";
import { ModelComparison } from "@/components/marketing/model-comparison";
import { OperatingSystem } from "@/components/marketing/operating-system";
import { WorkspaceTour } from "@/components/marketing/workspace-tour";
import { AudienceSelector } from "@/components/marketing/audience-selector";
import { TrustStrip } from "@/components/marketing/trust-strip";
import { WhySwitchMatrix } from "@/components/marketing/why-switch-matrix";

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
    q: "What is TaaSFlow?",
    a: "TaaSFlow is an on-demand recruiting function delivered as a subscription. A recruiter runs sourcing and evaluation for your roles inside a live workspace your team can see at any time.",
  },
  {
    q: "How is TaaSFlow different from a recruiting agency?",
    a: "Agencies charge a percentage of salary per hire and forward CVs by email. TaaSFlow is a flat monthly subscription with ranked candidates, evidence per requirement, and a transparent workspace — no placement fees.",
  },
  {
    q: "What does the Client actually receive?",
    a: "A ranked shortlist, recruiter-written evidence tied to each requirement, CV quotes, a live pipeline across every stage, and one workspace thread with your recruiter — all owned by your team.",
  },
  {
    q: "Who runs the interviews?",
    a: "Your team runs interviews and the offer conversation directly with the candidate. TaaSFlow prepares the shortlist and stays available in the workspace for support — we do not gate access to candidates.",
  },
  {
    q: "How does pricing work?",
    a: "Flat monthly subscription per active role. No percentage-of-salary fees and no per-hire fees. Specific plans are shared on request so we can match capacity to your open roles.",
  },
  {
    q: "Who owns the candidates and pipeline?",
    a: "You do. Every candidate, note, evidence quote, and message stays in your workspace so past pipelines are reusable when new roles open.",
  },
  {
    q: "What types of hiring do you support?",
    a: "Individual contributor and manager roles across the industries listed on the Industries page — including SaaS, Tech, Finance, Healthcare, Sales, HR, Consulting, and Skilled Trades. Executive search is scoped case by case.",
  },
  {
    q: "How do we start?",
    a: "Open a role with the intake wizard or book a conversation. We confirm the requirements with you before any sourcing begins so evidence is scored against what you actually approved.",
  },
] as const;

const APPROVED_PROOF = [
  {
    icon: ClipboardCheck,
    t: "Structured evaluation",
    d: "Every candidate is scored against the requirements you approved in the intake — same criteria, same weighting, same evidence format across roles.",
  },
  {
    icon: Eye,
    t: "Transparent workspace",
    d: "Sourcing progress, pipeline stages, evidence, and recruiter notes are visible to your team in real time. Nothing sits in a private inbox.",
  },
  {
    icon: Repeat,
    t: "Client-controlled pipeline",
    d: "Candidates, notes, and evidence belong to your workspace. When a role closes, the context is still there for the next one.",
  },
  {
    icon: Target,
    t: "Role-specific delivery",
    d: "Requirements, evidence prompts, and scoring are tuned to the role — not a generic template applied to every search.",
  },
  {
    icon: Users,
    t: "Human review on every candidate",
    d: "A recruiter reads each CV, writes the evidence, and approves it before a candidate is published to your shortlist.",
  },
  {
    icon: ShieldCheck,
    t: "Full audit trail",
    d: "Every decision — approvals, stage moves, evidence edits — is recorded, so your team can revisit why a candidate progressed or didn't.",
  },
] as const;

const HOMEPAGE_RESOURCES = [
  {
    slug: "ai-in-recruitment",
    type: "Article",
    title: "AI in Recruitment 2026: What Works, What Fails, and What Is Next",
    description:
      "An honest assessment of AI in recruiting — from resume parsing to predictive analytics — and where human judgment still decides.",
    icon: Sparkles,
    tone: "ocean",
  },
  {
    slug: "30-60-90-onboarding-plan-2026",
    type: "Guide",
    title: "The 30-60-90 Onboarding Plan for 2026",
    description:
      "A research-backed onboarding framework with week-by-week milestones and manager checkpoints for new hires.",
    icon: CalendarClock,
    tone: "navy",
  },
  {
    slug: "ai-impact-on-jobs-hiring",
    type: "Analysis",
    title: "AI's Impact on Jobs and Hiring",
    description:
      "Which roles are being augmented versus automated — and how hiring teams should prioritise skills as the mix shifts.",
    icon: TrendingUp,
    tone: "ocean",
  },
] as const;

const PROBLEM_ROWS = [
  {
    label: "Commercial model",
    icon: Wallet,
    old: "Percentage-of-salary placement fees, paid on every hire.",
    next: "Flat subscription. No placement fees per hire.",
  },
  {
    label: "Sourcing",
    icon: Search,
    old: "Black-box sourcing. You see the CVs, not the search behind them.",
    next: "Continuous sourcing you can follow in the workspace.",
  },
  {
    label: "Candidate delivery",
    icon: ListChecks,
    old: "CV volume forwarded by email. No ranking, no reasoning.",
    next: "Ranked candidates with role-specific evidence per requirement.",
  },
  {
    label: "Visibility",
    icon: Eye,
    old: "Limited visibility until the agency decides to update you.",
    next: "Live Client workspace with transparent progress at every stage.",
  },
  {
    label: "Communication",
    icon: MessageSquare,
    old: "Fragmented across email threads, calls, and forwarded attachments.",
    next: "One workspace thread with your recruiter, tied to the role.",
  },
  {
    label: "Effort on your team",
    icon: Users,
    old: "Sourcing work quietly ends up on internal HR after the first pass.",
    next: "TaaSFlow carries the sourcing and evaluation load end-to-end.",
  },
  {
    label: "Pipeline ownership",
    icon: Repeat,
    old: "Pipeline and candidate context disappear when the engagement ends.",
    next: "Reusable, Client-owned candidate pipeline that stays with you.",
  },
] as const;

const PROCESS_STEPS = [
  {
    title: "Define the role",
    icon: ClipboardCheck,
    taasflow: "Structured intake with your team to align on scope and must-haves.",
    client: "A draft role brief to review and approve.",
    output: "Approved requirements and success criteria.",
  },
  {
    title: "Build the search strategy",
    icon: Compass,
    taasflow: "Design the sourcing plan, target profiles, and outreach angles.",
    client: "A summary of where and how we'll search.",
    output: "Search strategy tied to the approved brief.",
  },
  {
    title: "Source candidates",
    icon: Radar,
    taasflow: "Continuous multi-channel sourcing and outreach.",
    client: "Live sourcing progress inside the workspace.",
    output: "A pool of engaged candidates for the role.",
  },
  {
    title: "Evaluate evidence",
    icon: FileText,
    taasflow: "Recruiter review of each CV, mapped to your requirements.",
    client: "Evidence and CV quotes per requirement.",
    output: "A recruiter-written evidence file per candidate.",
  },
  {
    title: "Rank the strongest profiles",
    icon: BarChart3,
    taasflow: "Role-specific scoring against the approved criteria.",
    client: "Ranked candidates with fit scores and reasoning.",
    output: "A ranked shortlist, highest fit first.",
  },
  {
    title: "Deliver to the workspace",
    icon: Send,
    taasflow: "Publish the shortlist and open direct handover.",
    client: "Candidates, evidence, and contact ready to act on.",
    output: "A live shortlist you can review and move forward.",
  },
  {
    title: "Client reviews and decides",
    icon: Handshake,
    taasflow: "Support your team through interview scheduling and questions.",
    client: "Full profiles, evidence, and status controls.",
    output: "Interview, offer, and hiring decisions — yours.",
  },
  {
    title: "Feedback improves the next delivery",
    icon: Workflow,
    taasflow: "Recalibrate the search from your feedback on each candidate.",
    client: "A pipeline that gets sharper delivery after delivery.",
    output: "A refined search and a reusable candidate pipeline.",
  },
] as const;

const FEATURED_INDUSTRIES = [
  {
    name: "Technology",
    slug: "tech",
    context: "Engineering, product, and platform hiring where technical depth has to be verified, not assumed.",
    roles: "Senior Backend Engineer · Staff Platform Engineer",
  },
  {
    name: "SaaS",
    slug: "saas",
    context: "Go-to-market and product roles for subscription businesses balancing growth and retention.",
    roles: "Product Manager · Customer Success Lead",
  },
  {
    name: "Finance",
    slug: "finance",
    context: "Regulated hiring where domain knowledge, licenses, and risk experience are non-negotiable.",
    roles: "FP&A Manager · Risk Analyst",
  },
  {
    name: "Healthcare",
    slug: "healthcare",
    context: "Clinical, operations, and healthtech roles where credentials and compliance matter as much as skills.",
    roles: "Clinical Operations Lead · Healthtech Product Manager",
  },
  {
    name: "Legal",
    slug: "legal",
    context: "In-house counsel and legal operations hiring with jurisdiction, matter type, and seniority scoped up front.",
    roles: "In-house Counsel · Legal Operations Manager",
  },
  {
    name: "Sales",
    slug: "sales",
    context: "Quota-carrying roles evaluated against segment, cycle length, and demonstrated attainment.",
    roles: "Enterprise Account Executive · Sales Development Lead",
  },
  {
    name: "Human Resources",
    slug: "human-resources",
    context: "HR, People, and Talent hires assessed on the operating model behind their previous programs.",
    roles: "Head of People · Talent Partner",
  },
  {
    name: "Consulting",
    slug: "consulting",
    context: "Strategy, operations, and delivery consultants scoped to industry, function, and engagement scale.",
    roles: "Management Consultant · Delivery Manager",
  },
  {
    name: "Construction",
    slug: "construction",
    context: "Site, project, and engineering roles evaluated on project scale, safety record, and delivery history.",
    roles: "Project Manager · Site Engineer",
  },
  {
    name: "Real Estate",
    slug: "real-estate",
    context: "Investment, development, and asset management hires scoped to sector, geography, and deal size.",
    roles: "Investment Associate · Asset Manager",
  },
  {
    name: "Hospitality",
    slug: "hospitality",
    context: "Operations and guest-experience leaders assessed on property type, brand standards, and P&L scope.",
    roles: "General Manager · Director of Operations",
  },
  {
    name: "Staffing Agencies",
    slug: "staffing-agencies",
    context: "Recruiting capacity for agencies that need overflow sourcing without losing client ownership.",
    roles: "Recruiter · Sourcing Partner",
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

/* ---------- Hero workspace visual — interactive, static fictional data ---------- */

type HeroCandidate = {
  id: string;
  name: string;
  headline: string;
  score: number;
  band: "Top fit" | "Strong fit" | "Consider";
  stage: "Under review" | "Shortlisted" | "Interview";
  recommendation: string;
  coverage: { key: string; label: string; pct: number; evidence: string }[];
};

const HERO_CANDIDATES: HeroCandidate[] = [
  {
    id: "A-1042",
    name: "Alex R.",
    headline: "Senior Product Designer · 8 yrs · B2B SaaS",
    score: 94,
    band: "Top fit",
    stage: "Shortlisted",
    recommendation: "Shortlist — strongest evidence on design-system ownership and B2B depth.",
    coverage: [
      { key: "ds", label: "Design systems ownership", pct: 96, evidence: "Led design-system rollout across three product lines; documented adoption across ten squads." },
      { key: "b2b", label: "B2B SaaS product experience", pct: 92, evidence: "Six years shipping B2B SaaS surfaces used by revenue and operations teams." },
      { key: "lead", label: "Team leadership", pct: 88, evidence: "Managed a team of five designers through one org restructure and two hiring cycles." },
      { key: "ops", label: "Design ops tooling", pct: 62, evidence: "Partnered with engineering on tokens pipeline; hands-on tooling ownership to validate." },
    ],
  },
  {
    id: "A-1039",
    name: "Priya M.",
    headline: "Senior Product Designer · 7 yrs · Fintech",
    score: 91,
    band: "Strong fit",
    stage: "Under review",
    recommendation: "Advance to interview — strong systems work, validate B2B SaaS depth.",
    coverage: [
      { key: "ds", label: "Design systems ownership", pct: 90, evidence: "Rebuilt a fintech design system to WCAG 2.2 AA; ran adoption workshops for four squads." },
      { key: "b2b", label: "B2B SaaS product experience", pct: 74, evidence: "Two years on B2B-facing fintech surfaces; most work sits closer to consumer flows." },
      { key: "lead", label: "Team leadership", pct: 82, evidence: "Design lead on a three-person team; mentors two mid-level designers." },
      { key: "ops", label: "Design ops tooling", pct: 78, evidence: "Owned Figma library governance and contribution model end to end." },
    ],
  },
  {
    id: "A-1037",
    name: "Dan K.",
    headline: "Senior Product Designer · 9 yrs · Marketplaces",
    score: 87,
    band: "Consider",
    stage: "Under review",
    recommendation: "Consider — strong craft, validate systems ownership at scale in interview.",
    coverage: [
      { key: "ds", label: "Design systems ownership", pct: 78, evidence: "Contributed heavily to two systems; not the named owner on either rollout." },
      { key: "b2b", label: "B2B SaaS product experience", pct: 84, evidence: "Marketplace SaaS with a B2B seller side; five years of relevant surface work." },
      { key: "lead", label: "Team leadership", pct: 76, evidence: "Tech-lead pattern rather than people-management; mentored ICs on two squads." },
      { key: "ops", label: "Design ops tooling", pct: 70, evidence: "Ran token migrations twice; comfortable in the pipeline, not the owner." },
    ],
  },
];

const HERO_STAGES = [
  {
    key: "review" as const,
    label: "Under review",
    pct: 60,
    nextAction: "Open the top-ranked profile and confirm shortlist.",
    cta: "Shortlist top fit",
  },
  {
    key: "shortlisted" as const,
    label: "Shortlisted",
    pct: 100,
    nextAction: "Send interview invite to shortlisted candidates.",
    cta: "Send interview invite",
  },
  {
    key: "interview" as const,
    label: "Interview",
    pct: 40,
    nextAction: "Log interview outcome and decide on the offer step.",
    cta: "Log interview outcome",
  },
];

function HeroWorkspacePreview() {
  const [candidateId, setCandidateId] = React.useState(HERO_CANDIDATES[0].id);
  const [reqKey, setReqKey] = React.useState(HERO_CANDIDATES[0].coverage[0].key);
  const [stageKey, setStageKey] = React.useState<(typeof HERO_STAGES)[number]["key"]>("shortlisted");

  const candidate = HERO_CANDIDATES.find((c) => c.id === candidateId) ?? HERO_CANDIDATES[0];
  const req = candidate.coverage.find((c) => c.key === reqKey) ?? candidate.coverage[0];
  const stage = HERO_STAGES.find((s) => s.key === stageKey) ?? HERO_STAGES[0];

  return (
    <div
      aria-label="Interactive preview of the TaaSFlow client workspace. Select a candidate, a requirement, or a stage to see how the workspace updates."
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
            client workspace · Senior Product Designer · Sample data
          </span>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[color:var(--brand-ocean)]/10 px-2.5 py-1 text-[11px] font-semibold text-[color:var(--brand-ocean)]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--brand-ocean)]" aria-hidden />
          Live
        </span>
      </div>

      {/* Ranked candidates — interactive selector */}
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">
            Ranked candidates
          </div>
          <div className="text-[11px] font-medium text-[color:var(--brand-navy)]/55">3 of 12</div>
        </div>

        <div
          className="mt-2 space-y-2"
          role="radiogroup"
          aria-label="Select a candidate to update the fit summary"
        >
          {HERO_CANDIDATES.map((c) => {
            const active = c.id === candidateId;
            return (
              <button
                type="button"
                key={c.id}
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setCandidateId(c.id);
                  setReqKey(c.coverage[0].key);
                }}
                className={
                  "block w-full rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)] " +
                  (active
                    ? "border-[color:var(--brand-ocean)]/40 bg-[color:var(--brand-ocean)]/[0.04]"
                    : "border-[color:var(--brand-navy)]/10 bg-white hover:border-[color:var(--brand-navy)]/25")
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-[color:var(--brand-navy)]">
                        {c.name}
                      </span>
                      <span
                        className={
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide " +
                          (c.band === "Top fit"
                            ? "bg-[color:var(--brand-ocean)]/12 text-[color:var(--brand-ocean)]"
                            : c.band === "Strong fit"
                              ? "bg-[color:var(--brand-navy)]/8 text-[color:var(--brand-navy)]/75"
                              : "bg-[color:var(--brand-navy)]/6 text-[color:var(--brand-navy)]/60")
                        }
                      >
                        {c.band}
                      </span>
                    </div>
                    <div className="truncate text-[11px] text-[color:var(--brand-navy)]/60">
                      {c.headline}
                    </div>
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
              </button>
            );
          })}
        </div>
      </div>

      {/* Fit summary — updates with candidate */}
      <div className="mt-4 rounded-xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">
          Fit summary
        </div>
        <p
          className="mt-1 text-[12px] leading-snug text-[color:var(--brand-navy)]/80"
          aria-live="polite"
        >
          {candidate.recommendation}
        </p>
      </div>

      {/* Requirement coverage — click a requirement to reveal evidence */}
      <div className="mt-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">
          Requirement coverage · tap a requirement
        </div>
        <div className="mt-2 space-y-1.5" role="listbox" aria-label="Requirements">
          {candidate.coverage.map((c) => {
            const active = c.key === reqKey;
            return (
              <button
                type="button"
                key={c.key}
                role="option"
                aria-selected={active}
                onClick={() => setReqKey(c.key)}
                className={
                  "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)] " +
                  (active
                    ? "bg-[color:var(--brand-ocean)]/8"
                    : "hover:bg-[color:var(--brand-navy)]/[0.04]")
                }
              >
                <span className="w-32 shrink-0 truncate text-[color:var(--brand-navy)]/75">
                  {c.label}
                </span>
                <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[color:var(--brand-navy)]/8">
                  <div
                    className={
                      "h-full rounded-full " +
                      (c.pct >= 80
                        ? "bg-[color:var(--brand-ocean)]"
                        : "bg-[color:var(--brand-navy)]/40")
                    }
                    style={{ width: `${c.pct}%` }}
                    aria-hidden
                  />
                </div>
                <span className="w-7 shrink-0 text-right font-semibold tabular-nums text-[color:var(--brand-navy)]">
                  {c.pct}
                </span>
              </button>
            );
          })}
        </div>
        <div
          className="mt-2 rounded-md border border-dashed border-[color:var(--brand-ocean)]/30 bg-white px-3 py-2 text-[11px] italic leading-snug text-[color:var(--brand-navy)]/80"
          aria-live="polite"
        >
          <span className="mr-1 not-italic font-semibold text-[color:var(--brand-ocean)]">
            Evidence ·
          </span>
          {req.evidence}
        </div>
      </div>

      {/* Stage rail — click to reveal next Client action */}
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">
            Stage · tap for next action
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5" role="tablist" aria-label="Hiring stages">
          {HERO_STAGES.map((s) => {
            const active = s.key === stageKey;
            return (
              <button
                type="button"
                key={s.key}
                role="tab"
                aria-selected={active}
                onClick={() => setStageKey(s.key)}
                className={
                  "min-w-0 rounded-md border px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)] " +
                  (active
                    ? "border-[color:var(--brand-ocean)]/40 bg-[color:var(--brand-ocean)]/[0.06]"
                    : "border-[color:var(--brand-navy)]/10 bg-white hover:border-[color:var(--brand-navy)]/25")
                }
              >
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--brand-navy)]/8">
                  <div
                    className="h-full rounded-full bg-[color:var(--brand-ocean)]"
                    style={{ width: `${s.pct}%` }}
                    aria-hidden
                  />
                </div>
                <div className="mt-1.5 truncate text-[10px] font-semibold text-[color:var(--brand-navy)]">
                  {s.label}
                </div>
              </button>
            );
          })}
        </div>
        <div
          className="mt-2 flex items-start gap-2 rounded-md bg-[color:var(--brand-sky)]/30 px-3 py-2 text-[11px] leading-snug text-[color:var(--brand-navy)]/85"
          aria-live="polite"
        >
          <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--brand-navy)]" aria-hidden />
          <span>
            <span className="font-semibold">Next · </span>
            {stage.nextAction}
          </span>
        </div>
      </div>

      {/* Recent delivery + one clear Client action */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--brand-navy)]/8 pt-3">
        <div className="min-w-0 text-[11px] text-[color:var(--brand-navy)]/60">
          <span className="font-semibold text-[color:var(--brand-navy)]/75">Recent delivery ·</span>{" "}
          3 ranked candidates added this week
        </div>
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-[color:var(--brand-navy)] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[color:var(--brand-navy-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
        >
          {stage.cta}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/* ---------- Client candidate delivery — interactive, static fictional data ---------- */

type DeliveryCandidate = {
  id: string;
  name: string;
  headline: string;
  location: string;
  band: "Top fit" | "Strong fit" | "Consider";
  stage: "Under review" | "Shortlisted" | "Interview";
  score: number;
  availability: string;
  recommendation: string;
  coverage: { key: string; label: string; pct: number; verdict: string; evidence: string }[];
  strengths: string[];
  validations: string[];
  experience: { role: string; org: string; period: string }[];
  questions: string[];
};

const DELIVERY_CANDIDATES: DeliveryCandidate[] = [
  {
    id: "A-1042",
    name: "Alex R.",
    headline: "Senior Product Designer · 8 yrs · B2B SaaS",
    location: "Lisbon, PT · Remote-friendly",
    band: "Top fit",
    stage: "Under review",
    score: 94,
    availability: "Available in 4 weeks",
    recommendation: "Shortlist — strongest evidence on design-system ownership and B2B depth.",
    coverage: [
      { key: "ds", label: "Design systems ownership", pct: 96, verdict: "Strong", evidence: "Named owner of a design-system rollout across three product lines; documented adoption across ten squads." },
      { key: "b2b", label: "B2B SaaS product experience", pct: 92, verdict: "Strong", evidence: "Six years shipping B2B SaaS products used by revenue and operations teams." },
      { key: "lead", label: "Team leadership", pct: 88, verdict: "Strong", evidence: "Managed five designers through one org restructure and two hiring cycles." },
      { key: "ops", label: "Design ops tooling", pct: 62, verdict: "Validate", evidence: "Partnered on tokens pipeline; hands-on tooling scope to confirm in interview." },
    ],
    strengths: [
      "Led design-system rollout across three product lines, reducing component debt materially.",
      "Six years shipping B2B SaaS products used by revenue and operations teams.",
      "Managed a design team through two hiring cycles and one org restructure.",
    ],
    validations: [
      "Confirm scope of hands-on design-ops tooling ownership versus partnership with engineering.",
      "Clarify recent experience with usage-based product analytics for prioritization.",
    ],
    experience: [
      { role: "Senior Product Designer", org: "Fictional SaaS Co.", period: "2021 — present" },
      { role: "Product Designer", org: "Fictional Analytics Ltd.", period: "2018 — 2021" },
    ],
    questions: [
      "Walk us through the design-system rollout you led — how did you handle adoption across teams that hadn't asked for it?",
      "How do you decide when a component belongs in the system versus in a product surface?",
    ],
  },
  {
    id: "A-1039",
    name: "Priya M.",
    headline: "Senior Product Designer · 7 yrs · Fintech",
    location: "Berlin, DE · Hybrid",
    band: "Strong fit",
    stage: "Shortlisted",
    score: 91,
    availability: "Available in 6 weeks",
    recommendation: "Advance to interview — strong systems work, validate B2B SaaS depth.",
    coverage: [
      { key: "ds", label: "Design systems ownership", pct: 90, verdict: "Strong", evidence: "Rebuilt a fintech design system to WCAG 2.2 AA; ran adoption workshops for four squads." },
      { key: "b2b", label: "B2B SaaS product experience", pct: 74, verdict: "Validate", evidence: "Two years on B2B-facing fintech surfaces; most work sits closer to consumer flows." },
      { key: "lead", label: "Team leadership", pct: 82, verdict: "Strong", evidence: "Design lead on a three-person team; mentors two mid-level designers." },
      { key: "ops", label: "Design ops tooling", pct: 78, verdict: "Strong", evidence: "Owned Figma library governance and contribution model end to end." },
    ],
    strengths: [
      "Owned a full fintech design-system rebuild to accessibility standards.",
      "Runs a lightweight contribution model that scales across squads.",
      "Comfortable pairing daily with engineering on tokens and primitives.",
    ],
    validations: [
      "Confirm depth of B2B SaaS surface work beyond fintech.",
      "Explore how they've handled non-fintech stakeholders and priorities.",
    ],
    experience: [
      { role: "Senior Product Designer", org: "Fictional Fintech AG", period: "2020 — present" },
      { role: "Product Designer", org: "Fictional Payments GmbH", period: "2017 — 2020" },
    ],
    questions: [
      "How does your contribution model handle a squad that wants to fork a component?",
      "Which parts of your fintech work translate cleanly to a non-fintech B2B SaaS surface?",
    ],
  },
  {
    id: "A-1037",
    name: "Dan K.",
    headline: "Senior Product Designer · 9 yrs · Marketplaces",
    location: "Remote · CET timezone",
    band: "Consider",
    stage: "Under review",
    score: 87,
    availability: "Available in 2 weeks",
    recommendation: "Consider — strong craft, validate systems ownership at scale in interview.",
    coverage: [
      { key: "ds", label: "Design systems ownership", pct: 78, verdict: "Validate", evidence: "Contributed heavily to two systems; not the named owner on either rollout." },
      { key: "b2b", label: "B2B SaaS product experience", pct: 84, verdict: "Strong", evidence: "Marketplace SaaS with a B2B seller side; five years of relevant surface work." },
      { key: "lead", label: "Team leadership", pct: 76, verdict: "Validate", evidence: "Tech-lead pattern rather than people-management; mentored ICs on two squads." },
      { key: "ops", label: "Design ops tooling", pct: 70, verdict: "Validate", evidence: "Ran token migrations twice; comfortable in the pipeline, not the owner." },
    ],
    strengths: [
      "Nine years of shipped work across marketplace and B2B surfaces.",
      "Strong evidence on cross-functional pairing with engineering and PM.",
      "Fast onboarding — has stepped into two greenfield systems.",
    ],
    validations: [
      "Confirm scope and outcome of design-system ownership beyond contribution.",
      "Assess appetite for a people-management path versus staying IC.",
    ],
    experience: [
      { role: "Senior Product Designer", org: "Fictional Marketplace Inc.", period: "2019 — present" },
      { role: "Product Designer", org: "Fictional Commerce Co.", period: "2015 — 2019" },
    ],
    questions: [
      "Which system decision are you most proud of, and where would you land differently today?",
      "Would a formal people-management remit change your interest in this role?",
    ],
  },
];

function ClientCandidateDelivery() {
  const [candidateId, setCandidateId] = React.useState(DELIVERY_CANDIDATES[0].id);
  const [reqKey, setReqKey] = React.useState(DELIVERY_CANDIDATES[0].coverage[0].key);
  const candidate =
    DELIVERY_CANDIDATES.find((c) => c.id === candidateId) ?? DELIVERY_CANDIDATES[0];
  const req = candidate.coverage.find((c) => c.key === reqKey) ?? candidate.coverage[0];

  return (
    <div
      aria-label="Interactive preview of the client candidate detail view. Select a candidate or a requirement to update the panel."
      className="rounded-2xl border border-[color:var(--brand-navy)]/12 bg-white p-5 shadow-[var(--brand-shadow-lg)] sm:p-6"
    >
      {/* Candidate selector — top on mobile, top row on desktop */}
      <div
        role="radiogroup"
        aria-label="Select a candidate"
        className="-mx-1 flex gap-2 overflow-x-auto pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0"
      >
        {DELIVERY_CANDIDATES.map((c) => {
          const active = c.id === candidateId;
          return (
            <button
              type="button"
              key={c.id}
              role="radio"
              aria-checked={active}
              onClick={() => {
                setCandidateId(c.id);
                setReqKey(c.coverage[0].key);
              }}
              className={
                "min-w-[15rem] shrink-0 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)] sm:min-w-0 " +
                (active
                  ? "border-[color:var(--brand-ocean)]/40 bg-[color:var(--brand-ocean)]/[0.05]"
                  : "border-[color:var(--brand-navy)]/10 bg-white hover:border-[color:var(--brand-navy)]/25")
              }
            >
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-[color:var(--brand-navy)]">
                  {c.name}
                </span>
                <span
                  className={
                    "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide " +
                    (c.band === "Top fit"
                      ? "bg-[color:var(--brand-ocean)]/12 text-[color:var(--brand-ocean)]"
                      : c.band === "Strong fit"
                        ? "bg-[color:var(--brand-navy)]/8 text-[color:var(--brand-navy)]/75"
                        : "bg-[color:var(--brand-navy)]/6 text-[color:var(--brand-navy)]/60")
                  }
                >
                  {c.band}
                </span>
              </div>
              <div className="mt-0.5 truncate text-[11px] text-[color:var(--brand-navy)]/65">
                {c.headline}
              </div>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-[color:var(--brand-navy)]/55">
                <MapPin className="h-3 w-3" aria-hidden />
                <span className="truncate">{c.location}</span>
              </div>
              <div className="mt-1.5 inline-flex items-center rounded-full border border-[color:var(--brand-navy)]/12 bg-white px-2 py-0.5 text-[10px] font-medium text-[color:var(--brand-navy)]/70">
                Stage · {c.stage}
              </div>
            </button>
          );
        })}
      </div>

      {/* Header: identity + recommendation */}
      <div
        className="mt-4 flex flex-wrap items-start justify-between gap-4 border-t border-[color:var(--brand-navy)]/8 pt-4"
        aria-live="polite"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">
            <span
              className="inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--brand-ocean)]"
              aria-hidden
            />
            Candidate #{candidate.id}
          </div>
          <div className="mt-1 text-lg font-semibold text-[color:var(--brand-navy)]">
            {candidate.name}
          </div>
          <div className="truncate text-sm text-[color:var(--brand-navy)]/70">
            {candidate.headline}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[color:var(--brand-navy)]/60">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden /> {candidate.location}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden /> {candidate.availability}
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-[color:var(--brand-navy)]/15 bg-white px-2 py-0.5 font-medium text-[color:var(--brand-navy)]/75 hover:bg-[color:var(--brand-navy)]/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
            >
              <FileText className="h-3.5 w-3.5" aria-hidden /> View CV
            </button>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="rounded-md bg-[color:var(--brand-ocean)]/12 px-3 py-1 text-lg font-semibold tabular-nums text-[color:var(--brand-ocean)]">
            {candidate.score}
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-ocean)]/10 px-2 py-0.5 text-[11px] font-semibold text-[color:var(--brand-ocean)]">
            <Sparkles className="h-3 w-3" aria-hidden /> {candidate.band}
          </span>
        </div>
      </div>

      {/* Recommendation */}
      <div className="mt-4 rounded-xl border border-[color:var(--brand-ocean)]/20 bg-[color:var(--brand-ocean)]/[0.04] p-3.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-ocean)]">
          Recommendation
        </div>
        <p className="mt-1 text-sm text-[color:var(--brand-navy)]/85">{candidate.recommendation}</p>
      </div>

      {/* Requirement coverage — click for evidence */}
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">
            Requirement coverage · tap a requirement
          </div>
        </div>
        <div className="mt-2 space-y-1.5" role="listbox" aria-label="Requirements">
          {candidate.coverage.map((c) => {
            const active = c.key === reqKey;
            return (
              <button
                type="button"
                key={c.key}
                role="option"
                aria-selected={active}
                onClick={() => setReqKey(c.key)}
                className={
                  "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)] " +
                  (active
                    ? "bg-[color:var(--brand-ocean)]/8"
                    : "hover:bg-[color:var(--brand-navy)]/[0.04]")
                }
              >
                <span className="w-40 shrink-0 truncate text-[color:var(--brand-navy)]/75 sm:w-52">
                  {c.label}
                </span>
                <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[color:var(--brand-navy)]/8">
                  <div
                    className={
                      "h-full rounded-full " +
                      (c.pct >= 80
                        ? "bg-[color:var(--brand-ocean)]"
                        : "bg-[color:var(--brand-navy)]/35")
                    }
                    style={{ width: `${c.pct}%` }}
                    aria-hidden
                  />
                </div>
                <span
                  className={
                    "w-16 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wide " +
                    (c.verdict === "Strong"
                      ? "text-[color:var(--brand-ocean)]"
                      : "text-[color:var(--brand-navy)]/60")
                  }
                >
                  {c.verdict}
                </span>
              </button>
            );
          })}
        </div>
        <div
          className="mt-2 rounded-md border border-dashed border-[color:var(--brand-ocean)]/30 bg-white px-3 py-2 text-xs italic leading-snug text-[color:var(--brand-navy)]/80"
          aria-live="polite"
        >
          <span className="mr-1 not-italic font-semibold text-[color:var(--brand-ocean)]">
            Evidence ·
          </span>
          {req.evidence}
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
            {candidate.strengths.map((s) => (
              <li key={s} className="flex gap-1.5">
                <span
                  className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-[color:var(--brand-ocean)]"
                  aria-hidden
                />
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
            {candidate.validations.map((v) => (
              <li key={v} className="flex gap-1.5">
                <span
                  className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-[color:var(--brand-navy)]/40"
                  aria-hidden
                />
                <span>{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Professional experience */}
      <div className="mt-4 rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-3.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/60">
          <Briefcase className="h-3.5 w-3.5 text-[color:var(--brand-navy)]/60" aria-hidden />
          Professional experience
        </div>
        <ul className="mt-2 space-y-1.5 text-xs text-[color:var(--brand-navy)]/80">
          {candidate.experience.map((e) => (
            <li key={`${e.role}-${e.org}`} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate">
                <span className="font-semibold text-[color:var(--brand-navy)]">{e.role}</span> ·{" "}
                {e.org}
              </span>
              <span className="shrink-0 text-[color:var(--brand-navy)]/55">{e.period}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Personalized interview questions */}
      <div className="mt-4 rounded-xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-sky)]/25 p-3.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/65">
          <MessageCircle className="h-3.5 w-3.5" aria-hidden />
          Personalized interview questions
        </div>
        <ul className="mt-2 space-y-1.5 text-sm italic text-[color:var(--brand-navy)]/85">
          {candidate.questions.map((q) => (
            <li key={q} className="flex gap-2">
              <Quote className="mt-1 h-3.5 w-3.5 shrink-0 text-[color:var(--brand-navy)]/50" aria-hidden />
              <span>{q}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Client decision controls */}
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[color:var(--brand-navy)]/8 pt-4">
        <button
          type="button"
          className="rounded-md bg-[color:var(--brand-navy)] px-3 py-2 text-center text-sm font-semibold text-white hover:bg-[color:var(--brand-navy-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
        >
          Shortlist
        </button>
        <button
          type="button"
          className="rounded-md border border-[color:var(--brand-navy)]/15 bg-white px-3 py-2 text-center text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
        >
          Interview
        </button>
        <button
          type="button"
          className="rounded-md border border-[color:var(--brand-navy)]/15 bg-white px-3 py-2 text-center text-sm font-semibold text-[color:var(--brand-navy)]/70 hover:bg-[color:var(--brand-navy)]/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
        >
          Pass
        </button>
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
                On-demand recruiting function
              </span>
              <h1
                id="home-hero-heading"
                className="font-[family-name:var(--brand-font-display)] text-4xl font-semibold leading-[1.05] tracking-tight text-[color:var(--brand-navy)] sm:text-5xl lg:text-[3.5rem]"
              >
                Your hiring team.
                <br className="hidden sm:block" /> On demand.
              </h1>
              <p className="max-w-xl text-lg text-[color:var(--brand-navy)]/75">
                Open a role Monday. See a{" "}
                <span className="font-semibold text-[color:var(--brand-navy)]">ranked shortlist with evidence</span>{" "}
                by Friday. One flat subscription — no placement fees. You keep the
                recruiter, the ATS, and the final call.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  to="/intake"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[color:var(--brand-navy-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
                >
                  Open a role <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  to="/how-it-works"
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/15 bg-white px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
                >
                  See a sample shortlist
                </Link>
                <a
                  href="#roi-calculator"
                  className="inline-flex min-h-11 items-center rounded-md px-2 py-2.5 text-sm font-medium text-[color:var(--brand-navy)]/70 underline-offset-4 hover:text-[color:var(--brand-navy)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
                >
                  Compare to agency fees
                </a>
              </div>
              <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-[color:var(--brand-navy)]/65">
                {[
                  "5–12 ranked candidates per role, week 1",
                  "Evidence cited for every requirement",
                  "Flat subscription vs. 20–25% contingency fees",
                  "Human recruiters + AI-supported structure",
                  "You own the pipeline and the decisions",
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

      {/* 1b — TRUST STRIP */}
      <TrustStrip />

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


      {/* 3.25 — ROI CALCULATOR (reusable, canonical config) */}
      <div id="roi-calculator" className="scroll-mt-24">
        <PublicSection>
          <PublicPage>
            <RoiCalculator
              variant="homepage"
              supportingCopy="Adjust the assumptions to compare traditional agency and internal sourcing costs with the TaaSFlow model."
            />
          </PublicPage>
        </PublicSection>
      </div>

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

      {/* 3.6 — INTERACTIVE OPERATING SYSTEM */}
      <section className="border-y border-[color:var(--brand-navy)]/8 bg-white">
        <PublicSection>
          <PublicPage>
            <SectionHead
              eyebrow="The TaaSFlow operating system"
              title="One hiring engine. Every step visible."
              lead="Human recruiting expertise, technology-supported execution, and Client visibility — from open role to hiring decision."
            />
            <OperatingSystem />

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

      {/* 4 — SUBSCRIPTION MODEL */}
      <PublicSection>
        <PublicPage>
          <SectionHead
            eyebrow="The subscription model"
            title="A recruiting function, not another placement fee."
            lead="TaaSFlow replaces one-off agency transactions with a recurring recruiting function — predictable cost, continuous pipeline, and candidates you keep."
          />

          <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Traditional agency card */}
            <div className="relative flex flex-col rounded-2xl border border-[color:var(--brand-navy)]/12 bg-[color:var(--brand-navy)]/[0.03] p-6 sm:p-7">
              <div className="flex items-center gap-2 text-[color:var(--brand-navy)]/70">
                <XCircle className="h-4 w-4" aria-hidden />
                <span className="text-xs font-semibold uppercase tracking-wide">
                  Traditional agency transaction
                </span>
              </div>
              <h3 className="mt-3 text-xl font-semibold text-[color:var(--brand-navy)]">
                Paid per hire, resets every role.
              </h3>
              <ul className="mt-5 space-y-3 text-sm text-[color:var(--brand-navy)]/80">
                {[
                  "Percentage-of-salary placement fee on every hire.",
                  "Cost is unpredictable and scales with each new hire.",
                  "Sourcing restarts from zero for each new engagement.",
                  "Candidate context leaves with the agency at the end.",
                  "Structured as isolated transactions, not ongoing hiring support.",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <XCircle
                      className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-navy)]/45"
                      aria-hidden
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* TaaSFlow subscription card */}
            <div className="relative flex flex-col overflow-hidden rounded-2xl border border-[color:var(--brand-ocean)]/30 bg-[color:var(--brand-ocean)]/8 p-6 shadow-[var(--brand-shadow-sm)] sm:p-7">
              <span
                className="absolute inset-x-0 top-0 h-1 bg-[color:var(--brand-ocean)]"
                aria-hidden
              />
              <div className="flex items-center gap-2 text-[color:var(--brand-ocean)]">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                <span className="text-xs font-semibold uppercase tracking-wide">
                  TaaSFlow continuous subscription
                </span>
              </div>
              <h3 className="mt-3 text-xl font-semibold text-[color:var(--brand-navy)]">
                One recurring cost. Continuous recruiting.
              </h3>
              <ul className="mt-5 space-y-3 text-sm text-[color:var(--brand-navy)]">
                {[
                  "Predictable recurring cost for the recruiting function.",
                  "No percentage-of-salary placement fee.",
                  "Continuous candidate pipeline instead of one-off searches.",
                  "You own the delivered candidate information in your workspace.",
                  "No extra placement fee when a delivered candidate is hired.",
                  "Built to support ongoing hiring, not isolated transactions.",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-ocean)]"
                      aria-hidden
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-8">
            <Link
              to="/pricing"
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[color:var(--brand-navy-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
            >
              View Pricing <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
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

      {/* 5.5 — INDUSTRIES PREVIEW */}
      <PublicSection>
        <PublicPage>
          <SectionHead
            eyebrow="Industries"
            title="Recruiting tuned to the industry you actually hire in."
            lead="Every intake, evidence file, and shortlist is scoped to the hiring reality of the industry — not a generic recruiter template."
          />

          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {FEATURED_INDUSTRIES.map((ind) => (
              <li key={ind.slug} className="min-w-0">
                <Link
                  to="/industries/$slug"
                  params={{ slug: ind.slug }}
                  className="group flex h-full flex-col rounded-2xl border border-[color:var(--brand-navy)]/12 bg-white p-5 shadow-[var(--brand-shadow-sm)] transition-shadow hover:shadow-[var(--brand-shadow-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
                >
                  <div className="flex items-center gap-2">
                    <Building2
                      className="h-4 w-4 text-[color:var(--brand-ocean)]"
                      aria-hidden
                    />
                    <h3 className="text-base font-semibold text-[color:var(--brand-navy)]">
                      {ind.name}
                    </h3>
                  </div>
                  <p className="mt-3 text-sm text-[color:var(--brand-navy)]/75">
                    {ind.context}
                  </p>
                  <div className="mt-4 border-t border-[color:var(--brand-navy)]/8 pt-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">
                      Example roles
                    </div>
                    <div className="mt-1 text-sm text-[color:var(--brand-navy)]/85">
                      {ind.roles}
                    </div>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-ocean)] group-hover:text-[color:var(--brand-navy)]">
                    View industry <ArrowRight className="h-4 w-4" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <Link
              to="/industries"
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[color:var(--brand-navy)]/15 bg-white px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
            >
              View All Industries <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </PublicPage>
      </PublicSection>

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

      {/* 6.5 — CLIENT WORKSPACE TOUR */}
      <section className="border-y border-[color:var(--brand-navy)]/8 bg-[color:var(--brand-mist)]/30">
        <PublicSection>
          <PublicPage>
            <SectionHead
              eyebrow="Inside the workspace"
              title="See how clients actually work with us."
              lead="Every open role, ranked candidate, and decision in one place."
            />
            <WorkspaceTour />
          </PublicPage>
        </PublicSection>
      </section>

      {/* 7 — TAASFLOW VS AGENCY MODEL */}
      <section className="border-y border-[color:var(--brand-navy)]/8 bg-white">
        <PublicSection>
          <PublicPage>
            <SectionHead
              eyebrow="TaaSFlow vs the agency model"
              title="Recruiting should not restart from zero."
              lead="Pick a dimension, pick your hiring intent, and see how each model behaves."
            />
            <ModelComparison />
          </PublicPage>
        </PublicSection>
      </section>

      {/* 7.5 — AUDIENCE PERSONALIZATION */}
      <PublicSection>
        <PublicPage>
          <SectionHead
            eyebrow="Built for your context"
            title="Built around how you hire."
            lead="Pick your role. See exactly what TaaSFlow does for you."
          />
          <AudienceSelector />
        </PublicPage>
      </PublicSection>


      {/* 8 — APPROVED PROOF (process credibility) */}
      <PublicSection>
        <PublicPage>
          <SectionHead
            eyebrow="Why teams trust the process"
            title="Proof lives in how the work is done."
            lead="We don't publish testimonials we can't verify. What we can show you is the discipline behind every candidate we deliver — the same evaluation, workspace, and audit trail on every role."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {APPROVED_PROOF.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.t}>
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[color:var(--brand-ocean)]/10 text-[color:var(--brand-ocean)]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-[color:var(--brand-navy)]">
                    {item.t}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[color:var(--brand-navy)]/70">
                    {item.d}
                  </p>
                </Card>
              );
            })}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-4 text-xs text-[color:var(--brand-navy)]/60">
            <Link
              to="/how-it-works"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-ocean)] hover:text-[color:var(--brand-navy)]"
            >
              See the full process <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              to="/case-studies"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-navy)]/70 hover:text-[color:var(--brand-navy)]"
            >
              Case studies <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </PublicPage>
      </PublicSection>

      {/* 9 — RESOURCES PREVIEW */}
      <section className="border-y border-[color:var(--brand-navy)]/8 bg-[color:var(--brand-paper)]">
        <PublicSection>
          <PublicPage>
            <SectionHead
              eyebrow="Resources"
              title="Reading for hiring teams."
              lead="Practical guides and analysis on how hiring is actually changing — written for the people running the process."
            />
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {HOMEPAGE_RESOURCES.map((r) => {
                const Icon = r.icon;
                return (
                  <Link
                    key={r.slug}
                    to="/blog/$slug"
                    params={{ slug: r.slug }}
                    className="group flex h-full flex-col overflow-hidden rounded-xl border border-[color:var(--brand-navy)]/10 bg-white transition hover:border-[color:var(--brand-ocean)]/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ocean)]"
                  >
                    <div
                      className={`relative flex h-40 items-center justify-center ${
                        r.tone === "navy"
                          ? "bg-gradient-to-br from-[color:var(--brand-navy)] to-[color:var(--brand-ocean)]"
                          : "bg-gradient-to-br from-[color:var(--brand-ocean)]/90 to-[color:var(--brand-navy)]/80"
                      }`}
                    >
                      <Icon className="h-12 w-12 text-white/90" aria-hidden />
                      <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]">
                        {r.type}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <h3 className="text-base font-semibold leading-snug text-[color:var(--brand-navy)] group-hover:text-[color:var(--brand-ocean)]">
                        {r.title}
                      </h3>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-[color:var(--brand-navy)]/70">
                        {r.description}
                      </p>
                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-ocean)]">
                        Read {r.type.toLowerCase()} <ArrowRight className="h-4 w-4" aria-hidden />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="mt-8">
              <Link
                to="/resources"
                className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-ocean)] hover:text-[color:var(--brand-navy)]"
              >
                Browse all resources <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </PublicPage>
        </PublicSection>
      </section>

      {/* 10 — FAQ */}
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
                <dd className="mt-2 text-sm leading-relaxed text-[color:var(--brand-navy)]/70">
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

      {/* 11 — FINAL CTA */}
      <CtaSection
        eyebrow="Get started"
        title="Build your next candidate pipeline with TaaSFlow."
        description="Open a role and get a ranked shortlist, evidence per requirement, and a live workspace your whole hiring team can see."
        primary={{ to: "/intake", label: "Start Hiring" }}
        secondary={{ to: "/contact", label: "Book a Conversation" }}
      />
    </SiteShell>
  );
}
